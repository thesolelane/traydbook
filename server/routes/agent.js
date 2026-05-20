/**
 * Agent / Bob API routes
 *
 * Auth: X-Service-Key header — raw service key hashed on arrival,
 * matched against service_api_keys table. Scopes enforced per endpoint.
 *
 * Contract aligned with Bob's integration spec (2026-05-17).
 */
import { Router } from 'express'
import { createHash } from 'crypto'
import { supabaseAdmin } from '../lib/clients.js'

const router = Router()

// ── Service key authentication middleware ─────────────────────────────────────

async function requireServiceKey(scopes = []) {
  return async (req, res, next) => {
    // Accept X-Service-Key (Bob's contract) or X-Api-Key (legacy)
    const raw = (req.headers['x-service-key'] || req.headers['x-api-key'] || '').trim()
    if (!raw) return res.status(401).json({ error: 'Missing X-Service-Key header' })

    const hash = createHash('sha256').update(raw).digest('hex')

    const { data: key, error } = await supabaseAdmin
      .from('service_api_keys')
      .select('id, scopes, revoked_at, expires_at')
      .eq('key_hash', hash)
      .maybeSingle()

    if (error || !key) return res.status(401).json({ error: 'Invalid service key' })
    if (key.revoked_at) return res.status(401).json({ error: 'Service key revoked' })
    if (key.expires_at && new Date(key.expires_at) < new Date()) {
      return res.status(401).json({ error: 'Service key expired' })
    }

    // Check required scopes
    for (const scope of scopes) {
      if (!key.scopes.includes(scope) && !key.scopes.includes('*')) {
        return res.status(403).json({ error: `Missing scope: ${scope}` })
      }
    }

    // Update last_used_at asynchronously (non-blocking)
    supabaseAdmin
      .from('service_api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', key.id)
      .then(() => {})

    req.serviceKey = key
    next()
  }
}

// ── Agent Log ─────────────────────────────────────────────────────────────────

// POST /api/agent/log  → 201 Created
router.post('/api/agent/log', await requireServiceKey(['agent:log']), async (req, res) => {
  const {
    agent_name = 'bob',
    action,
    status = 'success',
    target_type,
    target_id,
    contractor_id,
    message,
    metadata = {},
    payload, // legacy alias for metadata
    duration_ms,
    ai_provider,
  } = req.body ?? {}

  if (!action) return res.status(400).json({ error: 'action is required' })

  const { data, error } = await supabaseAdmin
    .from('agent_logs')
    .insert({
      agent_name,
      action,
      status,
      target_type: target_type || null,
      target_id: target_id ? String(target_id) : null,
      contractor_id: contractor_id || null,
      message: message || null,
      metadata: metadata || payload || {},
      duration_ms: duration_ms || null,
      ai_provider: ai_provider || null,
    })
    .select('id, created_at')
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json({ ok: true, id: data.id, created_at: data.created_at })
})

// ── Leads ─────────────────────────────────────────────────────────────────────

// POST /api/leads — Bob delivers a lead to a contractor
router.post('/api/leads', await requireServiceKey(['leads:write']), async (req, res) => {
  const { rfq_id, contractor_id, expires_at, queue_position, trust_score_at_delivery, notes } =
    req.body ?? {}

  if (!contractor_id) return res.status(400).json({ error: 'contractor_id is required' })

  const { data, error } = await supabaseAdmin
    .from('leads')
    .upsert(
      {
        rfq_id: rfq_id || null,
        contractor_id,
        status: 'pending',
        expires_at: expires_at || null,
        queue_position: queue_position || null,
        trust_score_at_delivery: trust_score_at_delivery || null,
        notes: notes || null,
      },
      { onConflict: 'rfq_id,contractor_id', ignoreDuplicates: false }
    )
    .select('id, status, delivered_at')
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json({ ok: true, lead: data })
})

// GET /api/leads/:id
router.get('/api/leads/:id', await requireServiceKey(['leads:read']), async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('leads')
    .select('*')
    .eq('id', req.params.id)
    .single()

  if (error || !data) return res.status(404).json({ error: 'Lead not found' })
  res.json({ lead: data })
})

