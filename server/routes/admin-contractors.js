import { Router } from 'express'
import { supabaseAdmin } from '../lib/clients.js'
import { requireAuth, requireAdminLevel } from '../lib/auth.js'

const router = Router()

// GET /api/admin/contractors
// List all contractors with trust score, lead bank balance, badge tier, pass count.
router.get('/api/admin/contractors', requireAuth, requireAdminLevel, async (req, res) => {
  const { search = '', page = '0' } = req.query
  const PAGE_SIZE = 50
  const offset = parseInt(page, 10) * PAGE_SIZE

  let query = supabaseAdmin
    .from('contractor_profiles')
    .select(`
      user_id,
      primary_trade,
      secondary_trades,
      badge_tier,
      trust_score,
      lead_bank_balance,
      rating_avg,
      rating_count,
      projects_completed,
      years_experience,
      users!user_id (
        id,
        display_name,
        handle,
        avatar_url,
        created_at,
        deleted_at
      )
    `)
    .order('trust_score', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })

  let rows = (data ?? []).map(r => {
    const u = r.users as Record<string, unknown> | null
    return {
      user_id: r.user_id,
      display_name: (u?.display_name as string) ?? '—',
      handle: (u?.handle as string) ?? '',
      avatar_url: (u?.avatar_url as string | null) ?? null,
      created_at: (u?.created_at as string) ?? '',
      deleted_at: (u?.deleted_at as string | null) ?? null,
      primary_trade: r.primary_trade,
      badge_tier: r.badge_tier,
      trust_score: r.trust_score ?? 0,
      lead_bank_balance: r.lead_bank_balance ?? 0,
      rating_avg: r.rating_avg ?? 0,
      rating_count: r.rating_count ?? 0,
      projects_completed: r.projects_completed ?? 0,
      years_experience: r.years_experience ?? 0,
    }
  })

  if (search) {
    const q = search.toLowerCase()
    rows = rows.filter(
      r =>
        r.display_name.toLowerCase().includes(q) ||
        r.handle.toLowerCase().includes(q) ||
        r.primary_trade.toLowerCase().includes(q)
    )
  }

  res.json({ contractors: rows, page: parseInt(page, 10), page_size: PAGE_SIZE })
})

// POST /api/admin/contractors/:userId/lead-bank/adjust
// Grant or deduct leads from a contractor's bank.
// Body: { delta: number, reason: string }
router.post(
  '/api/admin/contractors/:userId/lead-bank/adjust',
  requireAuth,
  requireAdminLevel,
  async (req, res) => {
    const { userId } = req.params
    const { delta, reason } = req.body ?? {}

    if (delta === undefined || !reason) {
      return res.status(400).json({ error: 'delta and reason are required' })
    }

    const { data, error } = await supabaseAdmin.rpc('adjust_lead_bank', {
      p_user_id: userId,
      p_delta: delta,
      p_reason: reason,
      p_by: req.user.id,
    })

    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true, new_balance: data })
  }
)

// POST /api/admin/contractors/:userId/trust-score/recalc
// Manually trigger a trust score recalculation for one contractor.
router.post(
  '/api/admin/contractors/:userId/trust-score/recalc',
  requireAuth,
  requireAdminLevel,
  async (req, res) => {
    const { userId } = req.params

    const { data, error } = await supabaseAdmin.rpc('calculate_trust_score', {
      p_user_id: userId,
    })

    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true, new_score: data })
  }
)

// GET /api/admin/contractors/:userId/lead-bank/ledger
// Last 50 ledger entries for a contractor.
router.get(
  '/api/admin/contractors/:userId/lead-bank/ledger',
  requireAuth,
  requireAdminLevel,
  async (req, res) => {
    const { userId } = req.params

    const { data, error } = await supabaseAdmin
      .from('lead_bank_ledger')
      .select('id, delta, balance_after, reason, created_by, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) return res.status(500).json({ error: error.message })
    res.json({ ledger: data ?? [] })
  }
)

export default router
