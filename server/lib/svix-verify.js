/**
 * Svix signature verification helper
 *
 * Spec: https://docs.svix.com/receiving/verifying-payloads/how
 *
 * Secret format : "whsec_<base64>" — the prefix is stripped and the
 *                 remainder decoded to raw bytes before signing.
 * Signed content: "{svix-id}.{svix-timestamp}.{raw-body}"
 * Header        : svix-signature = "v1,<base64sig1> v1,<base64sig2> ..."
 *
 * Returns true only when:
 *   - all three Svix headers are present
 *   - the timestamp is within ±5 minutes of now  (replay protection)
 *   - at least one v1 token in svix-signature matches the HMAC
 */

import { createHmac, timingSafeEqual } from 'crypto'

/**
 * @param {string|Buffer} rawBody   raw request body (UTF-8 string or Buffer)
 * @param {object}        headers   request headers object (lower-cased keys)
 * @param {string}        secret    RESEND_WEBHOOK_SECRET ("whsec_..." or plain base64)
 * @returns {boolean}
 */
export function verifySvixSignature(rawBody, headers, secret) {
  if (!secret) return false

  const msgId        = headers['svix-id']
  const msgTimestamp = headers['svix-timestamp']
  const msgSignature = headers['svix-signature']

  if (!msgId || !msgTimestamp || !msgSignature) return false

  // Reject replays older than 5 minutes
  const ts = parseInt(msgTimestamp, 10)
  if (isNaN(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false

  // Decode secret (strip "whsec_" prefix if present)
  const secretBase64 = secret.startsWith('whsec_') ? secret.slice(6) : secret
  let secretBytes
  try {
    secretBytes = Buffer.from(secretBase64, 'base64')
  } catch {
    return false
  }

  const body    = rawBody instanceof Buffer ? rawBody.toString('utf8') : String(rawBody)
  const toSign  = `${msgId}.${msgTimestamp}.${body}`
  const computed = createHmac('sha256', secretBytes).update(toSign).digest('base64')

  // svix-signature may contain multiple space-separated "v1,<sig>" tokens
  const candidates = msgSignature.split(' ')
  for (const candidate of candidates) {
    const [version, sig] = candidate.split(',')
    if (version !== 'v1' || !sig) continue
    try {
      if (timingSafeEqual(Buffer.from(sig, 'base64'), Buffer.from(computed, 'base64'))) {
        return true
      }
    } catch {
      // buffer lengths differ — not a match
    }
  }

  return false
}
