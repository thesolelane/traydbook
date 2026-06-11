/**
 * Prospect → User matching
 *
 * Scans outreach_prospects.email_found against public.users.email.
 * When a match is found the prospect is marked 'converted' and linked
 * to the user record so Bob never emails an existing member.
 *
 * Runs automatically every 7 days via the admin-server scheduler.
 * Can also be triggered manually via POST /api/admin/prospects/run-match.
 */

import { supabaseAdmin } from './clients.js'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
const SETTING_KEY = 'last_prospect_match_run'

/** Match all users against unlinked prospects. Returns { matched, users_checked }. */
export async function runProspectMatch() {
  // Fetch every onboarded user with an email — this is the small side of the join
  const { data: users, error: userErr } = await supabaseAdmin
    .from('users')
    .select('id, email, handle')
    .eq('onboarding_complete', true)
    .not('email', 'is', null)
    .limit(100000)

  if (userErr) return { matched: 0, users_checked: 0, error: userErr.message }
  if (!users?.length) {
    await recordRun()
    return { matched: 0, users_checked: 0 }
  }

  const now = new Date().toISOString()
  let matched = 0

  for (const user of users) {
    if (!user.email) continue

    const { data, error } = await supabaseAdmin
      .from('outreach_prospects')
      .update({
        joined_user_id: user.id,
        joined_at: now,
        status: 'converted',
        updated_at: now,
      })
      .ilike('email_found', user.email)     // case-insensitive email match
      .is('joined_user_id', null)           // not already linked
      .neq('status', 'converted')           // skip already-converted rows
      .select('id')

    if (!error && data) matched += data.length
  }

  await recordRun()
  return { matched, users_checked: users.length }
}

async function recordRun() {
  await supabaseAdmin
    .from('platform_settings')
    .update({ value: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('key', SETTING_KEY)
}

/** Returns last_run ISO string and computed next_run. */
export async function getMatchStatus() {
  const { data } = await supabaseAdmin
    .from('platform_settings')
    .select('value, updated_at')
    .eq('key', SETTING_KEY)
    .maybeSingle()

  const last_run = data?.value || null
  const next_run = last_run
    ? new Date(new Date(last_run).getTime() + SEVEN_DAYS_MS).toISOString()
    : null

  return { last_run, next_run }
}

/** True if 7 days have elapsed since the last run (or never run). */
export async function shouldRunMatch() {
  const { last_run } = await getMatchStatus()
  if (!last_run) return true
  return Date.now() - new Date(last_run).getTime() > SEVEN_DAYS_MS
}
