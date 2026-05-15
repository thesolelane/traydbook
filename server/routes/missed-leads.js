import { Router } from 'express'
import { supabaseAdmin } from '../lib/clients.js'
import { requireAuth } from '../lib/auth.js'

const router = Router()

// GET /api/contractor/missed-leads
// Returns the count of RFQs in the contractor's primary trade that closed or were
// awarded in the last 30 days WITHOUT this contractor submitting a bid.
// These are projects that went to other contractors — not "leads withheld from this user."
// Used to show the contractor how active their local market is and motivate profile completion.
router.get('/api/contractor/missed-leads', requireAuth, async (req, res) => {
  const userId = req.user.id

  // Get contractor's trade
  const { data: cp, error: cpErr } = await supabaseAdmin
    .from('contractor_profiles')
    .select('primary_trade, trust_score, badge_tier')
    .eq('user_id', userId)
    .maybeSingle()

  if (cpErr) return res.status(500).json({ error: cpErr.message })
  if (!cp) return res.status(404).json({ error: 'Contractor profile not found' })

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // All closed/awarded RFQs in this trade in the last 30 days
  const { data: closedRfqs, error: rfqErr } = await supabaseAdmin
    .from('rfqs')
    .select('id')
    .eq('trade_needed', cp.primary_trade)
    .in('status', ['awarded', 'closed'])
    .gte('updated_at', thirtyDaysAgo)

  if (rfqErr) return res.status(500).json({ error: rfqErr.message })
  if (!closedRfqs || closedRfqs.length === 0) {
    return res.json({ missed: 0, trade: cp.primary_trade, trust_score: cp.trust_score })
  }

  const rfqIds = closedRfqs.map(r => r.id)

  // RFQs the contractor DID bid on
  const { data: myBids, error: bidsErr } = await supabaseAdmin
    .from('bid_submissions')
    .select('rfq_id')
    .eq('bidder_id', userId)
    .in('rfq_id', rfqIds)

  if (bidsErr) return res.status(500).json({ error: bidsErr.message })

  const biddedIds = new Set((myBids ?? []).map(b => b.rfq_id))
  const missed = rfqIds.filter(id => !biddedIds.has(id)).length

  res.json({
    missed,
    trade: cp.primary_trade,
    trust_score: cp.trust_score ?? 0,
    badge_tier: cp.badge_tier ?? null,
    since: thirtyDaysAgo,
  })
})

export default router
