import { Router } from 'express'
import { supabaseAdmin } from '../lib/clients.js'
import { requireAuth } from '../lib/auth.js'

const router = Router()

// GET /api/lead-bank/balance
// Returns the authenticated contractor's current lead bank balance + last 20 ledger entries.
router.get('/api/lead-bank/balance', requireAuth, async (req, res) => {
  const userId = req.user.id

  const { data: cp, error: cpErr } = await supabaseAdmin
    .from('contractor_profiles')
    .select('lead_bank_balance')
    .eq('user_id', userId)
    .maybeSingle()

  if (cpErr) return res.status(500).json({ error: cpErr.message })
  if (!cp) return res.status(404).json({ error: 'Contractor profile not found' })

  const { data: ledger, error: ledgerErr } = await supabaseAdmin
    .from('lead_bank_ledger')
    .select('id, delta, balance_after, reason, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (ledgerErr) return res.status(500).json({ error: ledgerErr.message })

  res.json({
    balance: cp.lead_bank_balance,
    ledger: ledger ?? [],
  })
})

// POST /api/lead-bank/adjust
// Admin-only: add or deduct leads from a contractor's bank.
// Body: { user_id, delta, reason }
router.post('/api/lead-bank/adjust', requireAuth, async (req, res) => {
  // Only allow users with admin role to call this
  const { data: caller } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', req.user.id)
    .maybeSingle()

  if (!caller || caller.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' })
  }

  const { user_id, delta, reason } = req.body ?? {}

  if (!user_id || delta === undefined || !reason) {
    return res.status(400).json({ error: 'user_id, delta, and reason are required' })
  }

  const { data, error } = await supabaseAdmin.rpc('adjust_lead_bank', {
    p_user_id: user_id,
    p_delta: delta,
    p_reason: reason,
    p_by: req.user.id,
  })

  if (error) return res.status(500).json({ error: error.message })

  res.json({ ok: true, new_balance: data })
})

export default router
