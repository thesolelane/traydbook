/**
 * Outbound webhook dispatcher
 * Signs payloads with HMAC-SHA256 using the registered secret.
 * Used by Bob and the platform to push events to registered endpoints.
 */
import { Router } from 'express'
import { createHmac, randomBytes } from 'crypto'
import { supabaseAdmin } from '../lib/clients.js'
import { requireAuth, requireAdminLevel } from '../lib/auth.js'

const router = Router()

// Private IP ranges that must never be targeted (SSRF protection)
const PRIVATE_IP_RE =
  /^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|::1|fc00:|fd[0-9a-f]{2}:)/i

function isPrivateUrl(rawUrl) {
  try {
    const { hostname, protocol } = new URL(rawUrl)
    if (protocol !== 'https:' && protocol !== 'http:') return true
    if (PRIVATE_IP_RE.test(hostname)) return true
    // Block AWS/GCP metadata endpoints
    if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal') return true
    return false
  } catch {
    return true
  }
}

export async function dispatchWebhook({ url, secret, event, payload }) {
  const timestamp = Math.floor(Date.now() / 1000)
  const body = JSON.stringify({ event, timestamp, payload })
  const sig = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Trayd-Signature': `t=${timestamp},v1=${sig}`,
      'X-Trayd-Event': event,
    },
    body,
    signal: AbortSignal.timeout(10000),
  })

  return { ok: res.ok, status: res.status }
}

// POST /api/admin/webhook/test — admin can test a webhook endpoint
router.post('/api/admin/webhook/test', requireAuth, requireAdminLevel, async (req, res) => {
  const { url, secret, event = 'test.ping' } = req.body ?? {}
  if (!url || !secret) return res.status(400).json({ error: 'url and secret required' })

  if (isPrivateUrl(url)) {
    return res.status(400).json({
      error:
        'Target URL must be a public HTTPS/HTTP address — private/internal IPs are not permitted',
    })
  }

  try {
    const result = await dispatchWebhook({
      url,
      secret,
      event,
      payload: { message: 'TraydBook webhook test', ts: Date.now() },
    })
    res.json(result)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
