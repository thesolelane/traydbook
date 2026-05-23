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
  const isDevEnv = !!(process.env.REPLIT_DEV_DOMAIN)
  res.json({ domains: results, checkedAt: new Date().toISOString(), devEnv: isDevEnv })
})

// GET /api/admin/monitor/activity
// Returns a unified activity feed from auth.users (catches even incomplete signups)
// cross-referenced with public.users to flag onboarding status.
// ?hours=N  — lookback window (default 2, max 72)
router.get('/activity', async (req, res) => {
  const hours = Math.min(parseInt(req.query.hours) || 2, 72)
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString()

  try {
    // Auth-level signups (includes users who never finished onboarding)
    const { data: authData, error: authErr } =
      await supabaseAdmin.auth.admin.listUsers({ perPage: 200 })
    if (authErr) return res.status(500).json({ error: authErr.message })

    const recentAuth = (authData?.users ?? [])
      .filter(u => u.created_at >= since)
      .map(u => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        confirmed: !!u.email_confirmed_at,
      }))

    // Public profile rows for those same users
    const ids = recentAuth.map(u => u.id)
    let profileMap = {}
    if (ids.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('users')
        .select('id, display_name, handle, account_type, created_at')
        .in('id', ids)
      for (const p of profiles ?? []) profileMap[p.id] = p
    }

    // Recent posts / bids / jobs for activity pulse
    const [{ data: recentPosts }, { data: recentBids }, { data: recentJobs }] =
      await Promise.all([
        supabaseAdmin
          .from('posts')
          .select('id, author_id, post_type, created_at')
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(20),
        supabaseAdmin
          .from('bids')
          .select('id, contractor_id, created_at')
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(20),
        supabaseAdmin
          .from('job_listings')
          .select('id, poster_id, created_at')
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(20),
      ])

    const signups = recentAuth.map(u => ({
      type: 'signup',
      id: u.id,
      email: u.email,
      confirmed: u.confirmed,
      onboarded: !!profileMap[u.id],
      display_name: profileMap[u.id]?.display_name ?? null,
      account_type: profileMap[u.id]?.account_type ?? null,
      created_at: u.created_at,
    }))

    const events = [
      ...signups,
      ...(recentPosts ?? []).map(p => ({ type: 'post', post_type: p.post_type, created_at: p.created_at })),
      ...(recentBids ?? []).map(b => ({ type: 'bid', created_at: b.created_at })),
      ...(recentJobs ?? []).map(j => ({ type: 'job', created_at: j.created_at })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

    res.json({
      events,
      signups_total: signups.length,
      signups_onboarded: signups.filter(s => s.onboarded).length,
      signups_incomplete: signups.filter(s => !s.onboarded).length,
      posts_total: recentPosts?.length ?? 0,
      bids_total: recentBids?.length ?? 0,
      jobs_total: recentJobs?.length ?? 0,
      since,
      hours,
    })
  } catch (err) {
    console.error('[admin/activity]', err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router
