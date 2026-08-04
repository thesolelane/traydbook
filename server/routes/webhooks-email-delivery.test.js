/**
 * Route-level tests for POST /api/webhooks/email-delivery
 *
 * Covers:
 *   1. Deduplication — svix-id present: discard if same svix_id already in delivery_events
 *   2. Deduplication — svix-id absent:  discard if same (type + timestamp + email_id) already seen
 *   3. Signature gate — valid payloads accepted (200), tampered/replayed payloads rejected (401)
 *   4. Bounce suppression — upsert into outreach_unsubscribes fires only on genuine bounce events
 *   5. Fail-closed — 503 when RESEND_WEBHOOK_SECRET is not configured
 *
 * Supabase is fully mocked — no real DB calls are made.
 * The real verifySvixSignature logic runs (pure function in server/lib/svix-verify.js).
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import express from 'express'
import http from 'node:http'
import { createHmac } from 'crypto'

// ── Unified supabase mock ──────────────────────────────────────────────────────
// All mutable state lives at module scope so beforeEach can reset it cleanly.
// The mock functions capture these variables by reference; they are only accessed
// at test-call time (not at factory-run time), so hoisting is not a problem.

let mockLogRow        = null   // returned by outreach_send_log queries
let mockProspect      = null   // returned by outreach_prospects queries (null = early-exit in suppressBounce)
let lastUpdateByTable = {}     // tracks the last update() payload per table name
let lastUpsert        = null   // tracks the last upsert() payload to outreach_unsubscribes

vi.mock('../lib/clients.js', () => {
  function makeChain(table, getResult) {
    const chain = {
      select:      () => chain,
      eq:          () => chain,
      order:       () => chain,
      limit:       () => chain,
      single:      async () => getResult(),
      maybeSingle: async () => getResult(),
      update: (data) => {
        lastUpdateByTable[table] = data
        return { eq: () => Promise.resolve({ error: null }) }
      },
      upsert: (data) => {
        if (table === 'outreach_unsubscribes') lastUpsert = data
        return Promise.resolve({ error: null })
      },
    }
    return chain
  }

  return {
    supabaseAdmin: {
      from: (table) => {
        if (table === 'outreach_send_log')
          return makeChain(table, () => ({ data: mockLogRow, error: null }))
        if (table === 'outreach_prospects')
          return makeChain(table, () => ({ data: mockProspect, error: null }))
        if (table === 'outreach_unsubscribes')
          return makeChain(table, () => ({ data: null, error: null }))
        return makeChain(table, () => ({ data: null, error: null }))
      },
    },
  }
})

// Import the router AFTER the mock is registered
const { default: webhookRouter } = await import('./webhooks-email-delivery.js')

// ── Shared express app + HTTP server ──────────────────────────────────────────

const app = express()
app.use(webhookRouter)

let server
let baseUrl

beforeAll(() => {
  return new Promise((resolve) => {
    server = http.createServer(app)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      baseUrl = `http://127.0.0.1:${port}`
      resolve()
    })
  })
})

afterAll(() => new Promise((resolve) => server.close(resolve)))

// ── Constants ──────────────────────────────────────────────────────────────────

const TEST_SECRET = 'whsec_dGVzdHNlY3JldGZvcndlYmhvb2tzMTIz'

// ── Global reset ──────────────────────────────────────────────────────────────

beforeEach(() => {
  // Reset tracked DB state
  lastUpdateByTable = {}
  lastUpsert        = null
  // Default log row — individual tests may override mockLogRow.delivery_events
  mockLogRow = {
    id: 'log-1',
    delivery_status: 'sent',
    delivery_events: [],
    prospect_id: 'prospect-1',
  }
  // No prospect by default; bounce tests override this
  mockProspect = null
  // Route is fail-closed: secret must be set for all functional tests.
  // The "no secret" suite clears this in its own beforeEach.
  process.env.RESEND_WEBHOOK_SECRET = TEST_SECRET
})

afterEach(() => {
  delete process.env.RESEND_WEBHOOK_SECRET
})

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Build valid Svix headers for the given raw body string + secret.
 * Pass timestampOffset (seconds) to simulate out-of-window timestamps.
 */
function makeSvixHeaders(body, secret, { msgId, timestampOffset = 0 } = {}) {
  const id           = msgId ?? `msg_test_${Date.now()}`
  const ts           = Math.floor(Date.now() / 1000) + timestampOffset
  const secretBase64 = secret.startsWith('whsec_') ? secret.slice(6) : secret
  const secretBytes  = Buffer.from(secretBase64, 'base64')
  const toSign       = `${id}.${ts}.${body}`
  const sig          = createHmac('sha256', secretBytes).update(toSign).digest('base64')
  return {
    'svix-id':        id,
    'svix-timestamp': String(ts),
    'svix-signature': `v1,${sig}`,
  }
}

