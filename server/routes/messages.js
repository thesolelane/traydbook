import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/clients.js'
import { requireAuth } from '../lib/auth.js'

const router = Router()
const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
})

router.post('/api/messages/send', messageLimiter, requireAuth, async (req, res) => {
  const { recipient_id, body } = req.body ?? {}
  if (typeof recipient_id !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(recipient_id) ||
    recipient_id === req.user.id) {
    return res.status(400).json({ error: 'Invalid recipient' })
  }
  if (typeof body !== 'string' || !body.trim() || body.length > 10000) {
    return res.status(400).json({ error: 'Message must contain 1–10000 characters' })
  }
  const threadId = [req.user.id, recipient_id].sort().join('_')
  // Forward the verified JWT so the transaction derives its sender from auth.uid(),
  // never a client-supplied sender ID, balance, or cost.
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: req.headers.authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await client.rpc('send_message', {
    p_recipient_id: recipient_id,
    p_thread_id: threadId,
    p_body: body.trim(),
  })
  if (error) {
    const status = error.message.includes('Insufficient credits') ? 402
      : error.code === 'P0001' ? 400 : 500
    return res.status(status).json({ error: error.message })
  }
  res.json({ message_id: data, thread_id: threadId })
})

export default router
