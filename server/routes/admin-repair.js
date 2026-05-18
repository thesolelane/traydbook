import { Router } from 'express'
import { supabaseAdmin } from '../lib/clients.js'
import crypto from 'crypto'
import { requireAuth, requireSuperAdmin } from '../lib/auth.js'

const router = Router()

const ALLOWED_TABLES = ['users', 'jobs', 'bids', 'reviews', 'credits', 'posts']

// Destructive keywords blocked outright — no approval path
const HARD_BLOCKED = ['DROP', 'TRUNCATE', 'ALTER TABLE', 'CREATE TABLE', 'GRANT ', 'REVOKE ']

// These require a second distinct admin to approve
const REQUIRES_APPROVAL = ['DELETE', 'UPDATE']

// Approval codes expire after 1 hour
const APPROVAL_TTL_MS = 60 * 60 * 1000

/**
 * Produce a stable, comment-stripped canonical form of the SQL for hashing.
 * This ensures the approval is bound to the exact statement that was reviewed.
 */
function canonicalSql(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

function hashSql(sql) {
  return crypto.createHash('sha256').update(canonicalSql(sql)).digest('hex')
}

// POST /api/admin/repair/execute
router.post('/execute', requireAuth, requireSuperAdmin, async (req, res) => {
  const { sql, description, approval_code } = req.body

  if (!sql || !description) {
    return res.status(400).json({ error: 'sql and description required' })
  }

  const stripped = canonicalSql(sql)

  for (const keyword of HARD_BLOCKED) {
    if (stripped.includes(keyword)) {
      return res.status(403).json({ error: `Forbidden keyword: ${keyword.trim()}` })
    }
  }

  const tableMatches = sql.match(/FROM\s+(\w+)|UPDATE\s+(\w+)|INSERT\s+INTO\s+(\w+)/gi) ?? []
  const tables = [
    ...new Set(tableMatches.map(m => m.split(/\s+/).pop()?.toLowerCase()).filter(Boolean)),
  ]
  const unauthorized = tables.filter(t => !ALLOWED_TABLES.includes(t))
  if (unauthorized.length > 0) {
    return res.status(403).json({ error: `Unauthorized tables: ${unauthorized.join(', ')}` })
  }

  const isDestructive = REQUIRES_APPROVAL.some(kw => stripped.includes(kw))

  if (isDestructive && !approval_code) {
    const approvalCode = crypto.randomBytes(24).toString('hex')
    const expiresAt = new Date(Date.now() + APPROVAL_TTL_MS).toISOString()
    await supabaseAdmin.from('repair_approvals').insert({
      requester: req.user.id,
      sql_preview: sql.substring(0, 500),
      sql_hash: hashSql(sql),
      description,
      approval_code: approvalCode,
      status: 'pending',
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
    })
    // Approval code is NOT returned to the requester — a second super-admin
    // must open the approvals list, verify the SQL, and then approve it.
    return res.status(202).json({
      pending_approval: true,
      message:
        'Destructive operation queued. A second super-admin must open the approvals list, review the SQL, and approve it before it can be executed.',
    })
  }

  if (isDestructive && approval_code) {
    // Look up the approval — must be in 'approved' state (not pending, used, or expired)
    const { data: approval } = await supabaseAdmin
      .from('repair_approvals')
      .select('*')
      .eq('approval_code', approval_code)
      .eq('status', 'approved')
      .single()

    if (!approval) {
      return res.status(403).json({ error: 'Valid approved code required for destructive SQL' })
    }

    // Enforce two-person rule
    if (approval.requester === req.user.id) {
      return res.status(403).json({
        error: 'You cannot execute your own repair request — a second admin must approve it',
      })
    }

    // Verify the approval is bound to this exact SQL (prevents code reuse on different queries)
    if (approval.sql_hash !== hashSql(sql)) {
      return res.status(403).json({
        error: 'Approval code was issued for a different SQL statement — request a new approval',
      })
    }

    // Enforce expiry
    if (approval.expires_at && new Date(approval.expires_at) < new Date()) {
      await supabaseAdmin
        .from('repair_approvals')
        .update({ status: 'expired' })
        .eq('id', approval.id)
      return res.status(403).json({ error: 'Approval code has expired — request a new approval' })
    }

    // Atomically consume the approval code — prevents replay/reuse
    const { count } = await supabaseAdmin
      .from('repair_approvals')
      .update({ status: 'used', used_at: new Date().toISOString(), used_by: req.user.id })
      .eq('id', approval.id)
      .eq('status', 'approved') // guard: only transitions from approved → used
      .select('id', { count: 'exact', head: true })

    if (!count || count < 1) {
      return res.status(409).json({
        error: 'Approval code was already consumed — it cannot be reused',
      })
    }
  }

  const { data: result, error } = await supabaseAdmin.rpc('execute_repair', { sql_query: sql })
  if (error) return res.status(500).json({ error: error.message })

  await supabaseAdmin.from('repair_log').insert({
    admin_id: req.user.id,
    sql_query: sql,
    description,
    rows_affected: result?.rows_affected || 0,
    executed_at: new Date().toISOString(),
  })

  console.log(`[repair] Executed by ${req.user.id}: ${description}`)
  res.json({ executed: true, rows_affected: result?.rows_affected || 0 })
})

// POST /api/admin/repair/approve — second super-admin approves a pending request
router.post('/approve', requireAuth, requireSuperAdmin, async (req, res) => {
  const { approval_code, approver_notes } = req.body

  if (!approval_code) return res.status(400).json({ error: 'approval_code required' })

  const { data: request } = await supabaseAdmin
    .from('repair_approvals')
    .select('*')
    .eq('approval_code', approval_code)
    .eq('status', 'pending')
    .single()

  if (!request) {
    return res.status(404).json({ error: 'Approval request not found or already processed' })
  }

  // Enforce two-person rule — approver must differ from requester
  if (request.requester === req.user.id) {
    return res.status(403).json({
      error: 'You cannot approve your own repair request — requires a second admin',
    })
  }

  // Reject expired requests
  if (request.expires_at && new Date(request.expires_at) < new Date()) {
    await supabaseAdmin.from('repair_approvals').update({ status: 'expired' }).eq('id', request.id)
    return res.status(410).json({ error: 'This approval request has expired' })
  }

  await supabaseAdmin
    .from('repair_approvals')
    .update({
      status: 'approved',
      approver: req.user.id,
      approver_notes: approver_notes ?? null,
      approved_at: new Date().toISOString(),
    })
    .eq('id', request.id)

  console.log(`[repair] Approval granted by ${req.user.id} for request ${request.id}`)
  res.json({ approved: true, id: request.id })
})

// GET /api/admin/repair/approvals — list pending and recent approvals
router.get('/approvals', requireAuth, requireSuperAdmin, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('repair_approvals')
    .select(
      'id, requester, sql_preview, description, status, created_at, approved_at, approver, expires_at'
    )
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ approvals: data || [] })
})

export default router
