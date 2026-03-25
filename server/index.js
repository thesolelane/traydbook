import express from 'express'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? ''
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? ''
const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? ''
const TELNYX_API_KEY = process.env.TELNYX_API_KEY ?? ''
const TELNYX_PHONE_NUMBER = process.env.TELNYX_PHONE_NUMBER ?? ''

if (!STRIPE_SECRET_KEY) console.warn('[server] STRIPE_SECRET_KEY not set')
if (!STRIPE_WEBHOOK_SECRET) console.warn('[server] STRIPE_WEBHOOK_SECRET not set')
if (!SUPABASE_SERVICE_ROLE_KEY) console.warn('[server] SUPABASE_SERVICE_ROLE_KEY not set')
if (!SUPABASE_ANON_KEY) console.warn('[server] VITE_SUPABASE_ANON_KEY not set')
if (!TELNYX_API_KEY) console.warn('[server] TELNYX_API_KEY not set — SMS disabled')
if (!TELNYX_PHONE_NUMBER) console.warn('[server] TELNYX_PHONE_NUMBER not set — SMS disabled')

async function sendSms(to, text) {
  if (!TELNYX_API_KEY || !TELNYX_PHONE_NUMBER) {
    console.warn('[sms] Telnyx not configured — skipping SMS to', to)
    return false
  }
  try {
    const res = await fetch('https://api.telnyx.com/v2/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TELNYX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: TELNYX_PHONE_NUMBER, to, text }),
    })
    if (!res.ok) {
      const err = await res.text()
      console.error('[sms] Telnyx error:', err)
      return false
    }
    console.log('[sms] Sent to', to)
    return true
  } catch (err) {
    console.error('[sms] Fetch error:', err.message)
    return false
  }
}

