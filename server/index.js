import express from 'express'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import Telnyx from 'telnyx'
import { Keypair, Connection, SystemProgram, Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? ''
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? ''
const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? ''
const TELNYX_API_KEY = process.env.TELNYX_API_KEY ?? ''
const TELNYX_PHONE_NUMBER = process.env.TELNYX_PHONE_NUMBER ?? ''
const SMS_STARTER_PRICE_ID = process.env.SMS_STARTER_PRICE_ID ?? ''
const SMS_UNLIMITED_PRICE_ID = process.env.SMS_UNLIMITED_PRICE_ID ?? ''

if (!STRIPE_SECRET_KEY) console.warn('[server] STRIPE_SECRET_KEY not set')
if (!STRIPE_WEBHOOK_SECRET) console.warn('[server] STRIPE_WEBHOOK_SECRET not set')
if (!SUPABASE_SERVICE_ROLE_KEY) console.warn('[server] SUPABASE_SERVICE_ROLE_KEY not set')
if (!SUPABASE_ANON_KEY) console.warn('[server] VITE_SUPABASE_ANON_KEY not set')
if (!TELNYX_API_KEY) console.warn('[server] TELNYX_API_KEY not set — SMS disabled')
if (!TELNYX_PHONE_NUMBER) console.warn('[server] TELNYX_PHONE_NUMBER not set — SMS disabled')
if (!SMS_STARTER_PRICE_ID) console.warn('[server] SMS_STARTER_PRICE_ID not set')
if (!SMS_UNLIMITED_PRICE_ID) console.warn('[server] SMS_UNLIMITED_PRICE_ID not set')

const stripe = new Stripe(STRIPE_SECRET_KEY)
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

let telnyxClient = null
if (TELNYX_API_KEY) {
  telnyxClient = new Telnyx(TELNYX_API_KEY)
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

const SMS_PLANS = {
  starter: { priceId: SMS_STARTER_PRICE_ID, tier: 'starter', cap: 150 },
  unlimited: { priceId: SMS_UNLIMITED_PRICE_ID, tier: 'unlimited', cap: null },
}

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
      const { userId, credits, bundleId, smsTier } = session.metadata ?? {}

      if (smsTier) {
        await handleSmsSubscriptionActivated(session, userId, smsTier)
      } else {
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
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object
      await handleSmsSubscriptionCancelled(sub)
    }

    if (event.type === 'customer.subscription.updated') {
      const sub = event.data.object
      const { userId } = sub.metadata ?? {}
      if (userId) {
        if (sub.status === 'active') {
          await supabaseAdmin
            .from('users')
            .update({ sms_count_this_period: 0 })
            .eq('id', userId)
            .eq('stripe_sms_sub_id', sub.id)
          console.log(`[webhook] Reset SMS count for user ${userId} on renewal`)
        } else if (['past_due', 'unpaid', 'canceled', 'incomplete_expired'].includes(sub.status)) {
          await supabaseAdmin
            .from('users')
            .update({ sms_alerts_enabled: false })
            .eq('id', userId)
            .eq('stripe_sms_sub_id', sub.id)
          console.log(`[webhook] Disabled SMS alerts for user ${userId} — subscription status: ${sub.status}`)
        }
      }
    }

    if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object
      const subId = invoice.subscription
      if (subId && invoice.billing_reason === 'subscription_cycle') {
        const { data: users } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('stripe_sms_sub_id', subId)
        if (users && users.length > 0) {
          await supabaseAdmin
            .from('users')
            .update({ sms_count_this_period: 0 })
            .eq('stripe_sms_sub_id', subId)
          console.log(`[webhook] Reset SMS count on invoice payment for subscription ${subId}`)
        }
      }
    }

    res.json({ received: true })
  }
)

async function handleSmsSubscriptionActivated(session, userId, smsTier) {
  if (!userId || !smsTier) {
    console.error('[sms-webhook] Missing userId or smsTier in session metadata')
    return
  }
  const stripeSubscriptionId = session.subscription
  const { error } = await supabaseAdmin
    .from('users')
    .update({
      sms_tier: smsTier,
      sms_alerts_enabled: true,
      stripe_sms_sub_id: stripeSubscriptionId,
    })
    .eq('id', userId)
  if (error) {
    console.error('[sms-webhook] Failed to activate SMS tier:', error.message)
  } else {
    console.log(`[sms-webhook] Activated ${smsTier} SMS tier for user ${userId}`)
  }
}

