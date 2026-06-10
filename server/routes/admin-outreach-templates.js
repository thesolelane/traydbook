import { Router } from 'express'
import { supabaseAdmin } from '../lib/clients.js'
import { requireAuth, requireAnyStaff, requireAdminLevel, requireServiceKeyOrStaff } from '../lib/auth.js'

const router = Router()

const MERGE_TAGS = ['{{first_name}}', '{{trade}}', '{{city}}', '{{license_number}}', '{{state}}']

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function fillMergeTags(template, prospect) {
  return template
    .replace(/\{\{first_name\}\}/g, escapeHtml(prospect.first_name))
    .replace(/\{\{trade\}\}/g, escapeHtml(prospect.type_class || prospect.general_type))
    .replace(/\{\{city\}\}/g, escapeHtml(prospect.city))
    .replace(/\{\{license_number\}\}/g, escapeHtml(prospect.license_number))
    .replace(/\{\{state\}\}/g, escapeHtml(prospect.state))
}

// ── Templates CRUD ────────────────────────────────────────────────────────────

// GET /api/admin/outreach/templates
router.get('/templates', requireAuth, requireAnyStaff, async (req, res) => {
  const { status, prospect_type } = req.query
  let q = supabaseAdmin
    .from('outreach_templates')
    .select('*')
    .order('created_at', { ascending: false })
  if (status)        q = q.eq('status', status)
  if (prospect_type) q = q.eq('prospect_type', prospect_type)
  const { data, error } = await q
  if (error) return res.status(500).json({ error: error.message })
  res.json({ templates: data || [], merge_tags: MERGE_TAGS })
})

// GET /api/admin/outreach/templates/:id
router.get('/templates/:id', requireAuth, requireAnyStaff, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('outreach_templates')
    .select('*')
    .eq('id', req.params.id)
    .single()
  if (error) return res.status(error.code === 'PGRST116' ? 404 : 500).json({ error: error.message })
  res.json(data)
})

// POST /api/admin/outreach/templates
router.post('/templates', requireAuth, requireAdminLevel, async (req, res) => {
  const { name, prospect_type, subject, body_html, body_text } = req.body
  if (!name || !prospect_type || !subject || !body_html) {
    return res.status(400).json({ error: 'name, prospect_type, subject, and body_html are required' })
  }
  if (!['contractor', 'real_estate_agent'].includes(prospect_type)) {
    return res.status(400).json({ error: 'prospect_type must be contractor or real_estate_agent' })
  }
  const { data, error } = await supabaseAdmin
    .from('outreach_templates')
    .insert({
      name,
      prospect_type,
      subject,
      body_html,
      body_text: body_text || null,
      status: 'draft',
      created_by: req.user?.id || null,
    })
    .select()
    .single()
  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})

// PATCH /api/admin/outreach/templates/:id
router.patch('/templates/:id', requireAuth, requireAdminLevel, async (req, res) => {
  const allowed = ['name', 'prospect_type', 'subject', 'body_html', 'body_text', 'status']
  const updates = { updated_at: new Date().toISOString() }
  for (const k of allowed) {
    if (req.body[k] !== undefined) updates[k] = req.body[k]
  }
  if (updates.prospect_type && !['contractor', 'real_estate_agent'].includes(updates.prospect_type)) {
    return res.status(400).json({ error: 'Invalid prospect_type' })
  }
  if (updates.status && !['draft', 'approved', 'paused'].includes(updates.status)) {
    return res.status(400).json({ error: 'Invalid status' })
  }
  const { data, error } = await supabaseAdmin
    .from('outreach_templates')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// DELETE /api/admin/outreach/templates/:id
router.delete('/templates/:id', requireAuth, requireAdminLevel, async (req, res) => {
  const { error } = await supabaseAdmin
    .from('outreach_templates')
    .delete()
    .eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
})

// ── Send Log ──────────────────────────────────────────────────────────────────

// GET /api/admin/outreach/send-log
router.get('/send-log', requireServiceKeyOrStaff(['outreach:read']), async (req, res) => {
  const { prospect_id, template_id, delivery_status, limit = 100, offset = 0 } = req.query

  let q = supabaseAdmin
    .from('outreach_send_log')
    .select(`
      *,
      prospect:outreach_prospects(id, first_name, last_name, business_name, email_found, prospect_type, city, state),
      template:outreach_templates(id, name, prospect_type)
    `, { count: 'exact' })
    .order('sent_at', { ascending: false })
    .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1)

  if (prospect_id)     q = q.eq('prospect_id', prospect_id)
  if (template_id)     q = q.eq('template_id', template_id)
  if (delivery_status) q = q.eq('delivery_status', delivery_status)

  const { data, error, count } = await q
  if (error) return res.status(500).json({ error: error.message })
  res.json({ logs: data || [], total: count || 0 })
})

// POST /api/admin/outreach/send-log — Bob writes a send record
router.post('/send-log', requireServiceKeyOrStaff(['outreach:write']), async (req, res) => {
  const { prospect_id, template_id, rendered_subject, rendered_body_html, delivery_status, bob_job_id } = req.body
  if (!prospect_id || !template_id || !rendered_subject || !rendered_body_html) {
    return res.status(400).json({ error: 'prospect_id, template_id, rendered_subject, and rendered_body_html are required' })
  }

  const { data: logEntry, error: logError } = await supabaseAdmin
    .from('outreach_send_log')
    .insert({
      prospect_id,
      template_id,
      rendered_subject,
      rendered_body_html,
      delivery_status: delivery_status || 'sent',
      bob_job_id: bob_job_id || null,
    })
    .select()
    .single()

  if (logError) return res.status(500).json({ error: logError.message })

  const { error: patchError } = await supabaseAdmin
    .from('outreach_prospects')
    .update({ status: 'sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', prospect_id)

  if (patchError) console.warn('[send-log] Failed to update prospect status:', patchError.message)

  res.status(201).json(logEntry)
})

// PATCH /api/admin/outreach/send-log/:id — Bob reports a delivery event (bounce, open, click, delivered)
router.patch('/send-log/:id', requireServiceKeyOrStaff(['outreach:write']), async (req, res) => {
  const { id } = req.params
  const { delivery_status, event } = req.body

  const VALID_STATUSES = ['sent', 'delivered', 'bounced', 'failed', 'opened', 'clicked']
  if (delivery_status && !VALID_STATUSES.includes(delivery_status)) {
    return res.status(400).json({ error: `Invalid delivery_status. Must be one of: ${VALID_STATUSES.join(', ')}` })
  }

  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from('outreach_send_log')
    .select('delivery_events')
    .eq('id', id)
    .single()

  if (fetchErr) {
    return res.status(fetchErr.code === 'PGRST116' ? 404 : 500).json({ error: fetchErr.message })
  }

  const updates = { updated_at: new Date().toISOString() }
  if (delivery_status) updates.delivery_status = delivery_status

  if (event || delivery_status) {
    const newEvent = {
      type: (event && event.type) || delivery_status || 'unknown',
      timestamp: (event && event.timestamp) || new Date().toISOString(),
      ...(event && event.metadata ? { metadata: event.metadata } : {}),
    }
    updates.delivery_events = [...(existing.delivery_events || []), newEvent]
  }

  const { data, error } = await supabaseAdmin
    .from('outreach_send_log')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

export default router
