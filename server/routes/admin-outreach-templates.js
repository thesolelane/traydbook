import { Router } from 'express'
import { supabaseAdmin } from '../lib/clients.js'
import { requireAuth, requireAnyStaff, requireAdminLevel, requireServiceKeyOrStaff } from '../lib/auth.js'
import { generateUnsubscribeToken } from '../lib/unsubscribe-token.js'
import { appendEmailFooter } from '../lib/email-footer.js'

const router = Router()

const MERGE_TAGS = ['{{first_name}}', '{{trade}}', '{{city}}', '{{license_number}}', '{{state}}', '{{unsubscribe_url}}']

const APP_ORIGIN = () => process.env.APP_ORIGIN || 'https://app.traydbook.com'

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function buildUnsubscribeUrl(email) {
  if (!email) return ''
  const token = generateUnsubscribeToken(email)
  return `${APP_ORIGIN()}/api/outreach/unsubscribe?token=${encodeURIComponent(token)}`
}

function fillMergeTags(template, prospect) {
  return template
    .replace(/\{\{first_name\}\}/g, escapeHtml(prospect.first_name))
    .replace(/\{\{trade\}\}/g, escapeHtml(prospect.type_class || prospect.general_type))
    .replace(/\{\{city\}\}/g, escapeHtml(prospect.city))
    .replace(/\{\{license_number\}\}/g, escapeHtml(prospect.license_number))
    .replace(/\{\{state\}\}/g, escapeHtml(prospect.state))
    .replace(/\{\{unsubscribe_url\}\}/g, buildUnsubscribeUrl(prospect.email_found))
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
  const VALID_TYPES = ['contractor', 'homeowner', 'real_estate_agent', 'investor_flipper', 'investor_buy_hold', 'other']
  if (!VALID_TYPES.includes(prospect_type)) {
    return res.status(400).json({ error: `prospect_type must be one of: ${VALID_TYPES.join(', ')}` })
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
  const VALID_TYPES = ['contractor', 'homeowner', 'real_estate_agent', 'investor_flipper', 'investor_buy_hold', 'other']
  if (updates.prospect_type && !VALID_TYPES.includes(updates.prospect_type)) {
    return res.status(400).json({ error: `Invalid prospect_type. Must be one of: ${VALID_TYPES.join(', ')}` })
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
  const { prospect_id, template_id, rendered_subject, rendered_body_html, rendered_body_text, delivery_status, bob_job_id } = req.body
  if (!prospect_id || !template_id || !rendered_subject || !rendered_body_html) {
    return res.status(400).json({ error: 'prospect_id, template_id, rendered_subject, and rendered_body_html are required' })
  }

  // Suppression guard — reject if the prospect's email is in outreach_unsubscribes
  // (covers both manual opt-outs and auto-suppressed bounces)
  const { data: prospect, error: prospectErr } = await supabaseAdmin
    .from('outreach_prospects')
    .select('email_found')
    .eq('id', prospect_id)
    .single()

  if (prospectErr) return res.status(500).json({ error: 'Failed to look up prospect: ' + prospectErr.message })

  if (prospect && prospect.email_found) {
    const { data: suppressed } = await supabaseAdmin
      .from('outreach_unsubscribes')
      .select('email, source')
      .eq('email', prospect.email_found.toLowerCase())
      .maybeSingle()

    if (suppressed) {
      return res.status(422).json({
        error: 'Suppressed address',
        reason: suppressed.source === 'bounce' ? 'Email has previously bounced' : 'Email has opted out',
        email: prospect.email_found,
      })
    }
  }

  // Build unsubscribe URL and append CAN-SPAM footer to rendered body
  const unsubUrl = prospect?.email_found ? buildUnsubscribeUrl(prospect.email_found) : ''
  const { html: footeredHtml, text: footeredText } = appendEmailFooter(rendered_body_html, rendered_body_text || null, unsubUrl)

  const { data: logEntry, error: logError } = await supabaseAdmin
    .from('outreach_send_log')
    .insert({
      prospect_id,
      template_id,
      rendered_subject,
      rendered_body_html: footeredHtml,
      rendered_body_text: footeredText || null,
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
    .select('delivery_events, prospect_id')
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

  // Auto-suppress bounced addresses and mark prospect as bounced
  if (delivery_status === 'bounced' && existing.prospect_id) {
    const { data: prospect } = await supabaseAdmin
      .from('outreach_prospects')
      .select('email_found')
      .eq('id', existing.prospect_id)
      .single()

    if (prospect && prospect.email_found) {
      const email = prospect.email_found.toLowerCase()
      const { error: upsertErr } = await supabaseAdmin
        .from('outreach_unsubscribes')
        .upsert({ email, source: 'bounce', unsubscribed_at: new Date().toISOString() }, { onConflict: 'email' })
      if (upsertErr) {
        console.warn('[send-log] Failed to suppress bounced email:', upsertErr.message)
      }
    }

    const { error: prospectErr } = await supabaseAdmin
      .from('outreach_prospects')
      .update({ status: 'bounced', updated_at: new Date().toISOString() })
      .eq('id', existing.prospect_id)
    if (prospectErr) {
      console.warn('[send-log] Failed to mark prospect as bounced:', prospectErr.message)
    }
  }

  res.json(data)
})

// ── Unsubscribes ──────────────────────────────────────────────────────────────

// GET /api/admin/outreach/unsubscribes
router.get('/unsubscribes', requireAuth, requireAnyStaff, async (req, res) => {
  const { limit = 100, offset = 0 } = req.query
  const { data, error, count } = await supabaseAdmin
    .from('outreach_unsubscribes')
    .select('*', { count: 'exact' })
    .order('unsubscribed_at', { ascending: false })
    .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ unsubscribes: data || [], total: count || 0 })
})

// DELETE /api/admin/outreach/unsubscribes/:email — remove a single opt-out
router.delete('/unsubscribes/:email', requireAuth, requireAdminLevel, async (req, res) => {
  const email = decodeURIComponent(req.params.email).toLowerCase()
  const { error } = await supabaseAdmin
    .from('outreach_unsubscribes')
    .delete()
    .eq('email', email)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true, email })
})

// DELETE /api/admin/outreach/unsubscribes — bulk remove by email array
router.delete('/unsubscribes', requireAuth, requireAdminLevel, async (req, res) => {
  const { emails } = req.body
  if (!Array.isArray(emails) || emails.length === 0) {
    return res.status(400).json({ error: 'emails array is required' })
  }
  const normalized = emails.map(e => String(e).toLowerCase().trim()).filter(Boolean)
  const { error, count } = await supabaseAdmin
    .from('outreach_unsubscribes')
    .delete({ count: 'exact' })
    .in('email', normalized)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true, removed: count ?? normalized.length })
})

export default router
