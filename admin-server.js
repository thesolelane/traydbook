import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { rateLimit, ipKeyGenerator } from 'express-rate-limit'
import { supabaseAdmin } from './server/lib/clients.js'
import adminRoutes from './server/routes/admin.js'
import { logError, loadLogFromDisk } from './server/lib/errorLog.js'

import { loadSecrets } from './server/lib/vault.js'
import { validateConnection } from './server/lib/connection-validator.js'
import { activateSafeMode, isSafeMode, getSafeModeReason } from './server/lib/safe-mode.js'
import { keyManager } from './server/lib/key-rotation.js'
import { modeAwareMiddleware } from './server/lib/mode-middleware.js'

import monitorRoutes from './server/routes/admin-monitor.js'
import userSecurityRoutes from './server/routes/admin-users-security.js'
import moderationRoutes from './server/routes/admin-moderation.js'
import repairRoutes from './server/routes/admin-repair.js'
import revokeRoutes from './server/routes/admin-revoke.js'
import aiCommandRoutes from './server/routes/admin-ai-command.js'
import contractorsRoutes from './server/routes/admin-contractors.js'
import apiKeysRoutes from './server/routes/admin-api-keys.js'
import webhookRoutes from './server/routes/webhook-dispatch.js'
import bobRoutes from './server/routes/admin-bob.js'
import securityScanRoutes from './server/routes/admin-security-scan.js'
import prospectsRoutes from './server/routes/admin-prospects.js'
import outreachTemplatesRoutes from './server/routes/admin-outreach-templates.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()
const PORT = process.env.PORT ?? process.env.ADMIN_PORT ?? 4000

// Trust exactly one reverse-proxy hop (Coolify/Traefik) so req.ip reflects
// the real client IP rather than the proxy's address.  Without this, the
// X-Forwarded-For header is read raw, which lets any client spoof their IP by
// prepending a whitelisted address to the header value.
app.set('trust proxy', 1)

// ── IP Allowlist ──────────────────────────────────────────────────────────────
const rawIps = process.env.ADMIN_ALLOWED_IPS ?? ''
const ALLOWED_IPS = rawIps
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

function ipRestriction(req, res, next) {
  if (ALLOWED_IPS.length === 0) return next()
  // Use req.ip — Express resolves this correctly when trust proxy is set,
  // making it impossible for a client to spoof via X-Forwarded-For injection.
  const clientIp = (req.ip ?? '').replace(/^::ffff:/, '')
  const isLoopback = clientIp === '::1' || clientIp === '127.0.0.1'
  if (isLoopback || ALLOWED_IPS.includes(clientIp)) return next()
  console.warn(`[admin] Blocked IP: ${clientIp}`)
  return res.status(403).send('Forbidden')
}

// ── Rate Limiters ─────────────────────────────────────────────────────────────
// Four tiers, ordered from most to least restrictive.
// All use the in-memory store (single-instance admin server) and respond with
// a JSON body so the frontend can surface the retry-after time cleanly.
//
// Key strategy: authenticated admins are bucketed by their user ID (from the
// JWT sub claim) so their legitimate work never competes with unauthenticated
// traffic. Unauthenticated requests fall back to IP.
// Note: the JWT is only decoded here (not verified) — this is intentional.
// Rate limiting by user ID is purely a UX concern; auth verification still
// happens inside each route handler via requireAuth.
function rateLimitKey(req) {
  const auth = req.headers.authorization
  if (auth?.startsWith('Bearer ')) {
    try {
      const payload = JSON.parse(
        Buffer.from(auth.slice(7).split('.')[1], 'base64url').toString()
      )
      if (payload?.sub) return `user:${payload.sub}`
    } catch {}
  }
  return ipKeyGenerator(req)
}

// Tier 1 — Security scan endpoints (npm audit + full FS code scan are expensive)
// 5 requests per hour per user/IP
const scanRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
  handler: (_req, res) =>
    res.status(429).json({
      error: 'TOO_MANY_REQUESTS',
      message: 'Scan rate limit exceeded — maximum 5 scans per hour.',
    }),
})

// Tier 2 — Destructive/write operations (SQL execution, revocation, secret writes,
//           moderation actions, user suspension).  10 requests per 15 minutes per IP.
const destructiveRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
  handler: (_req, res) =>
    res.status(429).json({
      error: 'TOO_MANY_REQUESTS',
      message: 'Action rate limit exceeded — maximum 10 destructive operations per 15 minutes.',
    }),
})

// Tier 3 — Bob AI / command-bar endpoint (LLM inference may be slow/costly).
// 20 requests per 15 minutes per IP.
const bobRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
  handler: (_req, res) =>
    res.status(429).json({
      error: 'TOO_MANY_REQUESTS',
      message: 'AI command rate limit exceeded — maximum 20 requests per 15 minutes.',
    }),
})

// Tier 3b — Bob monitor reads (control, logs, ping).
// Monitor polls 3 endpoints every 15s = ~180 req/15 min; give headroom.
const bobMonitorRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 400,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
  handler: (_req, res) =>
    res.status(429).json({
      error: 'TOO_MANY_REQUESTS',
      message: 'Bob monitor rate limit exceeded.',
    }),
})

