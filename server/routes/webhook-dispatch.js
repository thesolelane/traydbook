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
