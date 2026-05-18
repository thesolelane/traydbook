import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
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
app.use(adminRoutes)

// ── Security: Monitor, Threats, Quarantine, Audit ────────────────────────────
app.use('/api/admin/monitor', monitorRoutes)

// ── Security: Enhanced User Controls ─────────────────────────────────────────
app.use('/api/admin/users/security', userSecurityRoutes)

// ── Security: Content Moderation ─────────────────────────────────────────────
app.use('/api/admin/moderation', moderationRoutes)

// ── Security: SQL Repair + Approvals ─────────────────────────────────────────
app.use('/api/admin/repair', repairRoutes)

// ── Security: Session Revocation ─────────────────────────────────────────────
app.use('/api/admin/revoke', revokeRoutes)

// ── Security: AI Command Bar (BOB/OpenAI) ────────────────────────────────────
app.use('/api/admin/ai', aiCommandRoutes)

// ── Contractor Trust Score / Lead Bank ───────────────────────────────────────
app.use(contractorsRoutes)
app.use(apiKeysRoutes)
app.use(webhookRoutes)
app.use('/api/admin/bob', bobRoutes)
app.use('/api/admin/security', securityScanRoutes)

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
