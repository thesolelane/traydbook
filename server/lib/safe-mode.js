import crypto from 'crypto'

let safeModeActive = false
let safeModeReason = ''
const quarantineLog = []

export function activateSafeMode(app, reason) {
  safeModeActive = true
  safeModeReason = reason
  console.warn(`🛡️  SAFE_MODE activated: ${reason}`)
}

export function isSafeMode() {
  return safeModeActive
}

export function getSafeModeReason() {
  return safeModeReason
}

export function quarantineRequest(req, reason) {
  const id = crypto.randomUUID()
  const entry = {
    id,
    timestamp: new Date().toISOString(),
    ip: req.ip,
    method: req.method,
    path: req.path,
    headers: sanitizeHeaders(req.headers),
    body: req.body ? JSON.stringify(req.body).substring(0, 1000) : null,
    reason,
  }
  quarantineLog.push(entry)
  console.log(`🛡️  QUARANTINED [${id}]: ${req.method} ${req.path} from ${req.ip}`)
  return id
}

export function getQuarantineLog() {
  return quarantineLog
}

function sanitizeHeaders(headers) {
  const sanitized = {}
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string' && !key.toLowerCase().includes('authorization')) {
      sanitized[key] = value
    }
  }
  return sanitized
}
