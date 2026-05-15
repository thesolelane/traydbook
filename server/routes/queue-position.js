import { Router } from 'express'
import { supabaseAdmin } from '../lib/clients.js'

const router = Router()

// GET /api/contractor/:id/queue-position
// Returns the contractor's ranked position among active contractors in the same trade.
// Public endpoint — position number is visible on the profile.
router.get('/api/contractor/:id/queue-position', async (req, res) => {
  const { id } = req.params

  // Get this contractor's trade and trust score
  const { data: self, error: selfErr } = await supabaseAdmin
    .from('contractor_profiles')
    .select('primary_trade, trust_score')
    .eq('user_id', id)
    .single()

  if (selfErr || !self) return res.status(404).json({ error: 'Contractor not found' })

  const { primary_trade, trust_score } = self

  // Count how many active contractors in the same trade have a HIGHER trust score
  // (that count + 1 = this contractor's position)
  const { count: aheadCount, error: aheadErr } = await supabaseAdmin
    .from('contractor_profiles')
    .select('id', { count: 'exact', head: true })
    .eq('primary_trade', primary_trade)
    .gt('trust_score', trust_score)
    .neq('user_id', id)

  if (aheadErr) return res.status(500).json({ error: aheadErr.message })

  // Total active contractors in this trade
  const { count: totalCount, error: totalErr } = await supabaseAdmin
    .from('contractor_profiles')
    .select('id', { count: 'exact', head: true })
    .eq('primary_trade', primary_trade)

  if (totalErr) return res.status(500).json({ error: totalErr.message })

  const position = (aheadCount ?? 0) + 1
  const total = totalCount ?? 1

  // Find the score of the contractor just ahead (to show how close they are to moving up)
  let score_to_advance = null
  if (position > 1) {
    const { data: nextUp } = await supabaseAdmin
      .from('contractor_profiles')
      .select('trust_score')
      .eq('primary_trade', primary_trade)
      .gt('trust_score', trust_score)
      .neq('user_id', id)
      .order('trust_score', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (nextUp) {
      score_to_advance = nextUp.trust_score - trust_score
    }
  }

  res.json({
    position,
    total,
    trade: primary_trade,
    trust_score,
    score_to_advance,
    percentile: total > 1 ? Math.round((1 - (position - 1) / (total - 1)) * 100) : 100,
  })
})

export default router
