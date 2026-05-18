/**
 * Outbound webhook dispatcher
 * Signs payloads with HMAC-SHA256 using the registered secret.
 * Used by Bob and the platform to push events to registered endpoints.
 */
import { Router } from 'express'
import { createHmac } from 'crypto'
import dns from 'dns'
import { requireAuth, requireAdminLevel } from '../lib/auth.js'

const router = Router()

// Private/reserved IP ranges (string-based, pre-DNS check)
const PRIVATE_IP_RE =
  /^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|0\.|::1$|fc00:|fd[0-9a-f]{2}:)/i

const BLOCKED_HOSTNAMES = new Set(['169.254.169.254', 'metadata.google.internal'])

/**
 * Check whether a resolved IP address is in a private/reserved range.
 * Called after DNS lookup to block DNS-rebinding attacks.
 */
function isPrivateIp(ip) {
  if (!ip) return true
  // IPv6 loopback / link-local
  if (ip === '::1' || ip.startsWith('fe80:') || ip.startsWith('fc') || ip.startsWith('fd'))
    return true
  // IPv4-mapped IPv6
  const v4 = ip.replace(/^::ffff:/i, '')
  return PRIVATE_IP_RE.test(v4)
}

/**
 * Full SSRF guard:
 * 1. Parse the URL and reject non-http(s), private hostnames, and metadata endpoints.
 * 2. Resolve the hostname via DNS and reject if ANY resolved address is private/reserved.
 *    This closes the DNS-rebinding attack path that a hostname-only check leaves open.
 */
async function assertPublicUrl(rawUrl) {
  let parsed
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new Error('Invalid URL')
  }

  const { hostname, protocol } = parsed
  if (protocol !== 'https:' && protocol !== 'http:') {
    throw new Error('Only http and https URLs are permitted')
  }
  if (PRIVATE_IP_RE.test(hostname) || BLOCKED_HOSTNAMES.has(hostname)) {
    throw new Error('Private or reserved hostname not permitted')
  }

  // Resolve all A/AAAA records and block if any resolve to a private range
  let addresses
  try {
    addresses = await dns.promises.lookup(hostname, { all: true })
  } catch {
    throw new Error(`DNS resolution failed for hostname: ${hostname}`)
  }

  for (const { address } of addresses) {
    if (isPrivateIp(address)) {
      throw new Error(`Hostname resolves to a private/reserved IP (${address}) — not permitted`)
    }
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
    // Disable automatic redirects to prevent redirect-based SSRF
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
  })

  return { ok: res.ok, status: res.status }
}

// POST /api/admin/webhook/test — admin can test a webhook endpoint
router.post('/api/admin/webhook/test', requireAuth, requireAdminLevel, async (req, res) => {
  const { url, secret, event = 'test.ping' } = req.body ?? {}
  if (!url || !secret) return res.status(400).json({ error: 'url and secret required' })

  try {
    await assertPublicUrl(url)
  } catch (e) {
    return res.status(400).json({ error: e.message })
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
