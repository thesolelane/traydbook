import { Router } from 'express'
import { supabaseAdmin } from '../lib/clients.js'

const router = Router()

// GET /api/contractor/:id/trust-score
// Public — returns trust score + breakdown for a contractor user_id
router.get('/api/contractor/:id/trust-score', async (req, res) => {
  const { id } = req.params

  const { data: cp, error: cpErr } = await supabaseAdmin
    .from('contractor_profiles')
    .select(
      'trust_score, trust_score_updated_at, badge_tier, bio, years_experience, secondary_trades, service_radius_miles, rating_avg, rating_count, projects_completed, id'
    )
    .eq('user_id', id)
    .single()

  if (cpErr || !cp) return res.status(404).json({ error: 'Contractor not found' })

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('avatar_url')
    .eq('id', id)
    .single()

  const { data: cred } = await supabaseAdmin
    .from('credentials')
    .select('id')
    .eq('contractor_id', cp.id)
    .eq('status', 'active')
    .not('verified_at', 'is', null)
    .limit(1)
    .maybeSingle()

  const breakdown = [
    {
      label: 'Profile photo',
      earned: !!user?.avatar_url,
      points: 10,
      tip: 'Add a profile photo',
    },
    {
      label: 'Bio',
      earned: !!(cp.bio && cp.bio.trim().length >= 20),
      points: 10,
      tip: 'Write a bio (at least 20 characters)',
    },
    {
      label: 'Years of experience',
      earned: cp.years_experience > 0,
      points: 5,
      tip: 'Set your years of experience',
    },
    {
      label: 'Trades & service area',
      earned: cp.secondary_trades?.length > 0 || cp.service_radius_miles !== 50,
      points: 5,
      tip: 'Add secondary trades or customise your service radius',
    },
    {
      label: 'Verified credential',
      earned: !!cred,
      points: 20,
      tip: 'Submit a license or credential for verification',
    },
    {
      label: 'Verified badge',
      earned: !!cp.badge_tier,
      points:
        cp.badge_tier === 'pro_verified'
          ? 20
          : cp.badge_tier === 'licensed'
            ? 15
            : cp.badge_tier === 'vouched'
              ? 10
              : 0,
      tip: 'Earn a Verified badge (Vouched, Licensed, or Pro Verified)',
    },
    {
      label: 'Client ratings',
      earned: cp.rating_avg >= 3.5 && cp.rating_count >= 1,
      points: Math.min(
        (cp.rating_avg >= 3.5 && cp.rating_count >= 1 ? 5 : 0) +
          (cp.rating_avg >= 4.0 && cp.rating_count >= 3 ? 5 : 0) +
          (cp.rating_avg >= 4.5 && cp.rating_count >= 5 ? 5 : 0),
        15
      ),
      tip: 'Receive reviews from clients',
    },
    {
      label: 'Projects completed',
      earned: cp.projects_completed >= 1,
      points: Math.min(
        (cp.projects_completed >= 1 ? 5 : 0) +
          (cp.projects_completed >= 5 ? 5 : 0) +
          (cp.projects_completed >= 20 ? 5 : 0),
        15
      ),
      tip: 'Log completed projects on your profile',
    },
  ]

  res.json({
    trust_score: cp.trust_score,
    updated_at: cp.trust_score_updated_at,
    breakdown,
  })
})

// POST /api/contractor/:id/trust-score/recalculate
// Internal — forces a recalc (useful after credential verification, badge award, etc.)
router.post('/api/contractor/:id/trust-score/recalculate', async (req, res) => {
  const { id } = req.params

  const { data, error } = await supabaseAdmin.rpc('recalculate_trust_score', { p_user_id: id })

  if (error) return res.status(500).json({ error: error.message })

  // Persist the new score
  await supabaseAdmin
    .from('contractor_profiles')
    .update({ trust_score: data, trust_score_updated_at: new Date().toISOString() })
    .eq('user_id', id)

  res.json({ trust_score: data })
})

export default router
