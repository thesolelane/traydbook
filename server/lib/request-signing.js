import { createHmac, timingSafeEqual } from 'crypto'

function getSecret() {
  return process.env.ADMIN_REQUEST_SECRET || ''
}

export function signAdminRequest(method, path, body, timestamp, adminId) {
  const payload = `${method}|${path}|${JSON.stringify(body || {})}|${timestamp}|${adminId}`
  return createHmac('sha256', getSecret()).update(payload).digest('hex')
}

export function verifyAdminRequest(signature, method, path, body, timestamp, adminId) {
  if (!getSecret()) return true

  if (Date.now() - timestamp > 30000) {
    return false
  }

  const expected = signAdminRequest(method, path, body, timestamp, adminId)

  try {
    return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))
  } catch {
    return false
  }
}

export function requestSigningMiddleware(req, res, next) {
  if (!getSecret()) return next()

  const signature = req.headers['x-admin-signature']
  const timestamp = parseInt(req.headers['x-admin-timestamp'] || '0', 10)
  const adminId = req.user?.id || 'anonymous'

  if (!signature) return next()

  if (!verifyAdminRequest(signature, req.method, req.path, req.body, timestamp, adminId)) {
    return res.status(401).json({ error: 'Invalid or expired request signature' })
  }

  next()
}
