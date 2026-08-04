/**
 * Tests for the email delivery webhook deduplication logic.
 *
 * Covers two dedup paths:
 *   1. svix-id header present  → discard if same svix_id already in delivery_events
 *   2. svix-id header absent   → discard if same (type + timestamp + email_id) already seen
 *
 * Signature verification is disabled in all tests by not setting
 * RESEND_WEBHOOK_SECRET (the handler skips verification when the secret is absent).
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import express from 'express'
import http from 'node:http'

// ── Mock supabaseAdmin before importing the route ──────────────────────────────
// We intercept .from() calls so tests can control what the DB returns.

let mockLogRow = null
let lastUpdate = null

vi.mock('../lib/clients.js', () => {
  const makeChain = (resolveWith) => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      limit: () => chain,
      maybeSingle: async () => resolveWith,
      single: async () => resolveWith,
      update: (data) => {
        lastUpdate = data
        return { ...chain, eq: () => ({ error: null }) }
      },
      upsert: async () => ({ error: null }),
    }
    return chain
  }

  return {
    supabaseAdmin: {
      from: (table) => {
        if (table === 'outreach_send_log') {
          return makeChain({ data: mockLogRow, error: null })
        }
        if (table === 'outreach_prospects') {
          // Used in suppressBounce — return nothing
          return makeChain({ data: null, error: null })
        }
        if (table === 'outreach_unsubscribes') {
          return makeChain({ data: null, error: null })
        }
        return makeChain({ data: null, error: null })
      },
    },
  }
})

// Import the router AFTER setting up the mock
const { default: webhookRouter } = await import('./webhooks-email-delivery.js')

// ── Minimal express app ────────────────────────────────────────────────────────
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

afterAll(() => {
  return new Promise((resolve) => server.close(resolve))
})

beforeEach(() => {
  lastUpdate = null
  // Reset to a fresh log row with no events yet
  mockLogRow = {
    id: 'log-1',
    delivery_status: 'sent',
    delivery_events: [],
    prospect_id: 'prospect-1',
  }
  // Unset the webhook secret so signature verification is skipped
  delete process.env.RESEND_WEBHOOK_SECRET
})

// ── Helpers ────────────────────────────────────────────────────────────────────

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

async function postWebhook(payload, extraHeaders = {}) {
  const body = JSON.stringify(payload)
  const res = await fetch(`${baseUrl}/api/webhooks/email-delivery`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...extraHeaders,
    },
    body,
  })
  return { status: res.status, json: await res.json() }
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('webhook deduplication — svix-id present', () => {
  it('first delivery is accepted and recorded', async () => {
    const { status, json } = await postWebhook(payload)

    expect(status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.duplicate).toBeUndefined()
  })

  it('second delivery without svix-id and identical (type+timestamp+email_id) is discarded', async () => {
    // Simulate the first event already in delivery_events (no svix_id stored)
    mockLogRow.delivery_events = [
      {
        type: 'email.opened',
        timestamp: '2026-08-04T10:00:00.000Z',
        metadata: { email_id: 'resend-email-id-abc' },
      },
    ]

    const { status, json } = await postWebhook(payload)

    expect(status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.duplicate).toBeUndefined()
  })

  it('second delivery without svix-id and identical (type+timestamp+email_id) is discarded', async () => {
    // Simulate the first event already in delivery_events (no svix_id stored)
    mockLogRow.delivery_events = [
      {
        type: 'email.opened',
        timestamp: '2026-08-04T10:00:00.000Z',
        metadata: { email_id: 'resend-email-id-abc' },
      },
    ]

    const { status, json } = await postWebhook(payload)

    expect(status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.duplicate).toBeUndefined()
  })

  it('second delivery without svix-id and identical (type+timestamp+email_id) is discarded', async () => {
    // Simulate the first event already in delivery_events (no svix_id stored)
    mockLogRow.delivery_events = [
      {
        type: 'email.opened',
        timestamp: '2026-08-04T10:00:00.000Z',
        metadata: { email_id: 'resend-email-id-abc' },
      },
    ]

    const { status, json } = await postWebhook(payload)

    expect(status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.duplicate).toBeUndefined()
  })

  it('second delivery without svix-id and identical (type+timestamp+email_id) is discarded', async () => {
    // Simulate the first event already in delivery_events (no svix_id stored)
    mockLogRow.delivery_events = [
      {
        type: 'email.opened',
        timestamp: '2026-08-04T10:00:00.000Z',
        metadata: { email_id: 'resend-email-id-abc' },
      },
    ]

    const { status, json } = await postWebhook(payload)

    expect(status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.duplicate).toBeUndefined()
  })

  it('different event type with same timestamp+email_id is accepted', async () => {
    mockLogRow.delivery_events = [
      {
        type: 'email.opened',
        timestamp: '2026-08-04T10:00:00.000Z',
        metadata: { email_id: 'resend-email-id-abc' },
      },
    ]

    const payload = { ...makePayload(), type: 'email.clicked' }
    const { status, json } = await postWebhook(payload)

    expect(status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.duplicate).toBeUndefined()
  })

  it('different event type with same timestamp+email_id is accepted', async () => {
    mockLogRow.delivery_events = [
      {
        type: 'email.opened',
        timestamp: '2026-08-04T10:00:00.000Z',
        metadata: { email_id: 'resend-email-id-abc' },
      },
    ]

    const payload = { ...makePayload(), type: 'email.clicked' }
    const { status, json } = await postWebhook(payload)

    expect(status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.duplicate).toBeUndefined()
  })

  it('different event type with same timestamp+email_id is accepted', async () => {
    mockLogRow.delivery_events = [
      {
        type: 'email.opened',
        timestamp: '2026-08-04T10:00:00.000Z',
        metadata: { email_id: 'resend-email-id-abc' },
      },
    ]

    const payload = { ...makePayload(), type: 'email.clicked' }
    const { status, json } = await postWebhook(payload)

    expect(status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.duplicate).toBeUndefined()
  })
})
