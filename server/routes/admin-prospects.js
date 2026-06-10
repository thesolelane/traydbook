import { Router } from 'express'
import multer from 'multer'
import { parse } from 'csv-parse/sync'
import { supabaseAdmin } from '../lib/clients.js'
import { requireAuth, requireAnyStaff, requireAdminLevel, requireServiceKeyOrStaff } from '../lib/auth.js'

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

function normalizeRow(row, prospectType, batchId, adminId) {
  const g = k => {
    const key = Object.keys(row).find(r => r.trim().toUpperCase() === k.toUpperCase())
    return key ? (row[key] || '').toString().trim() : ''
  }

  const parseDate = s => {
    if (!s) return null
    const d = new Date(s)
    return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0]
  }

  return {
    prospect_type:      prospectType,
    board_code:         g('BOARD_CODE'),
    type_class:         g('TYPE_CLASS'),
    business_name:      g('BUSINESS_NAME') || g('BUSINESS_N'),
    first_name:         g('FIRST_NAME'),
    middle_initial:     g('MI') || g('MIDDLE_INITIAL'),
    last_name:          g('LAST_NAME'),
    general_type:       g('GENERAL') || g('GENERA') || g('GENERAL_TYPE'),
    address1:           g('ADDRESS1'),
    address2:           g('ADDRESS2'),
    city:               g('CITY'),
    state:              g('STATE'),
    zip_code:           g('ZIP_CODE') || g('ZIP'),
    license_number:     g('LICENSE_NUMBER') || g('LICENSE_NU') || g('LIC_NUM'),
    license_issued:     parseDate(g('ISSUED') || g('LICENSE_ISSUED')),
    license_expiration: parseDate(g('EXPIRATION') || g('LICENSE_EXPIRATION') || g('EXPIRATION_DATE')),
    status_description: g('STATUS_DESCRIPTION') || g('STATUS_DESC') || g('STATUS'),
    status:             'pending',
    import_batch:       batchId,
    imported_by:        adminId || null,
  }
}

// POST /api/admin/prospects/upload
router.post('/upload', requireAuth, requireAdminLevel, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

  const prospectType = req.body.prospect_type || 'contractor'
  if (!['contractor', 'real_estate_agent', 'other'].includes(prospectType)) {
    return res.status(400).json({ error: 'Invalid prospect_type' })
  }

  let rows
  try {
    rows = parse(req.file.buffer.toString('utf-8'), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    })
  } catch (e) {
    return res.status(400).json({ error: `CSV parse error: ${e.message}` })
  }

  if (!rows.length) return res.status(400).json({ error: 'CSV is empty' })

  const batchId = `batch_${Date.now()}`
  const adminId = req.user?.id || null
  const records = rows.map(r => normalizeRow(r, prospectType, batchId, adminId))

  const { data, error } = await supabaseAdmin
    .from('outreach_prospects')
    .upsert(records, {
      onConflict: 'license_number,prospect_type',
      ignoreDuplicates: false,
    })
    .select('id')

  if (error) return res.status(500).json({ error: error.message })

  await supabaseAdmin.from('admin_audit_log').insert({
    action: 'PROSPECT_IMPORT',
    target_type: 'outreach_prospects',
    target_id: null,
    reason: `Imported ${records.length} ${prospectType} prospects — batch ${batchId}`,
    admin_id: adminId,
    ip: req.ip,
    timestamp: new Date().toISOString(),
  })

  res.json({ imported: records.length, batch_id: batchId, skipped: records.length - (data?.length || records.length) })
})

// GET /api/admin/prospects — list with filters
router.get('/', requireAuth, requireAnyStaff, async (req, res) => {
  const { status, prospect_type, state, batch, limit = 100, offset = 0 } = req.query

  let q = supabaseAdmin
    .from('outreach_prospects')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1)

  if (status)        q = q.eq('status', status)
  if (prospect_type) q = q.eq('prospect_type', prospect_type)
  if (state)         q = q.eq('state', state)
  if (batch)         q = q.eq('import_batch', batch)

  const { data, error, count } = await q
  if (error) return res.status(500).json({ error: error.message })
  res.json({ prospects: data || [], total: count || 0 })
})

