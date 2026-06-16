import { Router } from 'express'
import multer from 'multer'
import { parse } from 'csv-parse/sync'
import { supabaseAdmin } from '../lib/clients.js'
import { runProspectMatch, getMatchStatus } from '../lib/prospect-match.js'
import {
  requireAuth,
  requireAnyStaff,
  requireAdminLevel,
  requireServiceKeyOrStaff,
} from '../lib/auth.js'
import { generateUnsubscribeToken } from '../lib/unsubscribe-token.js'
import { appendEmailFooter } from '../lib/email-footer.js'

const APP_ORIGIN = () => process.env.APP_ORIGIN || 'https://app.traydbook.com'

function buildUnsubscribeUrl(email) {
  if (!email) return ''
  const token = generateUnsubscribeToken(email)
  return `${APP_ORIGIN()}/api/outreach/unsubscribe?token=${encodeURIComponent(token)}`
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } })

// In-memory import job tracker (single-instance admin server)
const importJobs = new Map()
// { batchId: { total, processed, done, error, imported } }

const BOARD_TO_GENERAL = {
  EL: 'Electrical',
  PL: 'Plumbing',
  EN: 'Engineering',
  SM: 'Sheet Metal',
  GF: 'Gas',
  FA: 'Fire Alarm',
  HI: 'Home Inspection',
  AR: 'Architecture',
}

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
    prospect_type: prospectType,
    board_code: g('BOARD_CODE'),
    type_class: g('TYPE_CLASS'),
    business_name: g('BUSINESS_NAME') || g('BUSINESS_N'),
    first_name: g('FIRST_NAME'),
    middle_initial: g('MI') || g('MIDDLE_INITIAL'),
    last_name: g('LAST_NAME'),
    general_type:
      g('GENERAL') || g('GENERA') || g('GENERAL_TYPE') ||
      BOARD_TO_GENERAL[g('BOARD_CODE').toUpperCase()] || '',
    address1: g('ADDRESS1'),
    address2: g('ADDRESS2'),
    city: g('CITY'),
    state: g('STATE'),
    zip_code: g('ZIP_CODE') || g('ZIP'),
    license_number: g('LICENSE_NUMBER') || g('LICENSE_NU') || g('LIC_NUM'),
    license_issued: parseDate(g('ISSUED') || g('LICENSE_ISSUED')),
    license_expiration: parseDate(
      g('EXPIRATION') || g('LICENSE_EXPIRATION') || g('EXPIRATION_DATE')
    ),
    status_description: g('STATUS_DESCRIPTION') || g('STATUS_DESC') || g('STATUS'),
    status: 'pending',
    import_batch: batchId,
    imported_by: adminId || null,
    // Dedup key: same first+last+zip = same person, even across multiple licenses
    person_key:
      (g('FIRST_NAME') || '').toLowerCase().trim() +
      '|' +
      (g('LAST_NAME') || '').toLowerCase().trim() +
      '|' +
      ((g('ZIP_CODE') || g('ZIP')) || '').trim(),
  }
}

// Multer error → always return JSON (never HTML)
function handleUpload(req, res, next) {
  upload.single('file')(req, res, err => {
    if (!err) return next()
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res
        .status(413)
        .json({ error: `File too large — maximum 50MB allowed (your file exceeded the limit)` })
    }
    return res.status(400).json({ error: err.message || 'Upload error' })
  })
}