async function handleSmsSubscriptionCancelled(sub) {
  const subId = sub.id
  const { error } = await supabaseAdmin
    .from('users')
    .update({
      sms_tier: null,
      sms_alerts_enabled: true,
      phone_verified: false,
      phone_number: null,
      sms_count_this_period: 0,
      stripe_sms_sub_id: null,
    })
    .eq('stripe_sms_sub_id', subId)
  if (error) {
    console.error('[sms-webhook] Failed to deactivate SMS subscription:', error.message)
  } else {
    console.log(`[sms-webhook] Deactivated SMS for subscription ${subId}`)
  }
}

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
  if (userRow?.account_type === 'contractor' || userRow?.account_type === 'admin') {
    return res.status(403).json({ error: 'This account type does not use credits' })
  }

  const rawEmail = req.user.email ?? ''
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
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

// ── Admin Invites ─────────────────────────────────────────────────────────────

const STAFF_ROLES = ['admin', 'admin_2', 'hired_dev', 'moderator']
const PLATFORM_ROLES = ['contractor', 'project_owner', 'agent', 'homeowner']
const ALL_INVITE_ROLES = [...STAFF_ROLES, ...PLATFORM_ROLES]

/** Middleware: only account_type='admin' (super admin) can proceed */
async function requireSuperAdmin(req, res, next) {
  const { data: u } = await supabaseAdmin.from('users').select('account_type').eq('id', req.user.id).single()
  if (u?.account_type !== 'admin') return res.status(403).json({ error: 'Super admin only' })
  next()
}

app.post('/api/admin/invite', requireAuth, requireSuperAdmin, async (req, res) => {
  const { email, role } = req.body ?? {}
  if (!email || !role) return res.status(400).json({ error: 'email and role are required' })
  if (!ALL_INVITE_ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' })

  const { data: invite, error: insertErr } = await supabaseAdmin
    .from('admin_invites')
    .insert({ invited_by: req.user.id, email: email.trim().toLowerCase(), role })
    .select('id, token, email, role, expires_at')
    .single()

  if (insertErr) {
    console.error('[admin/invite] Insert error:', insertErr.message)
    return res.status(500).json({ error: 'Failed to create invite' })
  }

  const domain = process.env.REPLIT_DEV_DOMAIN ?? 'traydbook.com'
  const joinUrl = `https://${domain}/staff-invite/${invite.token}`
  console.log(`[admin/invite] Invite created for ${email} (${role}) by ${req.user.id}. URL: ${joinUrl}`)
  res.json({ invite, joinUrl })
})

app.get('/api/admin/invite/:token', async (req, res) => {
  const { token } = req.params
  const { data: invite, error } = await supabaseAdmin
    .from('admin_invites')
    .select('id, email, role, expires_at, used_at, invited_by, users!invited_by (display_name, avatar_url)')
    .eq('token', token)
    .maybeSingle()

  if (error || !invite) return res.status(404).json({ error: 'Invite not found or already used' })
  if (invite.used_at) return res.status(410).json({ error: 'This invite has already been used' })
  if (new Date(invite.expires_at) < new Date()) return res.status(410).json({ error: 'This invite has expired' })

  res.json({ invite })
})

app.get('/api/admin/invites', requireAuth, requireSuperAdmin, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('admin_invites')
    .select('id, email, role, expires_at, used_at, created_at, users!invited_by (display_name)')
    .eq('invited_by', req.user.id)
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  res.json({ invites: data ?? [] })
})

