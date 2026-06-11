/**
 * Referral system helpers.
 * All logic is gated behind the referral_system_enabled platform flag.
 * Called from onboarding.js at the point a new user profile is created.
 */
import { supabaseAdmin } from './clients.js'

export const REFERRAL_ELIGIBLE_TYPES = ['homeowner', 'investor']
const WELCOME_CREDITS = 50
const REFERRAL_CREDITS = 10
const WELCOME_COHORT_LIMIT = 100 // first N of each type get welcome bonus
const SUNSET_THRESHOLD = 500 // total subscribed users after which bonuses stop

// ── Platform flag check ───────────────────────────────────────────────────────

export async function isReferralEnabled() {
  const { data } = await supabaseAdmin
    .from('platform_settings')
    .select('value')
    .eq('key', 'referral_system_enabled')
    .single()
  return data?.value === 'true'
}

// ── Referral code generation ──────────────────────────────────────────────────

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateCode() {
  let code = 'TB'
  for (let i = 0; i < 7; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  return code
}

export async function generateUniqueCode(retries = 5) {
  for (let i = 0; i < retries; i++) {
    const code = generateCode()
    const { data } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('referral_code', code)
      .maybeSingle()
    if (!data) return code
  }
  throw new Error('Failed to generate unique referral code')
}

// ── Welcome credit calculation ────────────────────────────────────────────────

export async function calcWelcomeCredits(accountType) {
  if (!REFERRAL_ELIGIBLE_TYPES.includes(accountType)) return 0

  // Count total fully-onboarded users — sunset check
  // TODO: also require at least one post/like/comment once engagement tables confirmed
  const { count: totalSubscribed } = await supabaseAdmin
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('onboarding_complete', true)

  if ((totalSubscribed ?? 0) >= SUNSET_THRESHOLD) return 0

  // Count how many of this type are already onboarded — cohort check
  const { count: cohortPos } = await supabaseAdmin
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('account_type', accountType)
    .eq('onboarding_complete', true)

  if ((cohortPos ?? 0) >= WELCOME_COHORT_LIMIT) return 0

  return WELCOME_CREDITS
}

// ── Award referral credit to referrer ────────────────────────────────────────

/**
 * Called after a new user is created.
 * Finds the referrer by code, awards REFERRAL_CREDITS to their balance
 * OR holds them in referral_credits_held if the referrer still has a balance.
 * Returns { ok, held, credits } or { ok: false, reason }.
 */
export async function awardReferralCredit(referralCodeUsed, referredUserId) {
  const { data: referrer, error } = await supabaseAdmin
    .from('users')
    .select('id, credit_balance, referral_credits_held, account_type')
    .eq('referral_code', referralCodeUsed)
    .maybeSingle()

  if (error || !referrer) return { ok: false, reason: 'referral code not found' }
  if (!REFERRAL_ELIGIBLE_TYPES.includes(referrer.account_type)) {
    return { ok: false, reason: 'referrer account type not eligible' }
  }
  if (referrer.id === referredUserId) {
    return { ok: false, reason: 'self-referral not allowed' }
  }

  // Hold if the referrer still has any credits left — release trigger handles the rest
  const held = referrer.credit_balance > 0

  const { error: logErr } = await supabaseAdmin.from('referral_signups').insert({
    referral_code: referralCodeUsed,
    referrer_id: referrer.id,
    referred_user_id: referredUserId,
    credits_earned: REFERRAL_CREDITS,
    held,
  })

  if (logErr) {
    // Unique constraint on referred_user_id — this user was already referred
    if (logErr.code === '23505') return { ok: false, reason: 'user already referred' }
    console.error('[referral] referral_signups insert error:', logErr)
    return { ok: false, reason: logErr.message }
  }

  if (held) {
    await supabaseAdmin
      .from('users')
      .update({ referral_credits_held: referrer.referral_credits_held + REFERRAL_CREDITS })
      .eq('id', referrer.id)
  } else {
    await supabaseAdmin
      .from('users')
      .update({ credit_balance: referrer.credit_balance + REFERRAL_CREDITS })
      .eq('id', referrer.id)
  }

  return { ok: true, held, credits: REFERRAL_CREDITS }
}