// POST /api/admin/prospects/upload
router.post('/upload', requireAuth, requireAdminLevel, handleUpload, async (req, res) => {
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
  // 5 000 rows per chunk → ~24 API calls for a 121k file instead of 121.
  // Keeps well under Supabase's REST rate limits; ~1.5 MB payload per chunk
  // is comfortably within PostgREST's default body limit.
  const CHUNK_SIZE = 5000
  const CHUNK_SLEEP_MS = 1200 // 1.2 s between chunks ≈ <1 req/s sustained

  // Register the job immediately so the UI can start polling
  importJobs.set(batchId, {
    total: records.length,
    processed: 0,
    imported: 0,
    done: false,
    error: null,
  })

  // Respond right away — don't wait for Supabase inserts (avoids Traefik timeout)
  res.status(202).json({ batch_id: batchId, total: records.length, status: 'processing' })

  // Process chunks in the background after the response is sent
  ;(async () => {
    const job = importJobs.get(batchId)
    let totalInserted = 0
    const sleep = ms => new Promise(r => setTimeout(r, ms))
    try {
      for (let i = 0; i < records.length; i += CHUNK_SIZE) {
        const chunk = records.slice(i, i + CHUNK_SIZE)
        // Up to 5 attempts with exponential back-off on 429
        let chunkData, error
        for (let attempt = 0; attempt < 5; attempt++) {
          ;({ data: chunkData, error } = await supabaseAdmin
            .from('outreach_prospects')
            .upsert(chunk, { onConflict: 'license_number,prospect_type', ignoreDuplicates: true }))
          if (!error) break
          if (error.code === '429' || error.message?.includes('Too Many Requests')) {
            const wait = 5000 * Math.pow(2, attempt) // 5s, 10s, 20s, 40s, 80s
            await sleep(wait)
          } else {
            break
          }
        }
        if (error) {
          job.error = error.message
          job.done = true
          return
        }
        totalInserted += chunkData?.length ?? chunk.length
        job.processed = Math.min(i + CHUNK_SIZE, records.length)
        job.imported = totalInserted
        if (i + CHUNK_SIZE < records.length) await sleep(CHUNK_SLEEP_MS)
      }
      await supabaseAdmin.from('admin_audit_log').insert({
        action: 'PROSPECT_IMPORT',
        target_type: 'outreach_prospects',
        target_id: null,
        reason: `Imported ${records.length} ${prospectType} prospects — batch ${batchId}`,
        admin_id: adminId,
        ip: req.ip,
        timestamp: new Date().toISOString(),
      })
      job.processed = records.length
      job.imported = totalInserted
      job.done = true
    } catch (e) {
      job.error = e.message
      job.done = true
    }
    // Clean up job state after 30 minutes
    setTimeout(() => importJobs.delete(batchId), 30 * 60 * 1000)
  })()
})

// GET /api/admin/prospects/import-status/:batchId — poll import progress
router.get('/import-status/:batchId', requireAuth, requireAdminLevel, (req, res) => {
  const job = importJobs.get(req.params.batchId)
  if (!job) return res.status(404).json({ error: 'Job not found' })
  res.json(job)
})

// GET /api/admin/prospects — list with filters
router.get('/', requireAuth, requireAnyStaff, async (req, res) => {
  const { status, prospect_type, type_class, state, batch, limit = 100, offset = 0 } = req.query

  let q = supabaseAdmin
    .from('outreach_prospects')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1)

  if (status) q = q.eq('status', status)
  if (prospect_type) q = q.eq('prospect_type', prospect_type)
  if (type_class) q = q.eq('type_class', type_class)
  if (state) q = q.eq('state', state)
  if (batch) q = q.eq('import_batch', batch)

  const { data, error, count } = await q
  if (error) return res.status(500).json({ error: error.message })
  res.json({ prospects: data || [], total: count || 0 })
})

// GET /api/admin/prospects/type-classes — distinct type_class values for filter dropdown
router.get('/type-classes', requireAuth, requireAnyStaff, async (req, res) => {
  const { prospect_type } = req.query
  let q = supabaseAdmin
    .from('outreach_prospects')
    .select('type_class')
    .not('type_class', 'is', null)
    .neq('type_class', '')
    .limit(250000) // override Supabase's 1000-row default — must scan all rows for distinct values
  if (prospect_type) q = q.eq('prospect_type', prospect_type)
  const { data, error } = await q
  if (error) return res.status(500).json({ error: error.message })
  const classes = [...new Set((data || []).map(r => r.type_class).filter(Boolean))].sort()
  res.json({ type_classes: classes })
})

// HEAD count helper — returns exact count with zero rows transferred
async function headCount(query) {
  const { count, error } = await query.select('*', { count: 'exact', head: true })
  return error ? 0 : (count ?? 0)
}

// GET /api/admin/prospects/stats — sequential HEAD counts (no row data transferred)
router.get('/stats', requireAuth, requireAnyStaff, async (req, res) => {
  const tbl = () => supabaseAdmin.from('outreach_prospects')

  // Total first, then statuses + types sequentially to avoid request burst
  const total = await headCount(tbl())

  const statuses = ['pending', 'enriched', 'drafted', 'sent', 'replied', 'skipped', 'bounced']
  const by_status = {}
  for (const s of statuses) {
    by_status[s] = await headCount(tbl().eq('status', s))
  }

  const types = ['contractor', 'real_estate_agent', 'other']
  const by_type = {}
  for (const t of types) {
    by_type[t] = await headCount(tbl().eq('prospect_type', t))
  }

  // Unique people — distinct person_key values (single column, so transfer is small)
  const { data: keyRows } = await tbl()
    .select('person_key')
    .not('person_key', 'is', null)
    .limit(250000)
  const unique_people = new Set((keyRows || []).map(r => r.person_key)).size

  res.json({ total, unique_people, by_status, by_type })
})

