import { beforeEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), createClient: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
}))
vi.mock('../lib/clients.js', () => ({
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'test-public-key',
}))
vi.mock('../lib/auth.js', () => ({
  requireAuth: (req, res, next) => {
    if (req.headers.authorization !== 'Bearer verified-test-token') {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    req.user = { id: '00000000-0000-0000-0000-000000000001' }
    next()
  },
}))

const { default: router } = await import('./messages.js')
const app = express()
app.use(express.json(), router)
const recipient = '00000000-0000-0000-0000-000000000002'

beforeEach(() => {
  mocks.rpc.mockReset().mockResolvedValue({ data: 'message-id', error: null })
  mocks.createClient.mockReset().mockReturnValue({ rpc: mocks.rpc })
})

describe('server message transaction', () => {
  it('requires sign-in before any RPC', async () => {
    await request(app).post('/api/messages/send').send({ recipient_id: recipient, body: 'Hello' }).expect(401)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('uses verified sender, canonical thread and one atomic RPC', async () => {
    await request(app).post('/api/messages/send').set('Authorization', 'Bearer verified-test-token')
      .send({ recipient_id: recipient, body: ' Hello ', sender_id: recipient, cost: 0, credit_balance: 9999 }).expect(200)
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('send_message', {
      p_recipient_id: recipient,
      p_thread_id: `00000000-0000-0000-0000-000000000001_${recipient}`,
      p_body: 'Hello',
    })
    expect(mocks.createClient.mock.calls[0][2].global.headers.Authorization).toBe('Bearer verified-test-token')
  })
  it('does not call the transaction for an empty message', async () => {
    await request(app).post('/api/messages/send').set('Authorization', 'Bearer verified-test-token')
      .send({ recipient_id: recipient, body: ' ' }).expect(400)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('reports insufficient credits rather than pretending to send', async () => {
    mocks.rpc.mockResolvedValue({ error: { code: 'P0001', message: 'Insufficient credits: need 3 credits' } })
    await request(app).post('/api/messages/send').set('Authorization', 'Bearer verified-test-token')
      .send({ recipient_id: recipient, body: 'Hello' }).expect(402)
  })
})
