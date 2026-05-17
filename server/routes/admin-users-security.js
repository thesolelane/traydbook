import { Router } from 'express'
import { supabaseAdmin } from '../lib/clients.js'
import { blockProtectedAdmin } from '../lib/auth.js'

const router = Router()

// GET /api/admin/users
router.get('/', async (req, res) => {
  const { status, trade, sort_by, limit = 50 } = req.query

  let query = supabaseAdmin
    .from('users')
    .select('id, email, name, trade_category, status, credits, created_at, last_login')
    .order(sort_by || 'created_at', { ascending: false })
    .limit(parseInt(limit) || 50)

  if (status) query = query.eq('status', status)
  if (trade) query = query.eq('trade_category', trade)

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  res.json({ users: data || [], count: data?.length || 0 })
})

// GET /api/admin/users/:id
router.get('/:id', async (req, res) => {
  const { id } = req.params
  const { data, error } = await supabaseAdmin.from('users').select('*').eq('id', id).single()

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// POST /api/admin/users/:id/ban
router.post('/:id/ban', blockProtectedAdmin, async (req, res) => {
  const { id } = req.params
  const { reason, duration = 'permanent' } = req.body

  if (!reason || reason.length < 10) {
    return res.status(400).json({ error: 'Detailed reason required (min 10 chars)' })
  }

  const { data: before } = await supabaseAdmin.from('users').select('*').eq('id', id).single()
  if (!before) return res.status(404).json({ error: 'User not found' })

  const { data: after, error } = await supabaseAdmin
    .from('users')
    .update({
      status: 'banned',
      banned_at: new Date().toISOString(),
      banned_reason: reason,
      banned_duration: duration,
      banned_by: req.user?.id || 'system',
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })

  await supabaseAdmin.from('sessions').delete().eq('user_id', id)

  await supabaseAdmin.from('admin_audit_log').insert({
    action: 'BAN',
    target_type: 'user',
    target_id: id,
    before_state: before,
    after_state: after,
    reason,
    admin_id: req.user?.id || null,
    ip: req.ip,
    timestamp: new Date().toISOString(),
  })

  res.json({ success: true, user_id: id, action: 'banned', duration })
})

// POST /api/admin/users/:id/hold
router.post('/:id/hold', blockProtectedAdmin, async (req, res) => {
  const { id } = req.params
  const { reason, hold_until } = req.body

  if (!reason || reason.length < 10) {
    return res.status(400).json({ error: 'Detailed reason required' })
  }

  const { data: before } = await supabaseAdmin.from('users').select('*').eq('id', id).single()

  const { data: after, error } = await supabaseAdmin
    .from('users')
    .update({
      status: 'held',
      hold_reason: reason,
      hold_until: hold_until || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      held_by: req.user?.id || 'system',
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })

  await supabaseAdmin.from('admin_audit_log').insert({
    action: 'HOLD',
    target_type: 'user',
    target_id: id,
    before_state: before,
    after_state: after,
    reason,
    admin_id: req.user?.id || null,
    ip: req.ip,
    timestamp: new Date().toISOString(),
  })

  res.json({ success: true, user_id: id, action: 'held' })
})

// POST /api/admin/users/:id/unban
router.post('/:id/unban', blockProtectedAdmin, async (req, res) => {
  const { id } = req.params
  const { reason } = req.body

  const { data: before } = await supabaseAdmin.from('users').select('*').eq('id', id).single()

  const { data: after, error } = await supabaseAdmin
    .from('users')
    .update({ status: 'active', banned_at: null, banned_reason: null })
    .eq('id', id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })

  await supabaseAdmin.from('admin_audit_log').insert({
    action: 'UNBAN',
    target_type: 'user',
    target_id: id,
    before_state: before,
    after_state: after,
    reason: reason || 'Manual unban',
    admin_id: req.user?.id || null,
    ip: req.ip,
    timestamp: new Date().toISOString(),
  })

  res.json({ success: true, user_id: id, action: 'unbanned' })
})

// POST /api/admin/users/:id/adjust-credits
router.post('/:id/adjust-credits', async (req, res) => {
  const { id } = req.params
  const { amount, reason } = req.body

  if (typeof amount !== 'number') {
    return res.status(400).json({ error: 'amount must be a number' })
  }
  if (!reason) {
    return res.status(400).json({ error: 'reason required' })
  }

  const { data: user } = await supabaseAdmin.from('users').select('credits').eq('id', id).single()
  if (!user) return res.status(404).json({ error: 'User not found' })

  const balanceBefore = user.credits || 0
  const balanceAfter = balanceBefore + amount

  const { error } = await supabaseAdmin.from('users').update({ credits: balanceAfter }).eq('id', id)

  if (error) return res.status(500).json({ error: error.message })

  await supabaseAdmin.from('credit_transactions').insert({
    user_id: id,
    amount,
    reason,
    balance_before: balanceBefore,
    balance_after: balanceAfter,
    admin_id: req.user?.id || null,
    timestamp: new Date().toISOString(),
  })

  await supabaseAdmin.from('admin_audit_log').insert({
    action: 'ADJUST_CREDITS',
    target_type: 'user',
    target_id: id,
    reason,
    admin_id: req.user?.id || null,
    ip: req.ip,
    timestamp: new Date().toISOString(),
    details: { amount, balance_before: balanceBefore, balance_after: balanceAfter },
  })

  res.json({
    success: true,
    user_id: id,
    balance_before: balanceBefore,
    balance_after: balanceAfter,
  })
})

export default router