// GET /api/admin/prospects/work-queue — Bob fetches pending prospects + matching approved template
router.get('/work-queue', requireServiceKeyOrStaff(['outreach:read']), async (req, res) => {
  const { limit = 50 } = req.query

  // Fetch already-sent prospect IDs to exclude them from the work queue.
  // This guards against duplicate sends when Bob crashes mid-batch or retries
  // before the status flip lands (server-side dedup; DB-level UNIQUE constraint
  // on outreach_send_log.prospect_id is the last line of defence).
  const sentLogResult = await supabaseAdmin.from('outreach_send_log').select('prospect_id')

  if (sentLogResult.error) return res.status(500).json({ error: sentLogResult.error.message })

  const sentProspectIds = (sentLogResult.data || []).map(r => r.prospect_id)

  // Explicitly exclude bounced and skipped prospects in addition to the
  // enriched-only filter. The enriched filter is the primary gate, but the
  // NOT IN guard below is intentional: it makes the exclusion ironclad against
  // race conditions where a prospect is fetched, sent to, then bounces before
  // the status flip lands — and guards against re-imported duplicates being
  // served again if a record is ever reset to a sendable status.
  let prospectsQuery = supabaseAdmin
    .from('outreach_prospects')
    .select(
      'id, prospect_type, first_name, last_name, business_name, city, state, license_number, type_class, general_type, email_found'
    )
    .eq('status', 'enriched')
    .not('status', 'in', '("bounced","skipped")')
    .not('email_found', 'is', null)
    .order('created_at', { ascending: true })
    .limit(parseInt(limit))

  if (sentProspectIds.length > 0) {
    prospectsQuery = prospectsQuery.not('id', 'in', `(${sentProspectIds.join(',')})`)
  }

  const [prospectsResult, templatesResult, unsubscribesResult] = await Promise.all([
    prospectsQuery,
    supabaseAdmin
      .from('outreach_templates')
      .select('*')
      .eq('status', 'approved')
      .order('updated_at', { ascending: false }),
    supabaseAdmin.from('outreach_unsubscribes').select('email'),
  ])

  if (prospectsResult.error) return res.status(500).json({ error: prospectsResult.error.message })
  if (templatesResult.error) return res.status(500).json({ error: templatesResult.error.message })

  const prospects = prospectsResult.data || []
  const templates = templatesResult.data || []

  // Build a lowercase set of unsubscribed emails for O(1) lookup
  const unsubscribedEmails = new Set(
    (unsubscribesResult.data || []).map(r => r.email.toLowerCase())
  )

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
      .replace(/\{\{unsubscribe_url\}\}/g, buildUnsubscribeUrl(p.email_found))
  }

  const queue = prospects
    .filter(p => !unsubscribedEmails.has((p.email_found || '').toLowerCase()))
    .map(p => {
      const tmpl = templateByType[p.prospect_type]
      if (!tmpl) return null
      const unsubUrl = buildUnsubscribeUrl(p.email_found)
      const rawHtml = fillTags(tmpl.body_html, p)
      const rawText = tmpl.body_text ? fillTags(tmpl.body_text, p) : null
      const { html: renderedHtml, text: renderedText } = appendEmailFooter(
        rawHtml,
        rawText,
        unsubUrl
      )
      return {
        prospect: p,
        template: { id: tmpl.id, name: tmpl.name, prospect_type: tmpl.prospect_type },
        rendered_subject: fillTags(tmpl.subject, p),
        rendered_body_html: renderedHtml,
        rendered_body_text: renderedText,
      }
    })
    .filter(Boolean)

  res.json({ queue, total: queue.length })
})

// PATCH /api/admin/prospects/:id — update a single prospect
router.patch('/:id', requireAuth, requireAdminLevel, async (req, res) => {
  const { id } = req.params
  const allowed = [
    'status',
    'email_found',
    'email_subject',
    'email_body',
    'skip_reason',
    'bob_notes',
    'sent_at',
    'replied_at',
    'reply_notes',
  ]
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
  const { error } = await supabaseAdmin.from('outreach_templates').delete().eq('id', id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ deleted: id })
})

// ── Bob work-queue ───────────────────────────────────────────────────────────

