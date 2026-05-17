/**
 * Admin: Service API Key management
 * Issue, list, and revoke service keys for Bob and other agents.
 */
import { Router } from 'express'
import { createHash, randomBytes } from 'crypto'
import { supabaseAdmin } from '../lib/clients.js'
import { requireAuth, requireAdminLevel } from '../lib/auth.js'

const router = Router()

function generateKey() {
  const raw = 'trayd_' + randomBytes(32).toString('base64url')
  const hash = createHash('sha256').update(raw).digest('hex')
  const prefix = raw.slice(0, 14)
  return { raw, hash, prefix }
}

// GET /api/admin/api-keys — list all service keys (no raw keys returned)
router.get('/api/admin/api-keys', requireAuth, requireAdminLevel, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('service_api_keys')
    .select('id, name, key_prefix, scopes, last_used_at, expires_at, revoked_at, created_at')
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  res.json({ keys: data ?? [] })
})

// POST /api/admin/api-keys — issue a new service key
// Body: { name, scopes, expires_at? }
router.post('/api/admin/api-keys', requireAuth, requireAdminLevel, async (req, res) => {
  const { name, scopes = [], expires_at } = req.body ?? {}
  if (!name) return res.status(400).json({ error: 'name is required' })
  if (!Array.isArray(scopes) || scopes.length === 0) {
    return res.status(400).json({ error: 'scopes array is required' })
  }

  const { raw, hash, prefix } = generateKey()

  const { data, error } = await supabaseAdmin
    .from('service_api_keys')
    .insert({
      name,
      key_hash: hash,
      key_prefix: prefix,
      scopes,
      expires_at: expires_at || null,
      created_by: req.user.id,
    })
    .select('id, name, key_prefix, scopes, expires_at, created_at')
    .single()

  if (error) return res.status(500).json({ error: error.message })

  // Return the raw key ONCE — it is never stored and cannot be retrieved again
  res.json({ ok: true, raw_key: raw, key: data })
})

// DELETE /api/admin/api-keys/:id — revoke a key
router.delete('/api/admin/api-keys/:id', requireAuth, requireAdminLevel, async (req, res) => {
  const { error } = await supabaseAdmin
    .from('service_api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .is('revoked_at', null)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
})

export default router
