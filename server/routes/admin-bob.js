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

const router = Router()

// ── Helper: push a command directly to Bob's server (fire-and-forget) ─────────
// Bob's contract: Authorization: Bearer <BOB_ADMIN_KEY>
// Endpoint paths follow Bob's spec: /bob/admin/*
async function pushToBob(path, body = {}) {
  const endpoint = process.env.BOB_AGENT_ENDPOINT       // e.g. https://bob.traydbook.com
  const token    = process.env.ADMIN_TO_BOB_TOKEN       // the BOB_ADMIN_KEY value
  if (!endpoint || !token) return   // not configured — Bob will pick it up on next poll

  try {
    await fetch(`${endpoint.replace(/\/$/, '')}/bob/admin${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    })
  } catch {
    // Non-fatal — DB is source of truth, Bob will sync on next poll
  }
}

// GET /api/admin/bob/logs
router.get('/logs', async (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit) || 50, 200)
  const agent  = req.query.agent  || null
  const status = req.query.status || null
  const action = req.query.action || null

  let q = supabaseAdmin
    .from('agent_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (agent)  q = q.eq('agent_name', agent)
  if (status) q = q.eq('status', status)
  if (action) q = q.eq('action', action)

  const { data, error } = await q
  if (error) return res.status(500).json({ error: error.message })
  res.json({ logs: data ?? [] })
})

// GET /api/admin/bob/control
router.get('/control', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('bob_control')
    .select('key, value')

  if (error) return res.status(500).json({ error: error.message })

  const controls = Object.fromEntries((data ?? []).map(r => [r.key, r.value]))
  res.json({
    paused: controls.paused === 'true',
    ai_provider_override: controls.ai_provider_override || null,
    lead_refresh_force: controls.lead_refresh_force === 'true',
    max_leads_per_cycle: parseInt(controls.max_leads_per_cycle ?? '10', 10),
  })
})

// PATCH /api/admin/bob/control — update a single control flag
router.patch('/control', async (req, res) => {
  const { key, value } = req.body ?? {}
  if (!key || value === undefined) {
    return res.status(400).json({ error: 'key and value required' })
  }

  const ALLOWED_KEYS = ['paused', 'ai_provider_override', 'lead_refresh_force', 'max_leads_per_cycle']
  if (!ALLOWED_KEYS.includes(key)) {
    return res.status(400).json({ error: `Unknown control key: ${key}` })
  }

  const { error } = await supabaseAdmin
    .from('bob_control')
    .update({ value: String(value), updated_at: new Date().toISOString() })
    .eq('key', key)

  if (error) return res.status(500).json({ error: error.message })

  // Push instantly to Bob if his endpoint is configured
  void pushToBob('/admin/control', { key, value })

  res.json({ ok: true, key, value })
})

// GET /api/admin/bob/lead-stats — lead counts by status
router.get('/lead-stats', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('leads')
    .select('status')

  if (error) return res.status(500).json({ error: error.message })

  const counts = {}
  for (const row of data ?? []) {
    counts[row.status] = (counts[row.status] ?? 0) + 1
  }

  const stats = Object.entries(counts).map(([status, count]) => ({ status, count }))
  res.json({ stats })
})

export default router
