/**
 * Referral / UTM tracking utility
 *
 * On first landing, reads URL params and stores them in sessionStorage.
 * At signup, retrieve and attach to the user row.
 *
 * Tracked params: ref, utm_source, utm_medium, utm_campaign, utm_content, utm_term
 */

const STORAGE_KEY = 'trayd_referral'

export interface ReferralData {
  referral_source: string | null
  referral_code: string | null
  utm_params: Record<string, string> | null
  referred_at: string
}

/** Call once on app mount — captures URL params if present */
export function captureReferral(): void {
  // Don't overwrite if already captured this session
  if (sessionStorage.getItem(STORAGE_KEY)) return

  const params = new URLSearchParams(window.location.search)
  const ref = params.get('ref')
  const utmSource = params.get('utm_source')

  if (!ref && !utmSource) return  // no tracking params — organic visit

  const utmParams: Record<string, string> = {}
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
    const val = params.get(key)
    if (val) utmParams[key] = val
  }

  const data: ReferralData = {
    referral_source: utmSource || ref || null,
    referral_code: ref || null,
    utm_params: Object.keys(utmParams).length > 0 ? utmParams : null,
    referred_at: new Date().toISOString(),
  }

  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

/** Returns captured referral data, or null if no tracking params were seen */
export function getReferral(): ReferralData | null {
  const raw = sessionStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as ReferralData
  } catch {
    return null
  }
}

/** Clear after writing to DB so it doesn't get re-applied */
export function clearReferral(): void {
  sessionStorage.removeItem(STORAGE_KEY)
}
