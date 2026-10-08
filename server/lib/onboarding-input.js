// Only explicitly allowed profile fields enter the service-role write path.
export function validateOnboardingInput(body) {
  const text = (key, max = 200) => {
    const value = body[key]
    if (value == null || value === '') return null
    if (typeof value !== 'string' || value.trim().length > max) {
      throw new Error(`Invalid ${key}`)
    }
    return value.trim() || null
  }
  const number = (key, min, max, fallback) => {
    if (body[key] == null || body[key] === '') return fallback
    const value = Number(body[key])
    if (!Number.isInteger(value) || value < min || value > max) throw new Error(`Invalid ${key}`)
    return value
  }
  const display_name = text('display_name', 100)
  if (!display_name) throw new Error('display_name is required')
  const handle = text('handle', 30)
  if (handle && !/^[a-z0-9_]{3,30}$/.test(handle)) {
    throw new Error('Handle must be 3–30 lowercase letters, numbers or underscores')
  }
  const avatar_url = text('avatar_url', 2048)
  if (avatar_url) {
    let url
    try { url = new URL(avatar_url) } catch { throw new Error('Invalid avatar_url') }
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Invalid avatar_url')
  }
  const owner_preferences = body.owner_preferences ?? null
  if (owner_preferences !== null) {
    if (typeof owner_preferences !== 'object' || Array.isArray(owner_preferences)) {
      throw new Error('Invalid owner_preferences')
    }
    const keys = ['metro', 'client_types', 'trades_needed', 'project_type', 'budget_range', 'timeline']
    for (const [key, value] of Object.entries(owner_preferences)) {
      if (!keys.includes(key) || (value !== null &&
        !(typeof value === 'string' && value.length <= 200) &&
        !(Array.isArray(value) && value.length <= 50 &&
          value.every(item => typeof item === 'string' && item.length <= 200)))) {
        throw new Error('Invalid owner_preferences')
      }
    }
  }
  const utm_params = body.utm_params ?? null
  if (utm_params !== null) {
    if (typeof utm_params !== 'object' || Array.isArray(utm_params)) throw new Error('Invalid utm_params')
    for (const [key, value] of Object.entries(utm_params)) {
      if (!['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].includes(key) ||
        typeof value !== 'string' || value.length > 500) throw new Error('Invalid utm_params')
    }
  }
  return {
    display_name, handle, avatar_url, owner_preferences, utm_params,
    location_city: text('location_city', 100),
    location_state: text('location_state', 50),
    trade: text('trade', 100),
    business_name: text('business_name', 200),
    bio: text('bio', 5000),
    years_experience: number('years_experience', 0, 100, 0),
    service_radius_miles: number('service_radius_miles', 1, 1000, 50),
    referral_code_used: text('referral_code_used', 100),
    referral_source: text('referral_source', 200),
  }
}
