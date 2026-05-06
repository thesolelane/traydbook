import { Router } from 'express'
import { supabaseAdmin } from '../lib/clients.js'

const router = Router()

// POST /api/admin/revoke/sessions
router.post('/sessions', async (req, res) => {
  const { user_id, ip_pattern, reason, scope } = req.body

  if (!reason || reason.length < 10) {
    return res.status(400).json({ error: 'Detailed reason required (min 10 chars)' })
  }

  if (!['user', 'ip', 'all'].includes(scope)) {
    return res.status(400).json({ error: 'scope must be user, ip, or all' })
  }

  let affected = 0

  if (scope === 'user') {
    if (!user_id) return res.status(400).json({ error: 'user_id required for scope=user' })
    const { data, error } = await supabaseAdmin
      .from('sessions')
      .delete()
      .eq('user_id', user_id)
      .select()
    if (error) return res.status(500).json({ error: error.message })
    affected = data?.length || 0
  } else if (scope === 'ip') {
    if (!ip_pattern) return res.status(400).json({ error: 'ip_pattern required for scope=ip' })
    const { data, error } = await supabaseAdmin
      .from('sessions')
      .delete()
      .ilike('ip_address', ip_pattern)
      .select()
    if (error) return res.status(500).json({ error: error.message })
    affected = data?.length || 0
  } else if (scope === 'all') {
    if (!req.body.approval_code) {
      return res.status(202).json({
        pending_approval: true,
        message: 'Global session revocation requires a second admin approval code',
      })
    }
    const { data, error } = await supabaseAdmin
      .from('sessions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .select()
    if (error) return res.status(500).json({ error: error.message })
    affected = data?.length || 0
  }

  await supabaseAdmin.from('admin_audit_log').insert({
    action: 'SESSION_REVOKE',
    target_type: scope,
    target_id: user_id || ip_pattern || 'ALL',
    reason,
    admin_id: req.user?.id || null,
    ip: req.ip,
    timestamp: new Date().toISOString(),
    details: { affected_sessions: affected },
  })

  res.json({ revoked: true, scope, affected_sessions: affected })
})

export default router
