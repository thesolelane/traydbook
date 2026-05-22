import { Router } from 'express'
import multer from 'multer'
import { parse } from 'csv-parse/sync'
import { supabaseAdmin } from '../lib/clients.js'
import { requireAuth, requireAnyStaff, requireAdminLevel } from '../lib/auth.js'

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

export default router
