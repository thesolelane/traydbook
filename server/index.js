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
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const BUNDLES = [
  { id: 'starter',      credits: 25,  cents: 900,  name: 'Starter' },
  { id: 'builder',      credits: 75,  cents: 2400, name: 'Builder' },
  { id: 'professional', credits: 200, cents: 5400, name: 'Professional' },
  { id: 'power',        credits: 500, cents: 9900, name: 'Power' },
]

const app = express()

// ─── Webhook — raw body required for signature verification ───────────────────
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

      // 1. Mark purchase completed
      await supabase
        .from('purchases')
        .update({ status: 'completed' })
        .eq('stripe_session_id', session.id)

      // 2. Get current balance
      const { data: user } = await supabase
        .from('users')
        .select('credit_balance')
        .eq('id', userId)
        .single()

      const newBalance = (user?.credit_balance ?? 0) + creditsNum

      // 3. Update balance
      await supabase
        .from('users')
        .update({ credit_balance: newBalance })
        .eq('id', userId)

      // 4. Insert ledger row
      await supabase.from('credit_ledger').insert({
        user_id: userId,
        delta: creditsNum,
        balance_after: newBalance,
        transaction_type: 'purchase',
        description: `Purchased ${credits} credits (${bundleId} bundle)`,
      })

      // 5. Insert notification
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'credits_added',
        title: 'Credits added!',
        body: `${credits} credits have been added to your account.`,
        entity_type: 'credit_purchase',
      })

      console.log(`[webhook] Fulfilled ${credits} credits for user ${userId}`)
    }

    res.json({ received: true })
  }
)

// ─── JSON middleware for other routes ─────────────────────────────────────────
app.use(express.json())

// ─── Create Checkout Session ──────────────────────────────────────────────────
app.post('/api/create-checkout-session', async (req, res) => {
  const { bundleId, userId, returnOrigin } = req.body ?? {}
  const bundle = BUNDLES.find(b => b.id === bundleId)

  if (!bundle) return res.status(400).json({ error: 'Invalid bundle' })
  if (!userId) return res.status(400).json({ error: 'Missing userId' })
  if (!STRIPE_SECRET_KEY) return res.status(503).json({ error: 'Stripe not configured' })

  const origin = returnOrigin ?? `https://${process.env.REPLIT_DEV_DOMAIN ?? 'localhost:5000'}`

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
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
      success_url: `${origin}/credits?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/credits?canceled=true`,
      metadata: {
        userId,
        credits: String(bundle.credits),
        bundleId: bundle.id,
      },
    })

    // Insert pending purchase record
    await supabase.from('purchases').insert({
      user_id: userId,
      stripe_session_id: session.id,
      credits: bundle.credits,
      amount_cents: bundle.cents,
      status: 'pending',
    })

    res.json({ url: session.url })
  } catch (err) {
    console.error('[create-checkout-session] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

const PORT = process.env.API_PORT ?? 3001
app.listen(PORT, () => {
  console.log(`[server] API ready on http://localhost:${PORT}`)
})