// POST /api/leads/:id/claim
router.post('/api/leads/:id/claim', await requireServiceKey(['leads:write']), async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('leads')
    .update({ status: 'claimed', acted_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .eq('status', 'pending')
    .select('id, status, contractor_id')
    .maybeSingle()

  if (error) return res.status(500).json({ error: error.message })
  if (!data) return res.status(409).json({ error: 'Lead already acted on or not found' })

  await supabaseAdmin.rpc('adjust_lead_bank', {
    p_user_id: data.contractor_id,
    p_delta: -1,
    p_reason: 'lead_claimed',
    p_by: null,
  })

  res.json({ ok: true, lead: data })
})

// POST /api/leads/:id/pass
router.post('/api/leads/:id/pass', await requireServiceKey(['leads:write']), async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('leads')
    .update({ status: 'passed', acted_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .eq('status', 'pending')
    .select('id, status')
    .maybeSingle()

  if (error) return res.status(500).json({ error: error.message })
  if (!data) return res.status(409).json({ error: 'Lead already acted on or not found' })
  res.json({ ok: true, lead: data })
})

// ── Contractor profile endpoints ──────────────────────────────────────────────

// GET /api/contractor/:id/profile
router.get(
  '/api/contractor/:id/profile',
  await requireServiceKey(['contractor:read']),
  async (req, res) => {
    const { id } = req.params

    const [userRes, cpRes] = await Promise.all([
      supabaseAdmin
        .from('users')
        .select(
          'id, display_name, handle, avatar_url, account_type, location_city, location_state, created_at'
        )
        .eq('id', id)
        .is('deleted_at', null)
        .maybeSingle(),
      supabaseAdmin
        .from('contractor_profiles')
        .select(
          'primary_trade, secondary_trades, years_experience, bio, service_radius_miles, badge_tier, trust_score, lead_bank_balance, rating_avg, rating_count, projects_completed, availability_status'
        )
        .eq('user_id', id)
        .maybeSingle(),
    ])

    if (!userRes.data) return res.status(404).json({ error: 'Contractor not found' })
    res.json({ user: userRes.data, profile: cpRes.data ?? null })
  }
)

// GET /api/contractor/:id/lead-bank
router.get(
  '/api/contractor/:id/lead-bank',
  await requireServiceKey(['contractor:read']),
  async (req, res) => {
    const { id } = req.params

    const [cpRes, ledgerRes] = await Promise.all([
      supabaseAdmin
        .from('contractor_profiles')
        .select('lead_bank_balance')
        .eq('user_id', id)
        .maybeSingle(),
      supabaseAdmin
        .from('lead_bank_ledger')
        .select('id, delta, balance_after, reason, created_at')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    if (!cpRes.data) return res.status(404).json({ error: 'Contractor not found' })
    res.json({ balance: cpRes.data.lead_bank_balance, ledger: ledgerRes.data ?? [] })
  }
)

// PATCH /api/contractor/:id/lead-bank
router.patch(
  '/api/contractor/:id/lead-bank',
  await requireServiceKey(['lead-bank:write']),
  async (req, res) => {
    const { id } = req.params
    const { delta, reason } = req.body ?? {}

    if (delta === undefined || !reason) {
      return res.status(400).json({ error: 'delta and reason are required' })
    }

    const { data, error } = await supabaseAdmin.rpc('adjust_lead_bank', {
      p_user_id: id,
      p_delta: delta,
      p_reason: reason,
      p_by: null,
    })

    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true, new_balance: data })
  }
)

// ── Bob Control State (Bob reads its flags each cycle) ────────────────────────

// GET /api/bob/control
router.get('/api/bob/control', await requireServiceKey(['agent:read']), async (req, res) => {
  const { data, error } = await supabaseAdmin.from('bob_control').select('key, value')

  if (error) return res.status(500).json({ error: error.message })

  const controls = Object.fromEntries((data ?? []).map(r => [r.key, r.value]))
  res.json({
    paused: controls.paused === 'true',
    ai_provider_override: controls.ai_provider_override || null,
    lead_refresh_force: controls.lead_refresh_force === 'true',
    max_leads_per_cycle: parseInt(controls.max_leads_per_cycle ?? '10', 10),
    // traydbook_url_override: lets Bob hot-swap which TraydBook URL it targets
    // without a redeployment — null means use whatever Bob has configured locally
    traydbook_url_override: controls.traydbook_url_override || null,
  })
})

export default router
