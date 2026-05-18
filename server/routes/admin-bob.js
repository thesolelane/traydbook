/**
 * Admin routes for Bob monitoring and control
 * Read agent logs, adjust control flags, view lead stats.
 *
 * When BOB_AGENT_ENDPOINT is set, write-commands are ALSO pushed directly to
 * Bob's server via X-Admin-Token so Bob gets instant notification instead of
 * waiting for his next poll cycle.
 */
import { Router } from 'express'
import { supabaseAdmin } from '../lib/clients.js'
import { pushToBob } from '../lib/bob-push.js'
import { requireAuth, requireAnyStaff, requireAdminLevel } from '../lib/auth.js'

const router = Router()

// GET /api/admin/bob/logs
router.get('/logs', requireAuth, requireAnyStaff, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200)
  const agent = req.query.agent || null
  const status = req.query.status || null
  const action = req.query.action || null

  let q = supabaseAdmin
    .from('agent_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (agent) q = q.eq('agent_name', agent)
  if (status) q = q.eq('status', status)
  if (action) q = q.eq('action', action)

  const { data, error } = await q
  if (error) return res.status(500).json({ error: error.message })
  res.json({ logs: data ?? [] })
})

// GET /api/admin/bob/control
router.get('/control', requireAuth, requireAnyStaff, async (req, res) => {
  const { data, error } = await supabaseAdmin.from('bob_control').select('key, value')

  if (error) return res.status(500).json({ error: error.message })

  const controls = Object.fromEntries((data ?? []).map(r => [r.key, r.value]))
  res.json({
    paused: controls.paused === 'true',
    ai_provider_override: controls.ai_provider_override || null,
    lead_refresh_force: controls.lead_refresh_force === 'true',
    max_leads_per_cycle: parseInt(controls.max_leads_per_cycle ?? '10', 10),
  })
})

// PATCH /api/admin/bob/control — update a single control flag (admin-level only)
router.patch('/control', requireAuth, requireAdminLevel, async (req, res) => {
  const { key, value } = req.body ?? {}
  if (!key || value === undefined) {
    return res.status(400).json({ error: 'key and value required' })
  }

  const ALLOWED_KEYS = [
    'paused',
    'ai_provider_override',
    'lead_refresh_force',
    'max_leads_per_cycle',
  ]
  if (!ALLOWED_KEYS.includes(key)) {
    return res.status(400).json({ error: `Unknown control key: ${key}` })
  }

  const { error } = await supabaseAdmin
    .from('bob_control')
    .update({ value: String(value), updated_at: new Date().toISOString() })
    .eq('key', key)

  if (error) return res.status(500).json({ error: error.message })

  void pushToBob('/control', { key, value })

  res.json({ ok: true, key, value })
})

// GET /api/admin/bob/lead-stats — lead counts by status
router.get('/lead-stats', requireAuth, requireAnyStaff, async (req, res) => {
  const { data, error } = await supabaseAdmin.from('leads').select('status')

  if (error) return res.status(500).json({ error: error.message })

  const counts = {}
  for (const row of data ?? []) {
    counts[row.status] = (counts[row.status] ?? 0) + 1
  }

  const stats = Object.entries(counts).map(([status, count]) => ({ status, count }))
  res.json({ stats })
})

// GET /api/admin/bob/ping — test connectivity to Bob's server
router.get('/ping', requireAuth, requireAnyStaff, async (req, res) => {
  const endpoint = process.env.BOB_AGENT_ENDPOINT
  if (!endpoint) {
    return res.json({ reachable: false, reason: 'BOB_AGENT_ENDPOINT not set' })
  }
  const token = process.env.ADMIN_TO_BOB_TOKEN
  const url = `${endpoint.replace(/\/$/, '')}/bob/healthz`
  try {
    const r = await fetch(url, {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: AbortSignal.timeout(5000),
    })
    res.json({ reachable: r.ok, status: r.status, endpoint: url })
  } catch (e) {
    res.json({
      reachable: false,
      reason: e instanceof Error ? e.message : 'unreachable',
      endpoint: url,
    })
  }
})

// POST /api/admin/bob/command — forward a raw command to Bob's /bob/command endpoint
router.post('/command', requireAuth, requireAdminLevel, async (req, res) => {
  const { command, args } = req.body ?? {}
  if (!command) return res.status(400).json({ error: 'command is required' })
  const endpoint = process.env.BOB_AGENT_ENDPOINT
  if (!endpoint) return res.status(503).json({ error: 'BOB_AGENT_ENDPOINT not set' })
  await pushToBob('/command', { command, args: args ?? {} })
  res.json({ ok: true, command })
})

// POST /api/admin/bob/suggestion/:id/approve
router.post('/suggestion/:id/approve', requireAuth, requireAdminLevel, async (req, res) => {
  const { id } = req.params
  const { error } = await supabaseAdmin
    .from('agent_logs')
    .update({ status: 'approved' })
    .eq('id', id)
  if (error) return res.status(500).json({ error: error.message })
  void pushToBob('/suggestion/approved', { suggestion_id: id })
  res.json({ ok: true, suggestion_id: id })
})

export default router
