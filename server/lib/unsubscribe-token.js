import { createHmac, timingSafeEqual } from 'crypto'

function getSecret() {
  return (
    process.env.UNSUBSCRIBE_TOKEN_SECRET ||
    process.env.STRIPE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'dev-fallback-unsubscribe-secret'
  )
}

export function generateUnsubscribeToken(email) {
  const payload = Buffer.from(email.toLowerCase().trim()).toString('base64url')
  const sig = createHmac('sha256', getSecret()).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export function verifyUnsubscribeToken(token) {
  if (!token || typeof token !== 'string') return null
  const dot = token.lastIndexOf('.')
  if (dot < 1) return null
  const payload = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = createHmac('sha256', getSecret()).update(payload).digest('base64url')
  try {
    const expectedBuf = Buffer.from(expected, 'utf-8')
    const sigBuf = Buffer.from(sig, 'utf-8')
    if (expectedBuf.length !== sigBuf.length) return null
    if (!timingSafeEqual(expectedBuf, sigBuf)) return null
  } catch {
    return null
  }
  try {
    return Buffer.from(payload, 'base64url').toString('utf-8')
  } catch {
    return null
  }
}