// GET /api/admin/prospects/work-queue
// Returns up to `limit` prospects (enriched or pending-with-email) paired with
// the matching approved template so Bob can fill merge tags and send.
router.get('/work-queue', requireAuth, requireAnyStaff, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 25, 100)

  const [prospectsResult, templatesResult, unsubscribesResult, contactedKeysResult] =
    await Promise.all([
      supabaseAdmin
        .from('outreach_prospects')
        .select('*')
        .in('status', ['pending', 'enriched'])
        .not('email_found', 'is', null)
        .order('created_at', { ascending: true })
        .limit(limit * 10), // fetch extra so person_key dedup still yields `limit` results
      supabaseAdmin.from('outreach_templates').select('*').eq('status', 'approved'),
      supabaseAdmin.from('outreach_unsubscribes').select('email'),
      // All person_keys already contacted — used to skip duplicate people
      supabaseAdmin
        .from('outreach_prospects')
        .select('person_key')
        .in('status', ['sent', 'replied', 'bounced'])
        .not('person_key', 'is', null)
        .limit(250000),
    ])

  if (prospectsResult.error) return res.status(500).json({ error: prospectsResult.error.message })
  if (templatesResult.error) return res.status(500).json({ error: templatesResult.error.message })

  const templates = templatesResult.data || []
  const templateByType = {}
  for (const t of templates) {
    if (!templateByType[t.prospect_type]) templateByType[t.prospect_type] = t
  }

  const unsubscribedEmails = new Set(
    (unsubscribesResult.data || []).map(r => r.email.toLowerCase())
  )

  // Build the set of person_keys Bob has already reached out to
  const contactedPersonKeys = new Set(
    (contactedKeysResult.data || []).map(r => r.person_key).filter(Boolean)
  )

  const items = (prospectsResult.data || [])
    .filter(p => !unsubscribedEmails.has((p.email_found || '').toLowerCase()))
    .filter(p => !p.person_key || !contactedPersonKeys.has(p.person_key)) // skip already-contacted people
    .slice(0, limit)
    .map(p => {
      const template = templateByType[p.prospect_type] || templateByType['other'] || null
      if (!template) return null
      return {
        prospect: p,
        template,
        unsubscribe_url: buildUnsubscribeUrl(p.email_found),
      }
    })
    .filter(Boolean)

  res.json({ items, total: items.length })
})

// ── Send log ─────────────────────────────────────────────────────────────────

// POST /api/admin/prospects/send-log — Bob logs a completed send
router.post('/send-log', requireAuth, requireAnyStaff, async (req, res) => {
  const {
    prospect_id,
    template_id,
    rendered_subject,
    rendered_body,
    delivery_status,
    bob_job_id,
    notes,
  } = req.body
  if (!prospect_id) return res.status(400).json({ error: 'prospect_id is required' })

  // Suppression guard — reject if the prospect's email is in outreach_unsubscribes
  // (covers both manual opt-outs and auto-suppressed bounces)
  const { data: prospect, error: prospectErr } = await supabaseAdmin
    .from('outreach_prospects')
    .select('email_found')
    .eq('id', prospect_id)
    .single()

  if (prospectErr)
    return res.status(500).json({ error: 'Failed to look up prospect: ' + prospectErr.message })

  if (prospect && prospect.email_found) {
    const { data: suppressed } = await supabaseAdmin
      .from('outreach_unsubscribes')
      .select('email, source')
      .eq('email', prospect.email_found.toLowerCase())
      .maybeSingle()

    if (suppressed) {
      return res.status(422).json({
        error: 'Suppressed address',
        reason:
          suppressed.source === 'bounce' ? 'Email has previously bounced' : 'Email has opted out',
        email: prospect.email_found,
      })
    }
  }

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
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', prospect_id)

  res.status(201).json(data)
})

// GET /api/admin/prospects/:id/send-log — fetch send-log entry for a single prospect (lazy load for expanded row)
router.get('/:id/send-log', requireAuth, requireAnyStaff, async (req, res) => {
  const { id } = req.params

  const { data, error } = await supabaseAdmin
    .from('outreach_send_log')
    .select(
      'id, prospect_id, template_id, rendered_subject, delivery_status, bob_job_id, sent_at, updated_at, delivery_events, notes'
    )
    .eq('prospect_id', id)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return res.status(500).json({ error: error.message })
  res.json(data || null)
})

// GET /api/admin/prospects/send-log — admin views send history
router.get('/send-log', requireAuth, requireAnyStaff, async (req, res) => {
  const { prospect_id, template_id, limit = 50, offset = 0 } = req.query

  let q = supabaseAdmin
    .from('outreach_send_log')
    .select(
      `
      *,
      outreach_prospects ( first_name, last_name, business_name, email_found, prospect_type ),
      outreach_templates ( name, prospect_type )
    `,
      { count: 'exact' }
    )
    .order('sent_at', { ascending: false })
    .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1)

  if (prospect_id) q = q.eq('prospect_id', prospect_id)
  if (template_id) q = q.eq('template_id', template_id)

  const { data, error, count } = await q
  if (error) return res.status(500).json({ error: error.message })
  res.json({ logs: data || [], total: count || 0 })
})

// ── Prospect → User matching ─────────────────────────────────────────────────

// GET /api/admin/prospects/match-status
router.get('/match-status', requireAuth, requireAnyStaff, async (_req, res) => {
  try {
    const status = await getMatchStatus()
    res.json(status)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/admin/prospects/run-match — manually trigger a scan
router.post('/run-match', requireAuth, requireAdminLevel, async (_req, res) => {
  try {
    const result = await runProspectMatch()
    res.json(result)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