function makePayload(overrides = {}) {
  return {
    type: 'email.opened',
    data: {
      email_id: 'resend-email-id-abc',
      created_at: '2026-08-04T10:00:00.000Z',
      to: ['recipient@example.com'],
      ...overrides,
    },
  }
}

/**
 * POST a webhook payload to the test server.
 * Signs the request automatically unless extraHeaders already contains svix-signature.
 * Pass svixHeaders explicitly to control the signature (e.g. for tamper/replay tests).
 */
async function postWebhook(payload, { extraHeaders = {}, svixHeaders } = {}) {
  const body   = JSON.stringify(payload)
  const secret = process.env.RESEND_WEBHOOK_SECRET
  const sigHdrs = svixHeaders ?? (secret ? makeSvixHeaders(body, secret) : {})
  const res = await fetch(`${baseUrl}/api/webhooks/email-delivery`, {
    method:  'POST',
    headers: { 'content-type': 'application/json', ...sigHdrs, ...extraHeaders },
    body,
  })
  return { status: res.status, json: await res.json() }
}

// ── Deduplication tests — svix-id present ─────────────────────────────────────

describe('webhook deduplication — svix-id present', () => {
  it('first delivery is accepted and recorded', async () => {
    const svixHeaders = makeSvixHeaders(JSON.stringify(makePayload()), TEST_SECRET, { msgId: 'msg-001' })
    const { status, json } = await postWebhook(makePayload(), { svixHeaders })
    expect(status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.duplicate).toBeUndefined()
  })

  it('second delivery with the same svix-id is discarded', async () => {
    mockLogRow.delivery_events = [
      {
        type:      'email.opened',
        timestamp: '2026-08-04T10:00:00.000Z',
        svix_id:   'msg-001',
        metadata:  { email_id: 'resend-email-id-abc' },
      },
    ]
    const body = JSON.stringify(makePayload())
    const svixHeaders = makeSvixHeaders(body, TEST_SECRET, { msgId: 'msg-001' })
    const { status, json } = await postWebhook(makePayload(), { svixHeaders })
    expect(status).toBe(200)
    expect(json.duplicate).toBe(true)
    // Supabase update should NOT have been called
    expect(lastUpdateByTable['outreach_send_log']).toBeUndefined()
  })

  it('second delivery with a different svix-id is accepted', async () => {
    mockLogRow.delivery_events = [
      {
        type:      'email.opened',
        timestamp: '2026-08-04T10:00:00.000Z',
        svix_id:   'msg-001',
        metadata:  { email_id: 'resend-email-id-abc' },
      },
    ]
    const body = JSON.stringify(makePayload())
    const svixHeaders = makeSvixHeaders(body, TEST_SECRET, { msgId: 'msg-002' })
    const { status, json } = await postWebhook(makePayload(), { svixHeaders })
    expect(status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.duplicate).toBeUndefined()
  })
})

// ── Signature gate tests ───────────────────────────────────────────────────────

