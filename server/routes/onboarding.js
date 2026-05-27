import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { supabaseAdmin } from '../lib/clients.js'
import { requireAuth } from '../lib/auth.js'
import {
  isReferralEnabled,
  generateUniqueCode,
  calcWelcomeCredits,
  awardReferralCredit,
  REFERRAL_ELIGIBLE_TYPES,
} from '../lib/referral.js'

const router = Router()

const onboardingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many signup attempts from this IP — please try again in an hour.' },
})

const VALID_ACCOUNT_TYPES = [
  'contractor', 'project_owner', 'agent', 'homeowner', 'investor', 'brokerage',
]

function slugify(name) {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 20) || 'user'
  const suffix = Math.floor(1000 + Math.random() * 9000)
  return `${base}${suffix}`
}

router.post('/api/onboarding/complete', onboardingLimiter, requireAuth, async (req, res) => {
  const {
    display_name,
    account_type,
    location_city,
    location_state,
    trade,
    referral_code_used,   // optional — code from the referrer's link
  } = req.body
  const userId = req.user.id

  if (!display_name?.trim()) {
    return res.status(400).json({ error: 'display_name is required' })
  }
  if (!VALID_ACCOUNT_TYPES.includes(account_type)) {
    return res.status(400).json({ error: 'Invalid account_type' })
  }

  const { data: existing } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('id', userId)
    .single()

  if (existing) {
    return res.status(409).json({ error: 'Profile already exists' })
  }

  const handle = slugify(display_name.trim())

  // ── Referral system ───────────────────────────────────────────────────────
  let referralCode     = null
  let welcomeCredits   = 0
  const referralEnabled = await isReferralEnabled()

  if (referralEnabled) {
    // Generate a referral code for eligible account types
    if (REFERRAL_ELIGIBLE_TYPES.includes(account_type)) {
      try {
        referralCode   = await generateUniqueCode()
        welcomeCredits = await calcWelcomeCredits(account_type)
      } catch (err) {
        console.error('[onboarding] referral code generation error:', err)
        // Non-fatal — continue without code
      }
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  const { error: userErr } = await supabaseAdmin.from('users').insert({
    id: userId,
    email: req.user.email,
    display_name: display_name.trim(),
    handle,
    account_type,
    location_city:   location_city?.trim() || null,
    location_state:  location_state || null,
    credit_balance:  welcomeCredits,
    onboarding_complete: true,
    referral_code:   referralCode,
  })

  if (userErr) {
    console.error('[onboarding] users insert error:', userErr)
    return res.status(500).json({ error: userErr.message })
  }

  if (account_type === 'contractor') {
    const { error: cpErr } = await supabaseAdmin.from('contractor_profiles').insert({
      user_id:      userId,
      primary_trade: trade || 'General Contractor',
    })
    if (cpErr) {
      console.error('[onboarding] contractor_profiles insert error:', cpErr)
      return res.status(500).json({ error: cpErr.message })
    }
  }

  // ── Award referral credit to the referrer ─────────────────────────────────
  if (referralEnabled && referral_code_used?.trim()) {
    const result = await awardReferralCredit(referral_code_used.trim(), userId)
    if (!result.ok) {
      console.warn('[onboarding] referral award skipped:', result.reason)
    } else {
      console.log(
        `[onboarding] referral credited — referrer earned ${result.credits} cr`,
        result.held ? '(held until balance exhausted)' : '(added to balance)',
      )
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  res.json({
    ok: true,
    referral_code:   referralCode,
    welcome_credits: welcomeCredits,
  })
})

export default router
