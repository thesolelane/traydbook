import express from 'express'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? ''
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? ''
const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? ''

if (!STRIPE_SECRET_KEY) console.warn('[server] STRIPE_SECRET_KEY not set')
if (!STRIPE_WEBHOOK_SECRET) console.warn('[server] STRIPE_WEBHOOK_SECRET not set')
if (!SUPABASE_SERVICE_ROLE_KEY) console.warn('[server] SUPABASE_SERVICE_ROLE_KEY not set')
if (!SUPABASE_ANON_KEY) console.warn('[server] VITE_SUPABASE_ANON_KEY not set')

const stripe = new Stripe(STRIPE_SECRET_KEY)
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Monthly SMS alert subscription — $1.99/mo recurring
const SMS_PLANS = {
  sms_alerts: {
    id:        'sms_alerts',
    priceId:   'price_1TEMF1CXFkuyP9oESpMHcTBR',
    productId: 'prod_UClmMWnPYp7C78',
    cents:     199,
    interval:  'month',
    label:     'TraydBook SMS Alerts',
  },
}

const BUNDLES = [
  {
    id:         'starter',
    name:       'Starter',
    credits:    25,
    cents:      900,
    priceId:    'price_1TEMD8CXFkuyP9oE1vVyWb2D',
    productId:  'prod_UClkf2uXvDLFsN',
  },
  {
    id:         'builder',
    name:       'Builder',
    credits:    75,
    cents:      2400,
    priceId:    'price_1TEMD9CXFkuyP9oEEtINcbiN',
    productId:  'prod_UClkweiFvm2VPM',
  },
  {
    id:         'professional',
    name:       'Professional',
    credits:    200,
    cents:      5400,
    priceId:    'price_1TEMD9CXFkuyP9oEJKb5PKGL',
    productId:  'prod_UClkuhQHCsalUv',
  },
  {
    id:         'power',
    name:       'Power',
    credits:    500,
    cents:      9900,
    priceId:    'price_1TEMDACXFkuyP9oEJxlOr18m',
    productId:  'prod_UClksIMbwsf3xh',
  },
]

const APP_ORIGIN = process.env.APP_ORIGIN
  ?? (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'http://localhost:5000')

const app = express()

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
        console.error('[webhook] fulfill_stripe_purchase error:', fulfillErr.message)
        return res.status(500).json({ error: 'DB error' })
      }

      if (shouldCredit) {
        console.log(`[webhook] Fulfilled ${creditsNum} credits for user ${userId}`)
      } else {
        console.log(`[webhook] Session ${session.id} already processed`)
      }
    }

    res.json({ received: true })
  }
)

app.use(express.json())

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  const { data, error } = await supabaseAnon.auth.getUser(token)
  if (error || !data?.user) return res.status(401).json({ error: 'Unauthorized' })
  req.user = data.user
  next()
}

app.post('/api/create-checkout-session', requireAuth, async (req, res) => {
  const { bundleId } = req.body ?? {}
  const userId = req.user.id
  const bundle = BUNDLES.find(b => b.id === bundleId)

  if (!bundle) return res.status(400).json({ error: 'Invalid bundle' })
  if (!STRIPE_SECRET_KEY) return res.status(503).json({ error: 'Stripe not configured' })

  const { data: userRow } = await supabaseAdmin
    .from('users')
    .select('account_type')
    .eq('id', userId)
    .single()
  if (userRow?.account_type === 'contractor') {
    return res.status(403).json({ error: 'Contractors do not use credits' })
  }

  const rawEmail = req.user.email ?? ''
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      // customer_email pre-fills the checkout form and Stripe uses it to send the payment receipt
      customer_email: emailValid ? rawEmail : undefined,
      line_items: [{
        price:    bundle.priceId,
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${APP_ORIGIN}/credits?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_ORIGIN}/credits?canceled=true`,
      metadata: {
        userId,
        credits:  String(bundle.credits),
        bundleId: bundle.id,
        priceId:  bundle.priceId,
      },
    })

    const { error: purchaseErr } = await supabaseAdmin.from('purchases').insert({
      user_id: userId,
      stripe_session_id: session.id,
      credits: bundle.credits,
      amount_cents: bundle.cents,
      status: 'pending',
    })
    if (purchaseErr) {
      console.error('[checkout] Purchase pre-insert failed:', purchaseErr.message)
    }

    res.json({ url: session.url })
  } catch (err) {
    console.error('[checkout] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

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

  res.json({ status: purchase.status, credit_balance: user?.credit_balance ?? 0 })
})

const PORT = process.env.API_PORT ?? 3001
app.listen(PORT, () => console.log(`[server] API ready on http://localhost:${PORT}`))
