import { Router } from 'express'
import { supabaseAdmin } from '../lib/clients.js'
import crypto from 'crypto'

const router = Router()

const ALLOWED_TABLES = ['users', 'jobs', 'bids', 'reviews', 'credits', 'posts']
const BLOCKED_KEYWORDS = ['DROP', 'TRUNCATE', 'DELETE FROM', 'ALTER TABLE']

// POST /api/admin/repair/execute
router.post('/execute', async (req, res) => {
  const { sql, description, approval_code } = req.body

  if (!sql || !description) {
    return res.status(400).json({ error: 'sql and description required' })
  }

  const upperSql = sql.toUpperCase()
  for (const keyword of BLOCKED_KEYWORDS) {
    if (upperSql.includes(keyword)) {
      return res.status(403).json({ error: `Forbidden keyword: ${keyword}` })
    }
  }

  const tableMatches = sql.match(/FROM\s+(\w+)|UPDATE\s+(\w+)|INSERT\s+INTO\s+(\w+)/gi) || []
  const tables = [...new Set(tableMatches.map(m => m.split(/\s+/).pop()?.toLowerCase()).filter(Boolean))]
  const unauthorized = tables.filter(t => !ALLOWED_TABLES.includes(t))
  if (unauthorized.length > 0) {
    return res.status(403).json({ error: `Unauthorized tables: ${unauthorized.join(', ')}` })
  }

  const isDestructive = /DELETE|UPDATE/.test(upperSql)
  if (isDestructive && !approval_code) {
    const approvalCode = crypto.randomBytes(16).toString('hex')
    await supabaseAdmin.from('repair_approvals').insert({
      requester: req.user?.id || null,
      sql_preview: sql.substring(0, 500),
      description,
      approval_code: approvalCode,
      status: 'pending',
      created_at: new Date().toISOString(),
    })
    return res.status(202).json({
      pending_approval: true,
      approval_code: approvalCode,
      message: 'Second admin approval required for destructive operation',
    })
  }

  const { data: result, error } = await supabaseAdmin.rpc('execute_repair', { sql_query: sql })
  if (error) return res.status(500).json({ error: error.message })

  await supabaseAdmin.from('repair_log').insert({
    admin_id: req.user?.id || null,
    sql_query: sql,
    description,
    rows_affected: result?.rows_affected || 0,
    executed_at: new Date().toISOString(),
  })

  res.json({ executed: true, rows_affected: result?.rows_affected || 0 })
})

// POST /api/admin/repair/approve
router.post('/approve', async (req, res) => {
  const { approval_code, approver_notes } = req.body

  const { data: request } = await supabaseAdmin
    .from('repair_approvals')
    .select('*')
    .eq('approval_code', approval_code)
    .eq('status', 'pending')
    .single()

  if (!request) return res.status(404).json({ error: 'Approval request not found or already processed' })

  await supabaseAdmin
    .from('repair_approvals')
    .update({
      status: 'approved',
      approver: req.user?.id || null,
      approver_notes,
      approved_at: new Date().toISOString(),
    })
    .eq('id', request.id)

  res.json({ approved: true, id: request.id })
})

// GET /api/admin/repair/approvals
router.get('/approvals', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('repair_approvals')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ approvals: data || [] })
})

export default router
