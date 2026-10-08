import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { supabaseAdmin } from '../lib/clients.js'
import { requireAuth } from '../lib/auth.js'
import { validateOnboardingInput } from '../lib/onboarding-input.js'
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
  'contractor',
  'project_owner',
  'real_estate_agent',
  'homeowner',
  'design_professional',
  'investor',
  'brokerage',
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
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Invalid profile data' })
  }
  let input
  try {
    input = validateOnboardingInput(req.body)
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }
  const {
    display_name,
    location_city,
    location_state,
    trade,
    business_name,
    years_experience,
    service_radius_miles,
    bio,
    avatar_url,
    referral_code_used, // optional — code from the referrer's link
    owner_preferences,
    referral_source,
    utm_params,
  } = input
  const { account_type } = req.body
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

  const handle = input.handle || slugify(display_name)

  // ── Referral system ───────────────────────────────────────────────────────
  let referralCode = null
  let welcomeCredits = 0
  const referralEnabled = await isReferralEnabled()

  if (referralEnabled) {
    // Generate a referral code for eligible account types
    if (REFERRAL_ELIGIBLE_TYPES.includes(account_type)) {
      try {
        referralCode = await generateUniqueCode()
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
    location_city: location_city?.trim() || null,
    location_state: location_state || null,
    credit_balance: welcomeCredits,
    onboarding_complete: true,
    referral_code: referralCode,
    avatar_url: avatar_url || null,
    owner_preferences: account_type === 'contractor' ? null : owner_preferences,
    referral_source,
    utm_params,
    referred_at: referral_code_used || referral_source ? new Date().toISOString() : null,
  })

  if (userErr) {
    console.error('[onboarding] users insert error:', userErr)
    return res.status(userErr.code === '23505' ? 409 : 500).json({ error: userErr.message })
  }

  if (account_type === 'contractor') {
    const { error: cpErr } = await supabaseAdmin.from('contractor_profiles').insert({
      user_id: userId,
      primary_trade: trade || 'General Contractor',
      business_name: business_name?.trim() || null,
      years_experience: Number.isFinite(years_experience) ? years_experience : (years_experience ? parseInt(years_experience) : 0),
      service_radius_miles: Number.isFinite(service_radius_miles) ? service_radius_miles : (service_radius_miles ? parseInt(service_radius_miles) : 50),
      bio: bio?.trim() || null,
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
        result.held ? '(held until balance exhausted)' : '(added to balance)'
      )
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  res.json({
    ok: true,
    referral_code: referralCode,
    welcome_credits: welcomeCredits,
  })
})

export default router
