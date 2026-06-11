/**
 * Admin: Referral stats per user
 *
 * GET /api/admin/referrals?q=&limit=   — search users with referral activity
 * GET /api/admin/referrals/:userId      — full referral detail for one user
 */
import { Router } from 'express'
import { supabaseAdmin } from '../lib/clients.js'
import { requireAuth, requireAdminLevel } from '../lib/auth.js'

const router = Router()

// Search users that have a referral_code or held credits
router.get('/api/admin/referrals', requireAuth, requireAdminLevel, async (req, res) => {
  const q = (req.query.q ?? '').trim()
  const limit = Math.min(parseInt(req.query.limit ?? '50', 10), 200)

  let query = supabaseAdmin
    .from('users')
    .select(
      'id, display_name, handle, email, account_type, referral_code, referral_credits_held, credit_balance, created_at'
    )
    .order('created_at', { ascending: false })
    .limit(limit)

  if (q) {
    query = query.or(
      `display_name.ilike.%${q}%,handle.ilike.%${q}%,email.ilike.%${q}%,referral_code.ilike.%${q}%`
    )
  } else {
    // Default: only users with any referral activity
    query = query.or('referral_code.not.is.null,referral_credits_held.gt.0')
  }

  const { data: users, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  if (!users?.length) return res.json({ users: [] })

  // Attach referral signup counts (as referrer) for each user
  const ids = users.map(u => u.id)
  const { data: signups } = await supabaseAdmin
    .from('referral_signups')
    .select('referrer_id, held')
    .in('referrer_id', ids)

  const counts = {}
  for (const s of signups ?? []) {
    if (!counts[s.referrer_id]) counts[s.referrer_id] = { total: 0, held: 0, released: 0 }
    counts[s.referrer_id].total += 1
    if (s.held) counts[s.referrer_id].held += 1
    else counts[s.referrer_id].released += 1
  }

  const result = users.map(u => ({
    ...u,
    referral_count: counts[u.id]?.total ?? 0,
    referrals_held: counts[u.id]?.held ?? 0,
    referrals_released: counts[u.id]?.released ?? 0,
  }))

  res.json({ users: result })
})

// Full referral detail for one user: their profile + every referral signup they generated
router.get('/api/admin/referrals/:userId', requireAuth, requireAdminLevel, async (req, res) => {
  const { userId } = req.params

  const [{ data: user, error: userErr }, { data: signups, error: sigErr }] = await Promise.all([
    supabaseAdmin
      .from('users')
      .select(
        'id, display_name, handle, email, account_type, referral_code, referral_credits_held, credit_balance, created_at'
      )
      .eq('id', userId)
      .single(),
    supabaseAdmin
      .from('referral_signups')
      .select(
        `
        id, credits_earned, held, released_at, created_at,
        referred_user:referred_user_id ( id, display_name, handle, email, account_type )
      `
      )
      .eq('referrer_id', userId)
      .order('created_at', { ascending: false }),
  ])

  if (userErr) return res.status(404).json({ error: 'User not found' })
  if (sigErr) return res.status(500).json({ error: sigErr.message })

  res.json({ user, signups: signups ?? [] })
})

export default router