// GET /api/admin/prospects/stats
router.get('/stats', requireAuth, requireAnyStaff, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('outreach_prospects')
    .select('status, prospect_type')

  if (error) return res.status(500).json({ error: error.message })

  const stats = { total: data.length, by_status: {}, by_type: {} }
  for (const row of data) {
    stats.by_status[row.status] = (stats.by_status[row.status] || 0) + 1
    stats.by_type[row.prospect_type] = (stats.by_type[row.prospect_type] || 0) + 1
  }
  res.json(stats)
})

// GET /api/admin/prospects/work-queue — Bob fetches pending prospects + matching approved template
router.get('/work-queue', requireServiceKeyOrStaff(['outreach:read']), async (req, res) => {
  const { limit = 50 } = req.query

  const [prospectsResult, templatesResult] = await Promise.all([
    supabaseAdmin
      .from('outreach_prospects')
      .select('id, prospect_type, first_name, last_name, business_name, city, state, license_number, type_class, general_type, email_found')
      .eq('status', 'enriched')
      .not('email_found', 'is', null)
      .order('created_at', { ascending: true })
      .limit(parseInt(limit)),
    supabaseAdmin
      .from('outreach_templates')
      .select('*')
      .eq('status', 'approved')
      .order('updated_at', { ascending: false }),
  ])

  if (prospectsResult.error) return res.status(500).json({ error: prospectsResult.error.message })
  if (templatesResult.error) return res.status(500).json({ error: templatesResult.error.message })

  const prospects = prospectsResult.data || []
  const templates = templatesResult.data || []

  // Pick the most recently updated approved template per prospect_type
  const templateByType = {}
  for (const t of templates) {
    if (!templateByType[t.prospect_type]) templateByType[t.prospect_type] = t
  }

  function fillTags(str, p) {
    return str
      .replace(/\{\{first_name\}\}/g, escapeHtml(p.first_name))
      .replace(/\{\{trade\}\}/g, escapeHtml(p.type_class || p.general_type))
      .replace(/\{\{city\}\}/g, escapeHtml(p.city))
      .replace(/\{\{license_number\}\}/g, escapeHtml(p.license_number))
      .replace(/\{\{state\}\}/g, escapeHtml(p.state))
  }

  const queue = prospects
    .map(p => {
      const tmpl = templateByType[p.prospect_type]
      if (!tmpl) return null
      return {
        prospect: p,
        template: { id: tmpl.id, name: tmpl.name, prospect_type: tmpl.prospect_type },
        rendered_subject: fillTags(tmpl.subject, p),
        rendered_body_html: fillTags(tmpl.body_html, p),
        rendered_body_text: tmpl.body_text ? fillTags(tmpl.body_text, p) : null,
      }
    })
    .filter(Boolean)

  res.json({ queue, total: queue.length })
})

// PATCH /api/admin/prospects/:id — update a single prospect
router.patch('/:id', requireAuth, requireAdminLevel, async (req, res) => {
  const { id } = req.params
  const allowed = ['status', 'email_found', 'email_subject', 'email_body', 'skip_reason', 'bob_notes', 'sent_at', 'replied_at', 'reply_notes']
  const updates = {}
  for (const k of allowed) {
    if (req.body[k] !== undefined) updates[k] = req.body[k]
  }
  updates.updated_at = new Date().toISOString()

  const { data, error } = await supabaseAdmin
    .from('outreach_prospects')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// DELETE /api/admin/prospects/batch/:batchId — delete an entire import batch
router.delete('/batch/:batchId', requireAuth, requireAdminLevel, async (req, res) => {
  const { batchId } = req.params
  const { error, count } = await supabaseAdmin
    .from('outreach_prospects')
    .delete({ count: 'exact' })
    .eq('import_batch', batchId)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ deleted: count, batch_id: batchId })
})

// ── Template CRUD ────────────────────────────────────────────────────────────

// GET /api/admin/prospects/templates
router.get('/templates', requireAuth, requireAnyStaff, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('outreach_templates')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.json(data || [])
})

