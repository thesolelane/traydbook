import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { supabaseAdmin } from '../lib/clients.js'
import { requireAuth } from '../lib/auth.js'

const router = Router()

const transferLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many transfer requests — try again in an hour.' },
})

const VALID_TRANSFER_TYPES = ['transfer', 'brokerage_issue', 'gift', 'reward']

// POST /api/credits/transfer
// Send credits from the authenticated user to another user.
// Body: { to_user_id, amount, note?, transfer_type? }
router.post('/api/credits/transfer', transferLimiter, requireAuth, async (req, res) => {
  const fromUserId = req.user.id
  const { to_user_id, amount, note, transfer_type = 'transfer' } = req.body

  if (!to_user_id) {
    return res.status(400).json({ error: 'to_user_id is required' })
  }
  if (fromUserId === to_user_id) {
    return res.status(400).json({ error: 'Cannot transfer credits to yourself' })
  }

  const parsed = parseInt(amount, 10)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return res.status(400).json({ error: 'amount must be a positive integer' })
  }
  if (parsed > 100000) {
    return res.status(400).json({ error: 'amount exceeds single-transfer limit (100,000)' })
  }
  if (!VALID_TRANSFER_TYPES.includes(transfer_type)) {
    return res
      .status(400)
      .json({ error: `Invalid transfer_type. Must be one of: ${VALID_TRANSFER_TYPES.join(', ')}` })
  }

  // Check recipient exists before hitting the RPC
  const { data: recipient } = await supabaseAdmin
    .from('users')
    .select('id, display_name, account_type')
    .eq('id', to_user_id)
    .maybeSingle()

  if (!recipient) {
    return res.status(404).json({ error: 'Recipient not found' })
  }

  const { data, error } = await supabaseAdmin.rpc('transfer_credits', {
    p_from_user_id: fromUserId,
    p_to_user_id: to_user_id,
    p_amount: parsed,
    p_note: note?.trim() || null,
    p_transfer_type: transfer_type,
  })

  if (error) {
    const msg = error.message || ''
    if (msg.includes('insufficient_credits')) {
      return res.status(402).json({ error: 'Insufficient credits' })
    }
    if (msg.includes('recipient_not_found')) {
      return res.status(404).json({ error: 'Recipient not found' })
    }
    console.error('[credits/transfer] RPC error:', error)
    return res.status(500).json({ error: 'Transfer failed' })
  }

  res.json({
    ok: true,
    new_balance: data,
    transferred: parsed,
    to: { id: recipient.id, display_name: recipient.display_name },
  })
})

// GET /api/credits/transfers
// Return the authenticated user's transfer history (sent and received).
router.get('/api/credits/transfers', requireAuth, async (req, res) => {
  const userId = req.user.id
  const limit = Math.min(parseInt(req.query.limit) || 50, 200)
  const direction = req.query.direction // 'sent' | 'received' | undefined (both)

  let query = supabaseAdmin
    .from('credit_transfers')
    .select(
      `
      id, amount, note, transfer_type, created_at,
      from_user:from_user_id ( id, display_name, account_type ),
      to_user:to_user_id     ( id, display_name, account_type )
    `
    )
    .order('created_at', { ascending: false })
    .limit(limit)

  if (direction === 'sent') {
    query = query.eq('from_user_id', userId)
  } else if (direction === 'received') {
    query = query.eq('to_user_id', userId)
  } else {
    query = query.or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
  }

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })

  res.json({ transfers: data ?? [] })
})

// GET /api/credits/balance
// Return the authenticated user's current credit balance.
router.get('/api/credits/balance', requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('credit_balance, referral_credits_held')
    .eq('id', req.user.id)
    .single()

  if (error) return res.status(500).json({ error: error.message })

  res.json({
    balance: data.credit_balance,
    held: data.referral_credits_held,
  })
})

export default router
