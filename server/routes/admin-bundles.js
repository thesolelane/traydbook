/**
 * Admin CRUD for credit bundles.
 * Creating a bundle automatically provisions a Stripe product + one-time price.
 * Prices are immutable in Stripe — to change a price, deactivate the bundle
 * and create a new one.
 */
import { Router } from 'express'
import { supabaseAdmin, stripe } from '../lib/clients.js'
import { requireAuth, requireAdminLevel } from '../lib/auth.js'

const router = Router()

// GET /api/admin/bundles — list all bundles
router.get('/api/admin/bundles', requireAuth, requireAdminLevel, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('credit_bundles')
    .select('*')
    .order('sort_order')
    .order('created_at')
  if (error) return res.status(500).json({ error: error.message })
  res.json({ bundles: data ?? [] })
})

// POST /api/admin/bundles — create bundle (+ Stripe product & price)
router.post('/api/admin/bundles', requireAuth, requireAdminLevel, async (req, res) => {
  const { name, credits, price_cents, sort_order = 0 } = req.body ?? {}

  if (!name?.trim())           return res.status(400).json({ error: 'name is required' })
  if (!Number.isInteger(credits)    || credits    <= 0) return res.status(400).json({ error: 'credits must be a positive integer' })
  if (!Number.isInteger(price_cents) || price_cents <= 0) return res.status(400).json({ error: 'price_cents must be a positive integer' })

  let stripeProductId = null
  let stripePriceId   = null

  if (stripe) {
    try {
      const product = await stripe.products.create({
        name,
        description: `${credits} TraydBook credits`,
        metadata: { credits: String(credits), source: 'traydbook_admin' },
      })
      stripeProductId = product.id

      const price = await stripe.prices.create({
        product:     product.id,
        unit_amount: price_cents,
        currency:    'usd',
        metadata:    { credits: String(credits), bundle_name: name },
      })
      stripePriceId = price.id
    } catch (stripeErr) {
      console.error('[admin-bundles] Stripe error:', stripeErr.message)
      return res.status(502).json({ error: `Stripe error: ${stripeErr.message}` })
    }
  } else {
    console.warn('[admin-bundles] Stripe not configured — bundle created without price ID')
  }

  const { data, error } = await supabaseAdmin
    .from('credit_bundles')
    .insert({
      name:               name.trim(),
      credits,
      price_cents,
      stripe_product_id:  stripeProductId,
      stripe_price_id:    stripePriceId,
      sort_order,
      active:             true,
    })
    .select()
    .single()

  if (error) {
    console.error('[admin-bundles] DB insert error:', error.message)
    return res.status(500).json({ error: error.message })
  }

  res.status(201).json({ bundle: data })
})

// PATCH /api/admin/bundles/:id — update name, active, sort_order
// Price and credits cannot be changed (Stripe prices are immutable).
// To change price/credits: deactivate this bundle and create a new one.
router.patch('/api/admin/bundles/:id', requireAuth, requireAdminLevel, async (req, res) => {
  const { id } = req.params
  const { name, active, sort_order } = req.body ?? {}

  const patch = { updated_at: new Date().toISOString() }
  if (name       !== undefined) patch.name       = name.trim()
  if (active     !== undefined) patch.active      = Boolean(active)
  if (sort_order !== undefined) patch.sort_order  = sort_order

  if (Object.keys(patch).length === 1) {
    return res.status(400).json({ error: 'Nothing to update' })
  }

  const { data, error } = await supabaseAdmin
    .from('credit_bundles')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  if (!data)  return res.status(404).json({ error: 'Bundle not found' })

  // Sync name change to Stripe product if possible
  if (name && data.stripe_product_id && stripe) {
    stripe.products.update(data.stripe_product_id, { name: data.name }).catch(e => {
      console.warn('[admin-bundles] Stripe name sync failed:', e.message)
    })
  }

  // Archive Stripe price if deactivated
  if (active === false && data.stripe_price_id && stripe) {
    stripe.prices.update(data.stripe_price_id, { active: false }).catch(e => {
      console.warn('[admin-bundles] Stripe price deactivation failed:', e.message)
    })
  }

  res.json({ bundle: data })
})

// Public endpoint — returns active bundles for the checkout UI
router.get('/api/bundles', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('credit_bundles')
    .select('id, name, credits, price_cents')
    .eq('active', true)
    .order('sort_order')
  if (error) return res.status(500).json({ error: error.message })
  res.json({ bundles: data ?? [] })
})

export default router