// Tier 4 — General admin API (read-heavy: lists, dashboards, monitor, contractors).
// 120 requests per 15 minutes per IP.
const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
  handler: (_req, res) =>
    res.status(429).json({
      error: 'TOO_MANY_REQUESTS',
      message: 'Rate limit exceeded — please slow down.',
    }),
})

// Health check — before IP restriction so Coolify can reach it.
// Does NOT expose safe_mode_reason to avoid leaking internal error details
// to unauthenticated callers on the public internet.
app.get('/healthz', (_req, res) =>
  res.json({
    ok: true,
    safe_mode: isSafeMode(),
  })
)

app.use(ipRestriction)

// ── Logging ───────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.on('finish', () => {
    if (res.statusCode >= 400) {
      logError({
        context: req.path.split('/')[2] ?? 'admin-server',
        message: `${res.statusCode} ${req.method} ${req.path}`,
        detail: null,
        route: req.path,
        method: req.method,
        statusCode: res.statusCode,
      })
    }
  })
  next()
})

app.use(express.json())

// ── Mode-Aware Middleware (safe mode enforcement) ──────────────────────────────
app.use(modeAwareMiddleware)

// ── Existing Admin API Routes ─────────────────────────────────────────────────
app.use(generalRateLimit, adminRoutes)

// ── Security: Monitor, Threats, Quarantine, Audit ────────────────────────────
app.use('/api/admin/monitor', generalRateLimit, monitorRoutes)

// ── Security: Enhanced User Controls ─────────────────────────────────────────
// Suspension / unsuspension / force-logout are destructive; reads fall through
// to generalRateLimit but the destructive limiter is applied at the router level
// via explicit route middleware — here we set the tighter cap on the whole prefix.
app.use('/api/admin/users/security', destructiveRateLimit, userSecurityRoutes)

// ── Security: Content Moderation ─────────────────────────────────────────────
app.use('/api/admin/moderation', destructiveRateLimit, moderationRoutes)

// ── Security: SQL Repair + Approvals ─────────────────────────────────────────
// All repair routes (request, approve, execute) are destructive.
app.use('/api/admin/repair', destructiveRateLimit, repairRoutes)

// ── Security: Session Revocation ─────────────────────────────────────────────
app.use('/api/admin/revoke', destructiveRateLimit, revokeRoutes)

// ── Security: AI Command Bar (BOB/OpenAI) ────────────────────────────────────
app.use('/api/admin/ai', bobRateLimit, aiCommandRoutes)

// ── Contractor Trust Score / Lead Bank ───────────────────────────────────────
app.use(generalRateLimit, contractorsRoutes)
app.use(generalRateLimit, apiKeysRoutes)
app.use(destructiveRateLimit, webhookRoutes)

// ── Bob agent push commands ───────────────────────────────────────────────────
// GET (ping, control, logs) → monitor limit (400/15 min).
// POST (commands, approvals) → AI command limit (20/15 min).
app.use('/api/admin/bob', (req, res, next) => {
  const limiter = req.method === 'GET' ? bobMonitorRateLimit : bobRateLimit
  limiter(req, res, next)
}, bobRoutes)

// ── Outreach Prospects (CSV import + Bob enrichment) ─────────────────────────
app.use('/api/admin/prospects', generalRateLimit, prospectsRoutes)
app.use('/api/admin/outreach', generalRateLimit, outreachTemplatesRoutes)

// ── Code Security Scanner (expensive — shell + FS scan) ──────────────────────
app.use('/api/admin/security', scanRateLimit, securityScanRoutes)

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/admin-health', (_req, res) =>
  res.json({
    ok: true,
    env: process.env.SUPABASE_ENV ?? 'production',
    safe_mode: isSafeMode(),
    safe_mode_reason: getSafeModeReason() || null,
  })
)

// ── Serve built admin app in production ───────────────────────────────────────
const ADMIN_DIST = path.join(__dirname, 'admin-dist')
app.use(express.static(ADMIN_DIST))
app.use((_req, res) => {
  res.sendFile(path.join(ADMIN_DIST, 'index.html'))
})

// ── Startup ───────────────────────────────────────────────────────────────────
async function main() {
  await loadLogFromDisk()

  try {
    await loadSecrets()
    await validateConnection()

    if (process.env.ENABLE_KEY_ROTATION === 'true') {
      await keyManager.initialize()
    }
  } catch (err) {
    console.warn(`[admin] ⚠️  Startup warning: ${err.message}`)
    activateSafeMode(app, err.message)
  }

  app.listen(PORT, () => {
    const env = process.env.SUPABASE_ENV ?? 'production'
    const ips = ALLOWED_IPS.length ? ALLOWED_IPS.join(', ') : 'all (no restriction)'
    console.log(`[admin-server] Listening on :${PORT}`)
    console.log(`[admin-server] Supabase env: ${env}`)
    console.log(`[admin-server] Allowed IPs: ${ips}`)
    console.log(`[admin-server] Mode: ${isSafeMode() ? '🛡️  SAFE (quarantine active)' : '✅ FULL'}`)
  })
}

main().catch(err => {
  console.error('[admin] Fatal startup error:', err)
  process.exit(1)
})