// POST /api/admin/prospects/templates
router.post('/templates', requireAuth, requireAdminLevel, async (req, res) => {
  const { name, prospect_type, subject, body_text, status } = req.body
  if (!name || !subject || !body_text) {
    return res.status(400).json({ error: 'name, subject, and body_text are required' })
  }
  const { data, error } = await supabaseAdmin
    .from('outreach_templates')
    .insert({
      name,
      prospect_type: prospect_type || 'contractor',
      subject,
      body_text,
      status: status || 'draft',
      created_by: req.user?.id || null,
    })
    .select()
    .single()
  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})

// PATCH /api/admin/prospects/templates/:id
router.patch('/templates/:id', requireAuth, requireAdminLevel, async (req, res) => {
  const { id } = req.params
  const allowed = ['name', 'prospect_type', 'subject', 'body_text', 'status']
  const updates = {}
  for (const k of allowed) {
    if (req.body[k] !== undefined) updates[k] = req.body[k]
  }
  updates.updated_at = new Date().toISOString()

  const { data, error } = await supabaseAdmin
    .from('outreach_templates')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// DELETE /api/admin/prospects/templates/:id
router.delete('/templates/:id', requireAuth, requireAdminLevel, async (req, res) => {
  const { id } = req.params
  const { error } = await supabaseAdmin
    .from('outreach_templates')
    .delete()
    .eq('id', id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ deleted: id })
})

// ── Bob work-queue ───────────────────────────────────────────────────────────

// GET /api/admin/prospects/work-queue
// Returns up to `limit` prospects (enriched or pending-with-email) paired with
// the matching approved template so Bob can fill merge tags and send.
router.get('/work-queue', requireAuth, requireAnyStaff, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 25, 100)

  const [prospectsResult, templatesResult] = await Promise.all([
    supabaseAdmin
      .from('outreach_prospects')
      .select('*')
      .in('status', ['pending', 'enriched'])
      .not('email_found', 'is', null)
      .order('created_at', { ascending: true })
      .limit(limit),
    supabaseAdmin
      .from('outreach_templates')
      .select('*')
      .eq('status', 'approved'),
  ])

  if (prospectsResult.error) return res.status(500).json({ error: prospectsResult.error.message })
  if (templatesResult.error) return res.status(500).json({ error: templatesResult.error.message })

  const templates = templatesResult.data || []
  const templateByType = {}
  for (const t of templates) {
    if (!templateByType[t.prospect_type]) templateByType[t.prospect_type] = t
  }

  const items = (prospectsResult.data || [])
    .map(p => {
      const template = templateByType[p.prospect_type] || templateByType['other'] || null
      return { prospect: p, template }
    })
    .filter(item => item.template !== null)

  res.json({ items, total: items.length })
})

// ── Send log ─────────────────────────────────────────────────────────────────

// POST /api/admin/prospects/send-log — Bob logs a completed send
router.post('/send-log', requireAuth, requireAnyStaff, async (req, res) => {
  const { prospect_id, template_id, rendered_subject, rendered_body, delivery_status, bob_job_id, notes } = req.body
  if (!prospect_id) return res.status(400).json({ error: 'prospect_id is required' })

  const { data, error } = await supabaseAdmin
    .from('outreach_send_log')
    .insert({
      prospect_id,
      template_id: template_id || null,
      rendered_subject,
      rendered_body,
      delivery_status: delivery_status || 'sent',
      bob_job_id: bob_job_id || null,
      notes: notes || null,
    })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })

  // Mark the prospect as sent
  await supabaseAdmin
    .from('outreach_prospects')
    .update({ status: 'sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', prospect_id)

  res.status(201).json(data)
})

// GET /api/admin/prospects/send-log — admin views send history
router.get('/send-log', requireAuth, requireAnyStaff, async (req, res) => {
  const { prospect_id, template_id, limit = 50, offset = 0 } = req.query

  let q = supabaseAdmin
    .from('outreach_send_log')
    .select(`
      *,
      outreach_prospects ( first_name, last_name, business_name, email_found, prospect_type ),
      outreach_templates ( name, prospect_type )
    `, { count: 'exact' })
    .order('sent_at', { ascending: false })
    .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1)

  if (prospect_id) q = q.eq('prospect_id', prospect_id)
  if (template_id) q = q.eq('template_id', template_id)

  const { data, error, count } = await q
  if (error) return res.status(500).json({ error: error.message })
  res.json({ logs: data || [], total: count || 0 })
})

export default router
