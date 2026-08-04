/**
 * Unit tests for verifySvixSignature
 *
 * All tests are pure — no network or DB calls.
 * A helper builds correctly-signed headers so tests can choose exactly
 * what to tamper with.
 */

import { describe, it, expect, vi } from 'vitest'
import { createHmac } from 'crypto'
import { verifySvixSignature } from './svix-verify.js'

// ── Test fixtures ──────────────────────────────────────────────────────────────

// A stable test secret in the "whsec_<base64>" format Resend uses
const TEST_SECRET = 'whsec_dGVzdHNlY3JldGZvcndlYmhvb2tzMTIz'
// Same secret without the prefix, for the alternate-format tests
const TEST_SECRET_RAW = 'dGVzdHNlY3JldGZvcndlYmhvb2tzMTIz'

const BODY = JSON.stringify({ type: 'email.delivered', data: { email_id: 'em_abc' } })

/**
 * Build a valid set of Svix headers for the given body + secret.
 *
 * @param {string} body
 * @param {string} secret           "whsec_..." or plain base64
 * @param {object} [overrides]
 * @param {string} [overrides.id]               override svix-id
 * @param {number} [overrides.timestampOffset]  seconds to add to now (negative = past)
 * @param {string} [overrides.signature]        override svix-signature verbatim
 */
function makeHeaders(body, secret, { id, timestampOffset = 0, signature } = {}) {
  const msgId = id ?? `msg_test_${Date.now()}`
  const ts    = Math.floor(Date.now() / 1000) + timestampOffset

  const secretBase64 = secret.startsWith('whsec_') ? secret.slice(6) : secret
  const secretBytes  = Buffer.from(secretBase64, 'base64')
  const toSign       = `${msgId}.${ts}.${body}`
  const sig          = createHmac('sha256', secretBytes).update(toSign).digest('base64')

  return {
    'svix-id':        msgId,
    'svix-timestamp': String(ts),
    'svix-signature': signature ?? `v1,${sig}`,
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('verifySvixSignature — valid payloads', () => {
  it('returns true for a correctly signed payload (whsec_ prefix)', () => {
    const headers = makeHeaders(BODY, TEST_SECRET)
    expect(verifySvixSignature(BODY, headers, TEST_SECRET)).toBe(true)
  })

  it('returns true when secret has no whsec_ prefix', () => {
    const headers = makeHeaders(BODY, TEST_SECRET_RAW)
    expect(verifySvixSignature(BODY, headers, TEST_SECRET_RAW)).toBe(true)
  })

  it('returns true when body is a Buffer instead of a string', () => {
    const bodyBuf = Buffer.from(BODY)
    // Headers must be signed with the string form
    const headers = makeHeaders(BODY, TEST_SECRET)
    expect(verifySvixSignature(bodyBuf, headers, TEST_SECRET)).toBe(true)
  })

  it('returns true when svix-signature contains multiple v1 tokens and one matches', () => {
    const goodHeaders = makeHeaders(BODY, TEST_SECRET)
    const multiSig    = `v1,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA= ${goodHeaders['svix-signature']}`
    const headers     = { ...goodHeaders, 'svix-signature': multiSig }
    expect(verifySvixSignature(BODY, headers, TEST_SECRET)).toBe(true)
  })

  it('accepts a timestamp that is just within the 5-minute window (299 s ago)', () => {
    const headers = makeHeaders(BODY, TEST_SECRET, { timestampOffset: -299 })
    expect(verifySvixSignature(BODY, headers, TEST_SECRET)).toBe(true)
  })
})

describe('verifySvixSignature — tampered / forged payloads → false', () => {
  it('returns false for a completely wrong signature', () => {
    const headers = makeHeaders(BODY, TEST_SECRET, {
      signature: 'v1,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
    })
    expect(verifySvixSignature(BODY, headers, TEST_SECRET)).toBe(false)
  })

  it('returns false when the body has been modified after signing', () => {
    const headers    = makeHeaders(BODY, TEST_SECRET)
    const tamperedBody = BODY.replace('delivered', 'bounced')
    expect(verifySvixSignature(tamperedBody, headers, TEST_SECRET)).toBe(false)
  })

  it('returns false when a different secret is used to verify', () => {
    const wrongSecret = 'whsec_d3JvbmdzZWNyZXRmb3J3ZWJob29rcw=='
    const headers     = makeHeaders(BODY, TEST_SECRET)
    expect(verifySvixSignature(BODY, headers, wrongSecret)).toBe(false)
  })

  it('returns false when svix-signature header is missing', () => {
    const { 'svix-signature': _, ...headers } = makeHeaders(BODY, TEST_SECRET)
    expect(verifySvixSignature(BODY, headers, TEST_SECRET)).toBe(false)
  })

  it('returns false when svix-id header is missing', () => {
    const { 'svix-id': _, ...headers } = makeHeaders(BODY, TEST_SECRET)
    expect(verifySvixSignature(BODY, headers, TEST_SECRET)).toBe(false)
  })

  it('returns false when svix-timestamp header is missing', () => {
    const { 'svix-timestamp': _, ...headers } = makeHeaders(BODY, TEST_SECRET)
    expect(verifySvixSignature(BODY, headers, TEST_SECRET)).toBe(false)
  })

  it('returns false when signature version prefix is not v1', () => {
    const goodHeaders = makeHeaders(BODY, TEST_SECRET)
    // Replace "v1," with "v2,"
    const badSig  = goodHeaders['svix-signature'].replace('v1,', 'v2,')
    const headers = { ...goodHeaders, 'svix-signature': badSig }
    expect(verifySvixSignature(BODY, headers, TEST_SECRET)).toBe(false)
  })

  it('returns false when no secret is supplied', () => {
    const headers = makeHeaders(BODY, TEST_SECRET)
    expect(verifySvixSignature(BODY, headers, '')).toBe(false)
    expect(verifySvixSignature(BODY, headers, null)).toBe(false)
    expect(verifySvixSignature(BODY, headers, undefined)).toBe(false)
  })
})

describe('verifySvixSignature — replay attack protection', () => {
  it('returns false for a timestamp more than 5 minutes in the past', () => {
    // -301 s is just over the 300 s window
    const headers = makeHeaders(BODY, TEST_SECRET, { timestampOffset: -301 })
    expect(verifySvixSignature(BODY, headers, TEST_SECRET)).toBe(false)
  })

  it('returns false for a timestamp more than 5 minutes in the future', () => {
    const headers = makeHeaders(BODY, TEST_SECRET, { timestampOffset: 301 })
    expect(verifySvixSignature(BODY, headers, TEST_SECRET)).toBe(false)
  })

  it('returns false for a non-numeric timestamp', () => {
    const headers = { ...makeHeaders(BODY, TEST_SECRET), 'svix-timestamp': 'not-a-number' }
    expect(verifySvixSignature(BODY, headers, TEST_SECRET)).toBe(false)
  })

  it('returns false for an empty-string timestamp', () => {
    const headers = { ...makeHeaders(BODY, TEST_SECRET), 'svix-timestamp': '' }
    expect(verifySvixSignature(BODY, headers, TEST_SECRET)).toBe(false)
  })
})