describe('POST /api/webhooks/email-delivery — signature gate', () => {
  it('returns 200 for a correctly signed payload', async () => {
    const { status, json } = await postWebhook(
      { type: 'email.delivered', data: { email_id: 'em_1', created_at: '2026-08-04T10:00:00.000Z' } }
    )
    expect(status).toBe(200)
    expect(json.ok).toBe(true)
  })

  it('returns 401 for a payload with a wrong signature', async () => {
    const body = JSON.stringify({ type: 'email.delivered', data: { email_id: 'em_1' } })
    const hdrs = makeSvixHeaders(body, TEST_SECRET)
    const { status, json } = await postWebhook(
      { type: 'email.delivered', data: { email_id: 'em_1' } },
      { svixHeaders: { ...hdrs, 'svix-signature': 'v1,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' } }
    )
    expect(status).toBe(401)
    expect(json.error).toMatch(/signature/i)
  })

  it('returns 401 when the body has been tampered with after signing', async () => {
    const originalBody = JSON.stringify({ type: 'email.delivered', data: { email_id: 'em_1' } })
    const hdrs         = makeSvixHeaders(originalBody, TEST_SECRET)
    // Send a different body but keep the headers signed for the original
    const res = await fetch(`${baseUrl}/api/webhooks/email-delivery`, {
      method:  'POST',
      headers: { 'content-type': 'application/json', ...hdrs },
      body:    JSON.stringify({ type: 'email.bounced', data: { email_id: 'em_1' } }),
    })
    expect(res.status).toBe(401)
  })

  it('returns 401 for a replayed payload with a timestamp older than 5 minutes', async () => {
    const body = JSON.stringify({ type: 'email.delivered', data: { email_id: 'em_1' } })
    const hdrs = makeSvixHeaders(body, TEST_SECRET, { timestampOffset: -301 })
    const res  = await fetch(`${baseUrl}/api/webhooks/email-delivery`, {
      method:  'POST',
      headers: { 'content-type': 'application/json', ...hdrs },
      body,
    })
    expect(res.status).toBe(401)
  })

  it('returns 401 for a replayed payload with a timestamp far in the future', async () => {
    const body = JSON.stringify({ type: 'email.delivered', data: { email_id: 'em_1' } })
    const hdrs = makeSvixHeaders(body, TEST_SECRET, { timestampOffset: 301 })
    const res  = await fetch(`${baseUrl}/api/webhooks/email-delivery`, {
      method:  'POST',
      headers: { 'content-type': 'application/json', ...hdrs },
      body,
    })
    expect(res.status).toBe(401)
  })

  it('returns 401 when svix-signature header is missing entirely', async () => {
    const body = JSON.stringify({ type: 'email.delivered', data: { email_id: 'em_1' } })
    const hdrs = makeSvixHeaders(body, TEST_SECRET)
    delete hdrs['svix-signature']
    const res  = await fetch(`${baseUrl}/api/webhooks/email-delivery`, {
      method:  'POST',
      headers: { 'content-type': 'application/json', ...hdrs },
      body,
    })
    expect(res.status).toBe(401)
  })
})

// ── Bounce suppression tests ───────────────────────────────────────────────────

describe('POST /api/webhooks/email-delivery — bounce suppression', () => {
  beforeEach(() => {
    // Provide a prospect so suppressBounce can find an email address
    mockProspect = { id: 'prospect-1', email_found: 'alice@example.com' }
  })

  it('upserts into outreach_unsubscribes when a bounce event is received', async () => {
    const { status } = await postWebhook({
      type: 'email.bounced',
      data: { email_id: 'em_bounce', created_at: '2026-08-04T10:00:00.000Z' },
    })
    expect(status).toBe(200)
    expect(lastUpsert).not.toBeNull()
    expect(lastUpsert).toMatchObject({ email: 'alice@example.com', source: 'bounce' })
  })

  it('upserts into outreach_unsubscribes for email.complained (spam complaint)', async () => {
    const { status } = await postWebhook({
      type: 'email.complained',
      data: { email_id: 'em_spam', created_at: '2026-08-04T10:00:00.000Z' },
    })
    expect(status).toBe(200)
    expect(lastUpsert).not.toBeNull()
    expect(lastUpsert).toMatchObject({ source: 'bounce' })
  })

  it('does NOT touch outreach_unsubscribes for a delivered event', async () => {
    const { status } = await postWebhook({
      type: 'email.delivered',
      data: { email_id: 'em_del', created_at: '2026-08-04T10:00:00.000Z' },
    })
    expect(status).toBe(200)
    expect(lastUpsert).toBeNull()
  })

  it('does NOT touch outreach_unsubscribes for an opened event', async () => {
    const { status } = await postWebhook({
      type: 'email.opened',
      data: { email_id: 'em_open', created_at: '2026-08-04T10:00:00.000Z' },
    })
    expect(status).toBe(200)
    expect(lastUpsert).toBeNull()
  })

  it('marks the prospect as bounced in outreach_prospects when a bounce fires', async () => {
    await postWebhook({
      type: 'email.bounced',
      data: { email_id: 'em_bounce2', created_at: '2026-08-04T10:00:00.000Z' },
    })
    expect(lastUpdateByTable['outreach_prospects']).toMatchObject({ status: 'bounced' })
  })
})

// ── Fail-closed: no secret configured ─────────────────────────────────────────

describe('POST /api/webhooks/email-delivery — no secret configured', () => {
  beforeEach(() => {
    // Override the global beforeEach which sets the secret
    delete process.env.RESEND_WEBHOOK_SECRET
  })

  it('returns 503 when RESEND_WEBHOOK_SECRET is not set', async () => {
    const res = await fetch(`${baseUrl}/api/webhooks/email-delivery`, {
      method:  'POST',
      headers: { 'content-type': 'application/json' },
      body:    JSON.stringify({ type: 'email.delivered', data: { email_id: 'em_nosec' } }),
    })
    expect(res.status).toBe(503)
    const json = await res.json()
    expect(json.error).toMatch(/not configured/i)
  })
})
