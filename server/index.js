import express from 'express'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? ''
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? ''
const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

if (!STRIPE_SECRET_KEY) console.warn('[server] WARNING: STRIPE_SECRET_KEY not set — Stripe calls will fail')
if (!STRIPE_WEBHOOK_SECRET) console.warn('[server] WARNING: STRIPE_WEBHOOK_SECRET not set — webhook verification disabled')
if (!SUPABASE_SERVICE_ROLE_KEY) console.warn('[server] WARNING: SUPABASE_SERVICE_ROLE_KEY not set — DB writes from server will fail')

const stripe = new Stripe(STRIPE_SECRET_KEY)
// Service-role client: used only in webhook handler (server-to-server, no user JWT)
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? ''
if (!SUPABASE_ANON_KEY) console.warn('[server] WARNING: VITE_SUPABASE_ANON_KEY not set — JWT verification will fail')
// Anon client: used only to verify user JWTs from the frontend (not privileged)
const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const BUNDLES = [
  { id: 'starter',      credits: 25,  cents: 900,  name: 'Starter' },
  { id: 'builder',      credits: 75,  cents: 2400, name: 'Builder' },
  { id: 'professional', credits: 200, cents: 5400, name: 'Professional' },
  { id: 'power',        credits: 500, cents: 9900, name: 'Power' },
]

// Derive the app origin from Replit env or fall back to localhost
const APP_ORIGIN = process.env.REPLIT_DEV_DOMAIN
  ? `https://${process.env.REPLIT_DEV_DOMAIN}`
  : 'http://localhost:5000'

const app = express()

// ─── Webhook — raw body required for Stripe signature verification ────────────
app.post('/api/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature']
    let event

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET)
    } catch (err) {
      console.error('[webhook] Signature verification failed:', err.message)
      return res.status(400).send(`Webhook Error: ${err.message}`)
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      const { userId, credits, bundleId } = session.metadata ?? {}

      if (!userId || !credits) {
        console.error('[webhook] Missing metadata on session:', session.id)
        return res.status(400).json({ error: 'Missing metadata' })
      }

      const creditsNum = parseInt(credits, 10)
      const bundle = BUNDLES.find(b => b.id === bundleId)

      // ── ATOMIC FULFILLMENT via single DB transaction ──────────────────────────
      // fulfill_stripe_purchase() atomically:
      //   1. Updates pending→completed OR inserts completed (ON CONFLICT DO NOTHING)
      //   2. Atomically increments credit_balance (balance + p_credits, no race)
      //   3. Inserts credit_ledger row
      //   4. Inserts credits_added notification
      // Returns false if session already processed → we skip and return 200.
      // Returns non-2xx on error → Stripe will retry delivery automatically.
      const { data: shouldCredit, error: fulfillErr } = await supabaseAdmin.rpc(
        'fulfill_stripe_purchase',
        {
          p_stripe_session_id: session.id,
          p_user_id: userId,
          p_credits: creditsNum,
          p_amount_cents: bundle?.cents ?? 0,
          p_bundle_id: bundleId ?? '',
        }
      )

      if (fulfillErr) {
        console.error('[webhook] fulfill_stripe_purchase RPC error:', fulfillErr.message)
        return res.status(500).json({ error: 'DB error during fulfillment' })
      }

      if (!shouldCredit) {
        console.log(`[webhook] Session ${session.id} already processed — skipping`)
      } else {
        console.log(`[webhook] Fulfilled ${creditsNum} credits for user ${userId}`)
      }
      // ─────────────────────────────────────────────────────────────────────────
    }

    res.json({ received: true })
  }
)

// ─── JSON middleware for all other routes ─────────────────────────────────────
app.use(express.json())

// ─── Auth middleware: verifies the Supabase JWT from Authorization header ─────
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Unauthorized — missing token' })

  // Use the anon client to verify the user's JWT (validates against Supabase JWKS)
  const { data, error } = await supabaseAnon.auth.getUser(token)
  if (error || !data?.user) return res.status(401).json({ error: 'Unauthorized — invalid token' })

  req.user = data.user
  next()
}

// ─── Create Checkout Session ──────────────────────────────────────────────────
// User identity is derived from the verified JWT — never trusted from the request body.
// Return URL is always built server-side from APP_ORIGIN — never from client input.
app.post('/api/create-checkout-session', requireAuth, async (req, res) => {
  const { bundleId } = req.body ?? {}
  const userId = req.user.id  // Derived from verified JWT — not from request body
  const bundle = BUNDLES.find(b => b.id === bundleId)

  if (!bundle) return res.status(400).json({ error: 'Invalid bundle' })
  if (!STRIPE_SECRET_KEY) return res.status(503).json({ error: 'Stripe not configured' })

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: req.user.email,
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `TraydBook ${bundle.name} Credits`,
            description: `${bundle.credits} credits for posting jobs, RFQs & messaging`,
          },
          unit_amount: bundle.cents,
        },
        quantity: 1,
      }],
      mode: 'payment',
      // Return URLs built entirely server-side from trusted APP_ORIGIN env var
      success_url: `${APP_ORIGIN}/credits?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_ORIGIN}/credits?canceled=true`,
      metadata: {
        userId,
        credits: String(bundle.credits),
        bundleId: bundle.id,
      },
    })

    // Insert pending purchase record — if this fails, webhook will still
    // insert+fulfill when Stripe fires (safety net in webhook handler)
    const { error: purchaseErr } = await supabaseAdmin.from('purchases').insert({
      user_id: userId,
      stripe_session_id: session.id,
      credits: bundle.credits,
      amount_cents: bundle.cents,
      status: 'pending',
    })
    if (purchaseErr) {
      console.error('[create-checkout-session] Purchase insert failed:', purchaseErr.message)
      // Non-fatal: webhook will create+fulfill the purchase when payment completes
    }

    res.json({ url: session.url })
  } catch (err) {
    console.error('[create-checkout-session] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ─── Poll credit balance by session_id (for post-checkout balance refresh) ────
// Frontend polls this after returning from Stripe to detect when webhook fires.
app.get('/api/session-status', requireAuth, async (req, res) => {
  const sessionId = req.query.session_id
  const userId = req.user.id
  if (!sessionId) return res.status(400).json({ error: 'Missing session_id' })

  const { data: purchase } = await supabaseAdmin
    .from('purchases')
    .select('status, credits')
    .eq('stripe_session_id', sessionId)
    .eq('user_id', userId)
    .single()

  if (!purchase) return res.status(404).json({ error: 'Session not found' })

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('credit_balance')
    .eq('id', userId)
    .single()

  res.json({
    status: purchase.status,
    credit_balance: user?.credit_balance ?? 0,
  })
})

const PORT = process.env.API_PORT ?? 3001
app.listen(PORT, () => {
  console.log(`[server] API ready on http://localhost:${PORT}`)
})
