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

// POST /api/admin/repair/execute
router.post('/execute', requireAuth, requireSuperAdmin, async (req, res) => {
  const { sql, description, approval_code } = req.body

  if (!sql || !description) {
    return res.status(400).json({ error: 'sql and description required' })
  }

  // Normalise to catch comment-obfuscated keywords (strip /* */ and -- comments)
  const stripped = sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ')
    .toUpperCase()

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
    await supabaseAdmin.from('repair_approvals').insert({
      requester: req.user.id,
      sql_preview: sql.substring(0, 500),
      description,
      approval_code: approvalCode,
      status: 'pending',
      created_at: new Date().toISOString(),
    })
    // Do NOT return the approval_code — a second admin must retrieve and supply it
    return res.status(202).json({
      pending_approval: true,
      message:
        'Destructive operation queued. A second super-admin must retrieve and approve the code from the approvals list.',
    })
  }

  if (isDestructive && approval_code) {
    // Verify the approval code was created by a DIFFERENT super-admin
    const { data: approval } = await supabaseAdmin
      .from('repair_approvals')
      .select('*')
      .eq('approval_code', approval_code)
      .eq('status', 'approved')
      .single()

    if (!approval) {
      return res.status(403).json({ error: 'Valid approved code required for destructive SQL' })
    }
    if (approval.requester === req.user.id) {
      return res
        .status(403)
        .json({ error: 'You cannot approve your own repair request — requires a second admin' })
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
    return res
      .status(403)
      .json({ error: 'You cannot approve your own repair request — requires a second admin' })
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
    .select('id, requester, sql_preview, description, status, created_at, approved_at, approver')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ approvals: data || [] })
})

export default router
