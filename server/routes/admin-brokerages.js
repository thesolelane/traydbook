/**
 * Admin: Brokerage credit pool + transfer history
 *
 * GET  /api/admin/brokerages              — list all brokerage accounts with pool stats
 * GET  /api/admin/brokerages/:id/transfers — brokerage_issue transfer history for one brokerage
 */
import { Router } from 'express'
import { supabaseAdmin } from '../lib/clients.js'
import { requireAuth, requireAdminLevel } from '../lib/auth.js'

const router = Router()

// List all brokerages with their pool balance and issuance totals
router.get('/api/admin/brokerages', requireAuth, requireAdminLevel, async (req, res) => {
  // Fetch all brokerage users
  const { data: brokerages, error } = await supabaseAdmin
    .from('users')
    .select('id, display_name, handle, email, credit_balance, created_at')
    .eq('account_type', 'brokerage')
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })

  if (!brokerages?.length) return res.json({ brokerages: [] })

  // For each brokerage, fetch issuance totals from credit_transfers
  const ids = brokerages.map(b => b.id)

  const { data: transfers } = await supabaseAdmin
    .from('credit_transfers')
    .select('from_user_id, amount')
    .in('from_user_id', ids)
    .eq('transfer_type', 'brokerage_issue')

  // Aggregate per brokerage
  const totals = {}
  for (const t of transfers ?? []) {
    if (!totals[t.from_user_id]) totals[t.from_user_id] = { issued: 0, count: 0 }
    totals[t.from_user_id].issued += t.amount
    totals[t.from_user_id].count += 1
  }

  const result = brokerages.map(b => ({
    ...b,
    total_issued: totals[b.id]?.issued ?? 0,
    transfer_count: totals[b.id]?.count ?? 0,
  }))

  res.json({ brokerages: result })
})

// Transfer history for a single brokerage
router.get(
  '/api/admin/brokerages/:id/transfers',
  requireAuth,
  requireAdminLevel,
  async (req, res) => {
    const { id } = req.params
    const limit = Math.min(parseInt(req.query.limit ?? '50', 10), 200)

    const { data: transfers, error } = await supabaseAdmin
      .from('credit_transfers')
      .select(
        `
      id, amount, note, created_at,
      to_user:to_user_id ( id, display_name, handle, email )
    `
      )
      .eq('from_user_id', id)
      .eq('transfer_type', 'brokerage_issue')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) return res.status(500).json({ error: error.message })

    res.json({ transfers: transfers ?? [] })
  }
)

export default router