async function sendSmsAlert(userId, alertType, meta = {}) {
  const { data: prefs } = await supabaseAdmin
    .from('user_sms_prefs')
    .select('phone_e164, sms_active')
    .eq('user_id', userId)
    .single()

  if (!prefs?.sms_active || !prefs?.phone_e164) return

  const messages = {
    new_bid:       `TraydBook: You received a new bid of $${meta.amount ?? '?'} on "${meta.title ?? 'your RFQ'}". Log in to review it.`,
    bid_awarded:   `TraydBook: Your bid was awarded! Log in to see the details.`,
    new_message:   `TraydBook: You have a new message from ${meta.senderName ?? 'someone'}. Log in to reply.`,
    job_applied:   `TraydBook: Someone applied to your job listing "${meta.title ?? ''}". Log in to review.`,
    credits_added: `TraydBook: ${meta.credits ?? ''} credits have been added to your account.`,
  }

  const text = messages[alertType]
  if (!text) return
  await sendSms(prefs.phone_e164, text)
}

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

      // SMS subscription checkout
      if (session.mode === 'subscription' && userId) {
        const subId = session.subscription
        const customerId = session.customer
        await supabaseAdmin.from('user_sms_prefs').upsert({
          user_id: userId,
          sms_active: true,
          subscription_status: 'active',
          stripe_customer_id: customerId,
          stripe_subscription_id: subId,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
        console.log(`[webhook] SMS subscription activated for user ${userId}`)
        await sendSmsAlert(userId, 'credits_added', { credits: 'SMS alerts' })
        return res.json({ received: true })
      }

      // Credit bundle one-time purchase
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
        await sendSmsAlert(userId, 'credits_added', { credits: creditsNum })
      } else {
        console.log(`[webhook] Session ${session.id} already processed`)
      }
    }

    // SMS subscription canceled or lapsed
    if (event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.updated') {
      const sub = event.data.object
      const status = sub.status // 'active' | 'past_due' | 'canceled' | etc.
      const isActive = status === 'active'
      await supabaseAdmin.from('user_sms_prefs')
        .update({
          sms_active: isActive,
          subscription_status: ['active','past_due'].includes(status) ? status : 'canceled',
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', sub.id)
      console.log(`[webhook] SMS subscription ${sub.id} status → ${status}`)
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
      success_url: `${APP_ORIGIN}/settings?tab=billing&success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_ORIGIN}/settings?tab=billing&canceled=true`,
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

// ── Team Delegation ──────────────────────────────────────────────────────────

app.post('/api/team/invite', requireAuth, async (req, res) => {
  const { inviteEmail, role, responsibilityAccepted } = req.body ?? {}
  const principalId = req.user.id

  if (!inviteEmail || !role || !responsibilityAccepted) {
    return res.status(400).json({ error: 'Missing required fields' })
  }
  if (!['admin', 'contributor'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' })
  }

  const { data: principalRow, error: principalErr } = await supabaseAdmin
    .from('users')
    .select('display_name, is_delegate')
    .eq('id', principalId)
    .single()

  if (principalErr || !principalRow) {
    return res.status(404).json({ error: 'User not found' })
  }
  if (principalRow.is_delegate) {
    return res.status(403).json({ error: 'Delegates cannot invite other delegates' })
  }

  const token = require('crypto').randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: delegation, error: delegationErr } = await supabaseAdmin
    .from('account_delegations')
    .insert({
      principal_id: principalId,
      delegate_id: null,
      role,
      invite_email: inviteEmail,
      invite_token: token,
      invite_expires_at: expiresAt,
      status: 'pending',
      responsibility_accepted_at: new Date().toISOString(),
      responsibility_terms_version: '1.0',
    })
    .select('id')
    .single()

  if (delegationErr) {
    console.error('[team/invite] DB error:', delegationErr.message)
    return res.status(500).json({ error: 'Failed to create invitation' })
  }

  const joinUrl = `${APP_ORIGIN}/join/${token}`
  const roleLabel = role === 'admin' ? 'Team Admin' : 'Contributor'

  console.log(`[team/invite] Invite created for ${inviteEmail} (${role}) by ${principalId}. Join URL: ${joinUrl}`)

  res.json({
    success: true,
    delegationId: delegation.id,
    joinUrl,
    message: `Invite created for ${inviteEmail}. Share this link: ${joinUrl}`,
  })
})

app.post('/api/team/revoke', requireAuth, async (req, res) => {
  const { delegationId } = req.body ?? {}
  const principalId = req.user.id

  if (!delegationId) return res.status(400).json({ error: 'Missing delegationId' })

  const { data: delegation, error: fetchErr } = await supabaseAdmin
    .from('account_delegations')
    .select('id, principal_id, delegate_id, status')
    .eq('id', delegationId)
    .single()

  if (fetchErr || !delegation) return res.status(404).json({ error: 'Delegation not found' })
  if (delegation.principal_id !== principalId) return res.status(403).json({ error: 'Forbidden' })
  if (delegation.status === 'revoked') return res.status(400).json({ error: 'Already revoked' })

  const { error: updateErr } = await supabaseAdmin
    .from('account_delegations')
    .update({ status: 'revoked' })
    .eq('id', delegationId)

  if (updateErr) {
    console.error('[team/revoke] DB error:', updateErr.message)
    return res.status(500).json({ error: 'Failed to revoke delegation' })
  }

  if (delegation.delegate_id) {
    await supabaseAdmin
      .from('users')
      .update({ is_delegate: false, delegate_principal_id: null })
      .eq('id', delegation.delegate_id)
  }

  res.json({ success: true })
})

app.get('/api/team', requireAuth, async (req, res) => {
  const principalId = req.user.id

  const { data: delegations, error: dlgErr } = await supabaseAdmin
    .from('account_delegations')
    .select('id, role, invite_email, status, responsibility_accepted_at, created_at, delegate_id')
    .eq('principal_id', principalId)
    .order('created_at', { ascending: false })

  if (dlgErr) return res.status(500).json({ error: 'Failed to fetch team' })

  const delegateIds = delegations.filter(d => d.delegate_id).map(d => d.delegate_id)
  let delegateProfiles = []
  if (delegateIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from('users')
      .select('id, display_name, avatar_url, created_at')
      .in('id', delegateIds)
    delegateProfiles = profiles ?? []
  }

  const enriched = delegations.map(d => {
    const profile = delegateProfiles.find(p => p.id === d.delegate_id)
    return { ...d, delegate_profile: profile ?? null }
  })

  const activeDelegationIds = delegations.filter(d => d.status === 'active').map(d => d.id)
  let auditLog = []
  if (activeDelegationIds.length > 0) {
    const { data: logs } = await supabaseAdmin
      .from('delegate_audit_log')
      .select('id, delegation_id, actual_user_id, action_type, action_detail, created_at')
      .in('delegation_id', activeDelegationIds)
      .order('created_at', { ascending: false })
      .limit(50)
    auditLog = logs ?? []
  }

  res.json({ delegations: enriched, auditLog })
})

// ── SMS Subscriptions ─────────────────────────────────────────────────────────

app.get('/api/sms/status', requireAuth, async (req, res) => {
  const userId = req.user.id
  const { data } = await supabaseAdmin
    .from('user_sms_prefs')
    .select('phone_e164, sms_active, subscription_status, stripe_subscription_id')
    .eq('user_id', userId)
    .single()
  res.json(data ?? { phone_e164: null, sms_active: false, subscription_status: 'inactive' })
})

app.post('/api/sms/save-phone', requireAuth, async (req, res) => {
  const userId = req.user.id
  const { phone } = req.body ?? {}
  if (!phone) return res.status(400).json({ error: 'Phone number required' })

  const e164 = phone.replace(/\D/g, '')
  const formatted = e164.startsWith('1') ? `+${e164}` : `+1${e164}`
  if (formatted.length < 12) return res.status(400).json({ error: 'Invalid phone number' })

  const { error } = await supabaseAdmin.from('user_sms_prefs').upsert(
    { user_id: userId, phone_e164: formatted, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  )
  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true, phone_e164: formatted })
})

app.post('/api/sms/subscribe', requireAuth, async (req, res) => {
  const userId = req.user.id
  const plan = SMS_PLANS.sms_alerts

  const { data: prefs } = await supabaseAdmin
    .from('user_sms_prefs')
    .select('phone_e164, sms_active')
    .eq('user_id', userId)
    .single()

  if (!prefs?.phone_e164) {
    return res.status(400).json({ error: 'Please save a phone number first' })
  }
  if (prefs.sms_active) {
    return res.status(400).json({ error: 'SMS subscription is already active' })
  }

  const rawEmail = req.user.email ?? ''
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: emailValid ? rawEmail : undefined,
      line_items: [{ price: plan.priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${APP_ORIGIN}/settings?tab=notifications&sms=success`,
      cancel_url: `${APP_ORIGIN}/settings?tab=notifications&sms=canceled`,
      metadata: { userId },
    })
    res.json({ url: session.url })
  } catch (err) {
    console.error('[sms/subscribe] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/sms/unsubscribe', requireAuth, async (req, res) => {
  const userId = req.user.id
  const { data: prefs } = await supabaseAdmin
    .from('user_sms_prefs')
    .select('stripe_subscription_id')
    .eq('user_id', userId)
    .single()

  if (!prefs?.stripe_subscription_id) {
    return res.status(400).json({ error: 'No active SMS subscription found' })
  }

  try {
    await stripe.subscriptions.cancel(prefs.stripe_subscription_id)
    await supabaseAdmin.from('user_sms_prefs').update({
      sms_active: false,
      subscription_status: 'canceled',
      stripe_subscription_id: null,
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId)
    res.json({ success: true })
  } catch (err) {
    console.error('[sms/unsubscribe] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/sms/alert', requireAuth, async (req, res) => {
  const { recipientId, alertType, meta } = req.body ?? {}
  if (!recipientId || !alertType) return res.status(400).json({ error: 'Missing fields' })
  await sendSmsAlert(recipientId, alertType, meta ?? {})
  res.json({ success: true })
})

const PORT = process.env.API_PORT ?? 3001
app.listen(PORT, () => console.log(`[server] API ready on http://localhost:${PORT}`))
