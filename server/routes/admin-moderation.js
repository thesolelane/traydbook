import { Router } from 'express'
import { supabaseAdmin } from '../lib/clients.js'

const router = Router()

// GET /api/admin/moderation/queue
router.get('/queue', async (req, res) => {
  const { status, type, ai_flagged, limit = 50 } = req.query

  let query = supabaseAdmin
    .from('content_moderation_queue')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(parseInt(limit) || 50)

  if (status) query = query.eq('status', status)
  if (type) query = query.eq('content_type', type)
  if (ai_flagged === 'true') query = query.not('ai_analysis', 'is', null)

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  res.json({ items: data || [], count: data?.length || 0 })
})

// POST /api/admin/moderation/:id/resolve
router.post('/:id/resolve', async (req, res) => {
  const { id } = req.params
  const { decision, admin_notes } = req.body

  if (!['approve', 'reject', 'escalate'].includes(decision)) {
    return res.status(400).json({ error: 'Invalid decision — use approve, reject, or escalate' })
  }

  const { data: item } = await supabaseAdmin
    .from('content_moderation_queue')
    .select('*')
    .eq('id', id)
    .single()

  if (!item) return res.status(404).json({ error: 'Item not found' })

  if (item.content_table) {
    if (decision === 'reject') {
      await supabaseAdmin
        .from(item.content_table)
        .update({
          status: 'rejected',
          rejected_at: new Date().toISOString(),
          rejected_reason: admin_notes,
        })
        .eq('id', item.content_id)
    } else if (decision === 'approve') {
      await supabaseAdmin
        .from(item.content_table)
        .update({ status: 'active' })
        .eq('id', item.content_id)
    }
  }

  await supabaseAdmin
    .from('content_moderation_queue')
    .update({
      status: 'resolved',
      decision,
      resolved_by: req.user?.id || null,
      resolved_at: new Date().toISOString(),
      admin_notes,
    })
    .eq('id', id)

  await supabaseAdmin.from('admin_audit_log').insert({
    action: 'MODERATE',
    target_type: item.content_type,
    target_id: item.content_id,
    reason: `${decision}: ${admin_notes || ''}`,
    admin_id: req.user?.id || null,
    ip: req.ip,
    timestamp: new Date().toISOString(),
  })

  res.json({ success: true, id, decision })
})

// POST /api/admin/moderation/flag
router.post('/flag', async (req, res) => {
  const { content_type, content_id, content_table, reason } = req.body

  if (!content_type || !content_id || !reason) {
    return res.status(400).json({ error: 'content_type, content_id, and reason required' })
  }

  const { data, error } = await supabaseAdmin
    .from('content_moderation_queue')
    .insert({
      content_type,
      content_id,
      content_table: content_table || content_type + 's',
      reporter_id: req.user?.id || null,
      status: 'pending',
      created_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json({ flagged: true, queue_id: data.id })
})

export default router
