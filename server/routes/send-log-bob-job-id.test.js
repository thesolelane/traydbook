/**
 * Integration-style route test: POST /api/admin/outreach/send-log
 *
 * Confirms that bob_job_id (the Resend email_id) is required at write time so
 * the delivery webhook can always match by exact ID rather than falling back to
 * a less-precise email-address lookup.
 *
 * Vitest + Node's built-in `http` module — no extra test dependencies needed.
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import http from 'node:http'
import express from 'express'

// ── Mock all external modules the route imports ───────────────────────────────

const FAKE_PROSPECT = { email_found: 'alex@example.com' }
const FAKE_LOG_ENTRY = {
  id: 'log-uuid-1',
  prospect_id: 'prospect-uuid-1',
  template_id: 'template-uuid-1',
  rendered_subject: 'Hello Alex',
  delivery_status: 'sent',
  bob_job_id: 're_abc123',
  sent_at: '2026-08-04T00:00:00Z',
}

// supabaseAdmin — returns prospect (not suppressed) and a successful insert
vi.mock('../lib/clients.js', () => ({
  supabaseAdmin: {
    from: vi.fn(table => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue(
        table === 'outreach_send_log'
          ? { data: FAKE_LOG_ENTRY, error: null }
          : { data: FAKE_PROSPECT, error: null }
      ),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}))

// Auth middleware — always pass the request through
vi.mock('../lib/auth.js', () => ({
  requireAuth: (_req, _res, next) => next(),
  requireAnyStaff: (_req, _res, next) => next(),
  requireAdminLevel: (_req, _res, next) => next(),
  requireServiceKeyOrStaff: () => (_req, _res, next) => next(),
}))

// Unsubscribe token helper
vi.mock('../lib/unsubscribe-token.js', () => ({
  generateUnsubscribeToken: () => 'tok',
}))

// Email footer — return the HTML/text unchanged so the test is deterministic
vi.mock('../lib/email-footer.js', () => ({
  appendEmailFooter: (html, text) => ({ html, text: text || '' }),
}))

// ── Spin up a real HTTP server around the router ──────────────────────────────

let server
let baseUrl

beforeAll(async () => {
  // Lazy-import the router *after* mocks are registered
  const { default: outreachRouter } = await import('./admin-outreach-templates.js')
  const app = express()
  app.use(express.json())
  app.use('/api/admin/outreach', outreachRouter)

  await new Promise(resolve => {
    server = http.createServer(app)
    server.listen(0, '127.0.0.1', resolve) // port 0 = OS picks a free port
  })
  const { port } = server.address()
  baseUrl = `http://127.0.0.1:${port}`
})

afterAll(() => {
  server?.close()
})

// ── Helpers ───────────────────────────────────────────────────────────────────

const VALID_BODY = {
  prospect_id: 'prospect-uuid-1',
  template_id: 'template-uuid-1',
  rendered_subject: 'Hello Alex',
  rendered_body_html: '<p>Hi Alex</p>',
  rendered_body_text: 'Hi Alex',
  bob_job_id: 're_abc123',
}

async function postSendLog(body) {
  const r = await fetch(`${baseUrl}/api/admin/outreach/send-log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: r.status, body: await r.json() }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/admin/outreach/send-log — bob_job_id enforcement', () => {
  it('returns 400 when bob_job_id is missing entirely', async () => {
    const { bob_job_id: _, ...withoutJobId } = VALID_BODY
    const { status, body } = await postSendLog(withoutJobId)
    expect(status).toBe(400)
    expect(body.error).toMatch(/bob_job_id/)
  })

  it('returns 400 when bob_job_id is an empty string', async () => {
    const { status, body } = await postSendLog({ ...VALID_BODY, bob_job_id: '' })
    expect(status).toBe(400)
    expect(body.error).toMatch(/bob_job_id/)
  })

  it('returns 400 when bob_job_id is null', async () => {
    const { status, body } = await postSendLog({ ...VALID_BODY, bob_job_id: null })
    expect(status).toBe(400)
    expect(body.error).toMatch(/bob_job_id/)
  })

  it('accepts a valid Resend email_id as bob_job_id and returns 201', async () => {
    const { status, body } = await postSendLog(VALID_BODY)
    expect(status).toBe(201)
    // The stored row echoes the bob_job_id back
    expect(body.bob_job_id).toBe(VALID_BODY.bob_job_id)
  })

  it('still returns 400 for other missing required fields (baseline sanity)', async () => {
    const { status, body } = await postSendLog({ bob_job_id: 're_abc123' })
    expect(status).toBe(400)
    expect(body.error).not.toMatch(/bob_job_id/) // a different validation fires first
  })
})