app.delete('/api/admin/invite/:id', requireAuth, requireSuperAdmin, async (req, res) => {
  const { id } = req.params
  const { error } = await supabaseAdmin.from('admin_invites').delete().eq('id', id).eq('invited_by', req.user.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
})

// ── SMS Subscriptions ─────────────────────────────────────────────────────────

app.post('/api/sms/create-subscription', requireAuth, async (req, res) => {
  const { plan } = req.body ?? {}
  const userId = req.user.id

  const smsPlan = SMS_PLANS[plan]
  if (!smsPlan) return res.status(400).json({ error: 'Invalid SMS plan' })
  if (!smsPlan.priceId) return res.status(503).json({ error: 'SMS plan not configured' })
  if (!STRIPE_SECRET_KEY) return res.status(503).json({ error: 'Stripe not configured' })

  const { data: userRow } = await supabaseAdmin
    .from('users')
    .select('account_type, sms_tier, stripe_sms_sub_id')
    .eq('id', userId)
    .single()

  if (!userRow) return res.status(404).json({ error: 'User not found' })
  if (userRow.account_type !== 'contractor') return res.status(403).json({ error: 'SMS alerts are only available for contractors' })
  if (userRow.sms_tier) return res.status(400).json({ error: 'Already subscribed to an SMS plan' })

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: req.user.email,
      line_items: [{ price: smsPlan.priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${APP_ORIGIN}/settings?tab=notifications&sms_success=true`,
      cancel_url: `${APP_ORIGIN}/settings?tab=notifications&sms_canceled=true`,
      metadata: {
        userId,
        smsTier: smsPlan.tier,
      },
      subscription_data: {
        metadata: { userId, smsTier: smsPlan.tier },
      },
    })
    res.json({ url: session.url })
  } catch (err) {
    console.error('[sms-checkout] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/sms/cancel-subscription', requireAuth, async (req, res) => {
  const userId = req.user.id

  const { data: userRow } = await supabaseAdmin
    .from('users')
    .select('stripe_sms_sub_id, sms_tier')
    .eq('id', userId)
    .single()

  if (!userRow?.stripe_sms_sub_id) {
    return res.status(400).json({ error: 'No active SMS subscription' })
  }

  try {
    await stripe.subscriptions.cancel(userRow.stripe_sms_sub_id)
    res.json({ cancelled: true })
  } catch (err) {
    console.error('[sms-cancel] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/sms/toggle-alerts', requireAuth, async (req, res) => {
  const userId = req.user.id
  const { enabled } = req.body ?? {}
  if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'enabled must be a boolean' })

  const { data: userRow } = await supabaseAdmin
    .from('users')
    .select('sms_tier')
    .eq('id', userId)
    .single()

  if (!userRow?.sms_tier) {
    return res.status(400).json({ error: 'No active SMS subscription' })
  }

  const { error } = await supabaseAdmin
    .from('users')
    .update({ sms_alerts_enabled: enabled })
    .eq('id', userId)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ sms_alerts_enabled: enabled })
})

app.post('/api/sms/send-verification', requireAuth, async (req, res) => {
  const userId = req.user.id
  let { phone } = req.body ?? {}

  if (!phone) return res.status(400).json({ error: 'Phone number is required' })

  phone = phone.replace(/\D/g, '')
  if (phone.length === 10) phone = '1' + phone
  if (!/^1\d{10}$/.test(phone)) {
    return res.status(400).json({ error: 'Invalid US phone number' })
  }
  phone = '+' + phone

  const { data: userRow } = await supabaseAdmin
    .from('users')
    .select('sms_tier')
    .eq('id', userId)
    .single()

  if (!userRow?.sms_tier) {
    return res.status(403).json({ error: 'SMS subscription required' })
  }

  if (!telnyxClient || !TELNYX_PHONE_NUMBER) {
    return res.status(503).json({ error: 'SMS service not configured' })
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000))
  const otpHash = crypto.createHash('sha256').update(otp).digest('hex')
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  const { error: updateErr } = await supabaseAdmin
    .from('users')
    .update({
      phone_number: phone,
      phone_verified: false,
      sms_otp_hash: otpHash,
      sms_otp_expires_at: expiresAt,
    })
    .eq('id', userId)

  if (updateErr) {
    console.error('[sms-verify] DB update error:', updateErr.message)
    return res.status(500).json({ error: 'Failed to save phone number' })
  }

  try {
    await telnyxClient.messages.create({
      from: TELNYX_PHONE_NUMBER,
      to: phone,
      text: `Your TraydBook verification code is: ${otp}. Valid for 10 minutes.`,
    })
    res.json({ sent: true })
  } catch (err) {
    console.error('[sms-verify] Telnyx error:', err.message)
    res.status(500).json({ error: 'Failed to send verification SMS' })
  }
})

app.post('/api/sms/verify', requireAuth, async (req, res) => {
  const userId = req.user.id
  const { otp } = req.body ?? {}

  if (!otp || typeof otp !== 'string') return res.status(400).json({ error: 'OTP is required' })

  const { data: userRow } = await supabaseAdmin
    .from('users')
    .select('sms_otp_hash, sms_otp_expires_at, sms_tier')
    .eq('id', userId)
    .single()

  if (!userRow?.sms_tier) return res.status(403).json({ error: 'SMS subscription required' })
  if (!userRow.sms_otp_hash) return res.status(400).json({ error: 'No pending verification' })

  const now = new Date()
  if (new Date(userRow.sms_otp_expires_at) < now) {
    return res.status(400).json({ error: 'Verification code expired. Please request a new one.' })
  }

  const inputHash = crypto.createHash('sha256').update(otp.trim()).digest('hex')
  if (inputHash !== userRow.sms_otp_hash) {
    return res.status(400).json({ error: 'Invalid verification code' })
  }

  const { error } = await supabaseAdmin
    .from('users')
    .update({
      phone_verified: true,
      sms_otp_hash: null,
      sms_otp_expires_at: null,
    })
    .eq('id', userId)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ verified: true })
})

app.get('/api/sms/status', requireAuth, async (req, res) => {
  const userId = req.user.id

  const { data: userRow, error } = await supabaseAdmin
    .from('users')
    .select('sms_tier, sms_alerts_enabled, phone_verified, phone_number, sms_count_this_period, stripe_sms_sub_id')
    .eq('id', userId)
    .single()

  if (error) return res.status(500).json({ error: error.message })

  let maskedPhone = null
  if (userRow?.phone_number && userRow.phone_verified) {
    const digits = userRow.phone_number.replace(/\D/g, '')
    maskedPhone = '(•••) •••-' + digits.slice(-4)
  }

  res.json({
    sms_tier: userRow?.sms_tier ?? null,
    sms_alerts_enabled: userRow?.sms_alerts_enabled ?? true,
    phone_verified: userRow?.phone_verified ?? false,
    sms_count_this_period: userRow?.sms_count_this_period ?? 0,
    has_subscription: !!userRow?.stripe_sms_sub_id,
    masked_phone: maskedPhone,
  })
})

async function sendSmsAlert(recipientId, senderName, threadId) {
  if (!telnyxClient || !TELNYX_PHONE_NUMBER) return

  try {
    const { data: recipient } = await supabaseAdmin
      .from('users')
      .select('sms_tier, sms_alerts_enabled, phone_verified, phone_number, sms_count_this_period')
      .eq('id', recipientId)
      .single()

    if (!recipient) return
    if (!recipient.sms_tier) return
    if (!recipient.sms_alerts_enabled) return
    if (!recipient.phone_verified) return
    if (!recipient.phone_number) return

    if (recipient.sms_tier === 'starter') {
      if (recipient.sms_count_this_period >= 150) {
        console.log(`[sms-dispatch] Starter cap reached for user ${recipientId}, skipping SMS`)
        return
      }
      const { error: incrErr } = await supabaseAdmin
        .from('users')
        .update({ sms_count_this_period: recipient.sms_count_this_period + 1 })
        .eq('id', recipientId)
        .eq('sms_count_this_period', recipient.sms_count_this_period)
      if (incrErr) {
        console.error('[sms-dispatch] Failed to increment SMS count:', incrErr.message)
        return
      }
    }

    const appUrl = APP_ORIGIN + '/messages/' + threadId
    const smsBody = `New message from ${senderName} on TraydBook. Open the app to reply: ${appUrl}`

    await telnyxClient.messages.create({
      from: TELNYX_PHONE_NUMBER,
      to: recipient.phone_number,
      text: smsBody,
    })
    console.log(`[sms-dispatch] Sent SMS alert to user ${recipientId}`)
  } catch (err) {
    console.error('[sms-dispatch] Telnyx error (non-blocking):', err.message)
  }
}


// ── Solana Wallet Endpoints ───────────────────────────────────────────────────

const BASE58_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

app.post('/api/wallet/save-pubkey', requireAuth, async (req, res) => {
  const userId = req.user.id
  const { pubkey } = req.body ?? {}

  if (!pubkey || typeof pubkey !== 'string') {
    return res.status(400).json({ error: 'pubkey is required' })
  }
  if (!BASE58_REGEX.test(pubkey)) {
    return res.status(400).json({ error: 'Invalid Base58 public key format' })
  }

  try {
    new PublicKey(pubkey)
  } catch {
    return res.status(400).json({ error: 'Invalid Solana public key' })
  }

  const { data: userRow } = await supabaseAdmin
    .from('users')
    .select('account_type')
    .eq('id', userId)
    .single()

  if (!userRow) return res.status(404).json({ error: 'User not found' })
  if (userRow.account_type !== 'contractor') {
    return res.status(403).json({ error: 'Wallets are only available for contractors' })
  }

  const { error } = await supabaseAdmin
    .from('users')
    .update({ solana_pubkey: pubkey })
    .eq('id', userId)

  if (error) {
    console.error('[wallet/save-pubkey] DB error:', error.message)
    return res.status(500).json({ error: error.message })
  }

  console.log(`[wallet/save-pubkey] Saved pubkey for user ${userId}`)
  res.json({ success: true })
})

app.get('/api/wallet/status', requireAuth, async (req, res) => {
  const userId = req.user.id

  const { data: userRow, error } = await supabaseAdmin
    .from('users')
    .select('solana_pubkey, account_type')
    .eq('id', userId)
    .single()

  if (error) return res.status(500).json({ error: error.message })
  if (!userRow) return res.status(404).json({ error: 'User not found' })
  if (userRow.account_type !== 'contractor') {
    return res.status(403).json({ error: 'Wallets are only available for contractors' })
  }
  res.json({ solana_pubkey: userRow.solana_pubkey ?? null })
})

app.post('/api/wallet/remove', requireAuth, async (req, res) => {
  const userId = req.user.id

  const { data: userRow } = await supabaseAdmin
    .from('users')
    .select('account_type')
    .eq('id', userId)
    .single()

  if (!userRow) return res.status(404).json({ error: 'User not found' })
  if (userRow.account_type !== 'contractor') {
    return res.status(403).json({ error: 'Wallets are only available for contractors' })
  }

  const { error } = await supabaseAdmin
    .from('users')
    .update({ solana_pubkey: null })
    .eq('id', userId)

  if (error) {
    console.error('[wallet/remove] DB error:', error.message)
    return res.status(500).json({ error: error.message })
  }

  console.log(`[wallet/remove] Cleared pubkey for user ${userId}`)
  res.json({ success: true })
})

app.post('/api/wallet/send-reward', requireAuth, async (req, res) => {
  const userId = req.user.id

  const { data: adminRow } = await supabaseAdmin
    .from('users')
    .select('account_type')
    .eq('id', userId)
    .single()

  if (adminRow?.account_type !== 'admin') {
    return res.status(403).json({ error: 'Admin only' })
  }

  const { recipientPubkey, amountSol } = req.body ?? {}
  if (!recipientPubkey || !Number.isFinite(amountSol) || amountSol <= 0) {
    return res.status(400).json({ error: 'recipientPubkey and a positive amountSol are required' })
  }

  const treasuryKeyRaw = process.env.SOLANA_TREASURY_PRIVATE_KEY
  if (!treasuryKeyRaw) {
    return res.status(503).json({ error: 'SOLANA_TREASURY_PRIVATE_KEY not configured' })
  }

  let treasuryKeypair
  try {
    const keyArray = JSON.parse(treasuryKeyRaw)
    treasuryKeypair = Keypair.fromSecretKey(Uint8Array.from(keyArray))
  } catch {
    return res.status(500).json({ error: 'Invalid treasury key format' })
  }

  let recipientKey
  try {
    recipientKey = new PublicKey(recipientPubkey)
  } catch {
    return res.status(400).json({ error: 'Invalid recipient public key' })
  }

  try {
    const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed')
    const lamports = Math.round(amountSol * LAMPORTS_PER_SOL)

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: treasuryKeypair.publicKey,
        toPubkey: recipientKey,
        lamports,
      })
    )

    const signature = await sendAndConfirmTransaction(connection, transaction, [treasuryKeypair])
    console.log(`[wallet/send-reward] Sent ${amountSol} SOL to ${recipientPubkey}. Sig: ${signature}`)
    res.json({ success: true, signature })
  } catch (err) {
    console.error('[wallet/send-reward] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

const PORT = process.env.API_PORT ?? 3001
app.listen(PORT, () => {
  console.log(`[server] API ready on http://localhost:${PORT}`)
  startNotificationListener()
})

function startNotificationListener() {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('[sms-listener] SUPABASE_SERVICE_ROLE_KEY not set — SMS dispatch disabled')
    return
  }

  const listenerClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  listenerClient
    .channel('server-notifications')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'type=eq.message_received' },
      async (payload) => {
        const notif = payload.new
        if (!notif) return

        const recipientId = notif.user_id
        const entityId = notif.entity_id
        const entityType = notif.entity_type ?? ''

        const threadId = entityType.startsWith('thread:') ? entityType.slice(7) : null

        const { data: sender } = await supabaseAdmin
          .from('users')
          .select('display_name')
          .eq('id', entityId)
          .single()

        const senderName = sender?.display_name ?? 'Someone'

        sendSmsAlert(recipientId, senderName, threadId ?? '').catch(() => {})
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[sms-listener] Listening for message_received notifications')
      } else if (status === 'CHANNEL_ERROR') {
        console.error('[sms-listener] Channel error — SMS dispatch may be unavailable')
      }
    })
}
