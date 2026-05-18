import { Router } from 'express'
import { supabaseAdmin } from '../lib/clients.js'
import { getQuarantineLog, isSafeMode, getSafeModeReason } from '../lib/safe-mode.js'

const router = Router()

// GET /api/admin/monitor/health
router.get('/health', async (req, res) => {
  const startTime = Date.now()
  const { data, error } = await supabaseAdmin.from('users').select('count').single()
  res.json({
    status: error ? 'error' : 'ok',
    supabase: error ? error.message : 'connected',
    latency_ms: Date.now() - startTime,
    safe_mode: isSafeMode(),
    safe_mode_reason: getSafeModeReason() || null,
    timestamp: new Date().toISOString(),
  })
})

// GET /api/admin/monitor/threats
router.get('/threats', async (req, res) => {
  const hours = parseInt(req.query.hours) || 24

  const { data, error } = await supabaseAdmin
    .from('security_events')
    .select('*')
    .gte('timestamp', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())
    .order('timestamp', { ascending: false })
    .limit(100)

  if (error) return res.status(500).json({ error: error.message })

  const summary = {
    total: data?.length || 0,
    critical: data?.filter(e => e.severity === 'critical').length || 0,
    high: data?.filter(e => e.severity === 'high').length || 0,
    blocked_ips: [...new Set(data?.filter(e => e.action_taken === 'blocked').map(e => e.ip) || [])],
  }

  res.json({ events: data, summary })
})

// GET /api/admin/monitor/scraping
router.get('/scraping', async (req, res) => {
  const hours = parseInt(req.query.hours) || 24

  const { data: fallback } = await supabaseAdmin
    .from('security_events')
    .select('ip, type')
    .gte('timestamp', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())
    .eq('type', 'RATE_LIMIT_BREACH')
    .limit(200)

  res.json({
    stats: fallback || [],
    note: 'Using direct query — create get_scraping_stats RPC for aggregated results',
  })
})

// GET /api/admin/monitor/quarantine
router.get('/quarantine', async (req, res) => {
  const log = getQuarantineLog()
  res.json({ quarantined: log, count: log.length })
})

// GET /api/admin/monitor/audit
router.get('/audit', async (req, res) => {
  const { admin_id, action, limit = 50 } = req.query

  let query = supabaseAdmin
    .from('admin_audit_log')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(parseInt(limit) || 50)

  if (admin_id) query = query.eq('admin_id', admin_id)
  if (action) query = query.eq('action', action)

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  res.json({ entries: data || [], count: data?.length || 0 })
})

// GET /api/admin/monitor/domains
const PING_TARGETS = [
  { domain: 'traydbook.com',       label: 'Marketing Site', url: 'https://traydbook.com',            note: 'Public-facing landing page.' },
  { domain: 'app.traydbook.com',   label: 'Web App',        url: 'https://app.traydbook.com',         note: 'Main application. React + Supabase.' },
  { domain: 'admin.traydbook.com', label: 'Admin Panel',    url: 'https://admin.traydbook.com/healthz', note: 'Admin control center. Deployed on Coolify.' },
  { domain: 'bob.traydbook.com',   label: 'Bob (AI Agent)', url: 'https://bob.traydbook.com',         note: 'Autonomous AI agent. Deployed on Coolify.' },
  { domain: 'secure.traydbook.com',label: 'Auth / API',     url: 'https://secure.traydbook.com',      note: 'Supabase auth and API endpoint.' },
]

router.get('/domains', async (_req, res) => {
  const results = await Promise.all(
    PING_TARGETS.map(async t => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 6000)
      const start = Date.now()
      try {
        const r = await fetch(t.url, {
          method: 'HEAD',
          signal: controller.signal,
          redirect: 'follow',
        })
        clearTimeout(timer)
        const latency = Date.now() - start
        const status = r.status >= 500 ? 'down' : latency > 3000 ? 'degraded' : 'operational'
        return { ...t, status, latency, httpStatus: r.status }
      } catch (e) {
        clearTimeout(timer)
        return {
          ...t,
          status: 'down',
          latency: null,
          httpStatus: null,
          error: e.name === 'AbortError' ? 'timeout' : e.message,
        }
      }
    })
  )
  res.json({ domains: results, checkedAt: new Date().toISOString() })
})

export default router
