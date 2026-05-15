import { Router } from 'express'
import { supabaseAdmin } from '../lib/clients.js'
import { requireAuth } from '../lib/auth.js'

const router = Router()

// POST /api/pass — record a skip/pass
router.post('/api/pass', requireAuth, async (req, res) => {
  const { target_type, target_id } = req.body ?? {}
  const userId = req.user.id

  if (!target_type || !target_id) {
    return res.status(400).json({ error: 'target_type and target_id are required' })
  }

  const VALID_TYPES = ['rfq', 'job', 'lead']
  if (!VALID_TYPES.includes(target_type)) {
    return res.status(400).json({ error: `target_type must be one of: ${VALID_TYPES.join(', ')}` })
  }

  const { error } = await supabaseAdmin
    .from('passes')
    .upsert({ user_id: userId, target_type, target_id }, { onConflict: 'user_id,target_type,target_id' })

  if (error) return res.status(500).json({ error: error.message })

  res.json({ ok: true })
})

// DELETE /api/pass — undo a pass (contractor changes their mind)
router.delete('/api/pass', requireAuth, async (req, res) => {
  const { target_type, target_id } = req.body ?? {}
  const userId = req.user.id

  if (!target_type || !target_id) {
    return res.status(400).json({ error: 'target_type and target_id are required' })
  }

  const { error } = await supabaseAdmin
    .from('passes')
    .delete()
    .eq('user_id', userId)
    .eq('target_type', target_type)
    .eq('target_id', target_id)

  if (error) return res.status(500).json({ error: error.message })

  res.json({ ok: true })
})

// GET /api/passes/:type — get all passed IDs of a given type for the current user
// Used on page load to mark already-passed items
router.get('/api/passes/:type', requireAuth, async (req, res) => {
  const { type } = req.params
  const userId = req.user.id

  const { data, error } = await supabaseAdmin
    .from('passes')
    .select('target_id, created_at')
    .eq('user_id', userId)
    .eq('target_type', type)
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })

  res.json({ passed: data.map(r => r.target_id) })
})

export default router
