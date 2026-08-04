/**
 * Resend email delivery webhook receiver
 *
 * Resend delivers webhook events via Svix. Signature verification uses
 * HMAC-SHA256 over "{svix-id}.{svix-timestamp}.{raw-body}" with the
 * base64-decoded signing secret (set via RESEND_WEBHOOK_SECRET env var).
 *
 * Matched send-log rows are looked up by bob_job_id (the Resend email_id
 * stored when Bob records the send). delivery_status is only upgraded,
 * never downgraded, according to the severity table below.
 *
 * Register this route BEFORE express.json() so express.raw() applies.
 */

import { Router } from 'express'
import { createHmac, timingSafeEqual } from 'crypto'
import express from 'express'
import { supabaseAdmin } from '../lib/clients.js'

const router = Router()

// ── Severity ordering ─────────────────────────────────────────────────────────
// Higher value = higher severity. A row's status is only updated when the
// incoming status has an equal or higher severity than the stored one.
const STATUS_SEVERITY = {
  sent: 1,
  delivered: 2,
  opened: 3,
  clicked: 4,
  failed: 5,
  bounced: 6, // sticky — always preserved once set
}

function shouldUpgradeStatus(current, incoming) {
  const cur = STATUS_SEVERITY[current] ?? 0
  const inc = STATUS_SEVERITY[incoming] ?? 0
  return inc > cur
}

// ── Resend / Svix event type → delivery_status ────────────────────────────────
function normaliseEvent(resendType) {
  switch (resendType) {
    case 'email.sent':
      return 'sent'
    case 'email.delivered':
      return 'delivered'
    case 'email.opened':
      return 'opened'
    case 'email.clicked':
      return 'clicked'
    case 'email.bounced':
      return 'bounced'
    case 'email.complained': // treat spam complaints as bounces (suppress address)
      return 'bounced'
    case 'email.delivery_delayed':
      return null // log the event but don't change delivery_status
    default:
      return null
  }
}

// ── Svix signature verification ───────────────────────────────────────────────
// Spec: https://docs.svix.com/receiving/verifying-payloads/how
//
// Secret format: "whsec_<base64>" — decode to raw bytes before use.
// Signed content: "{svix-id}.{svix-timestamp}.{raw-body}"
// Header: svix-signature = "v1,<base64sig1> v1,<base64sig2> ..."
function verifySvixSignature(rawBody, headers, secret) {
  if (!secret) return false

  const msgId = headers['svix-id']
  const msgTimestamp = headers['svix-timestamp']
  const msgSignature = headers['svix-signature']

  if (!msgId || !msgTimestamp || !msgSignature) return false

  // Reject replays older than 5 minutes
  const ts = parseInt(msgTimestamp, 10)
  if (isNaN(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false

  // Decode secret (strip "whsec_" prefix if present)
  const secretBase64 = secret.startsWith('whsec_') ? secret.slice(6) : secret
  let secretBytes
  try {
    secretBytes = Buffer.from(secretBase64, 'base64')
  } catch {
    return false
  }

  const toSign = `${msgId}.${msgTimestamp}.${rawBody}`
  const computed = createHmac('sha256', secretBytes).update(toSign).digest('base64')

  // svix-signature may contain multiple space-separated "v1,<sig>" tokens
  const candidates = msgSignature.split(' ')
  for (const candidate of candidates) {
    const [version, sig] = candidate.split(',')
    if (version !== 'v1' || !sig) continue
    try {
      if (timingSafeEqual(Buffer.from(sig, 'base64'), Buffer.from(computed, 'base64'))) {
        return true
      }
    } catch {
      // buffer lengths differ — not a match
    }
  }

  return false
}

// ── Auto-suppress bounced address ─────────────────────────────────────────────
async function suppressBounce(prospectId) {
  if (!prospectId) return

  const { data: prospect } = await supabaseAdmin
    .from('outreach_prospects')
    .select('email_found')
    .eq('id', prospectId)
    .single()

  if (!prospect?.email_found) return

  const email = prospect.email_found.toLowerCase()

  const { error: upsertErr } = await supabaseAdmin
    .from('outreach_unsubscribes')
    .upsert(
      { email, source: 'bounce', unsubscribed_at: new Date().toISOString() },
      { onConflict: 'email' }
    )
  if (upsertErr) {
    console.warn('[email-webhook] Failed to suppress bounced email:', upsertErr.message)
  }

  const { error: prospectErr } = await supabaseAdmin
    .from('outreach_prospects')
    .update({ status: 'bounced', updated_at: new Date().toISOString() })
    .eq('id', prospectId)
  if (prospectErr) {
    console.warn('[email-webhook] Failed to mark prospect as bounced:', prospectErr.message)
  }
}

// ── POST /api/webhooks/email-delivery ─────────────────────────────────────────
router.post(
  '/api/webhooks/email-delivery',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET

    // Signature check — skip only if secret is explicitly not configured
    if (webhookSecret) {
      const rawBody = req.body instanceof Buffer ? req.body.toString('utf8') : String(req.body)
      const valid = verifySvixSignature(rawBody, req.headers, webhookSecret)
      if (!valid) {
        console.warn('[email-webhook] Signature verification failed')
        return res.status(401).json({ error: 'Invalid webhook signature' })
      }
    } else {
      console.warn('[email-webhook] RESEND_WEBHOOK_SECRET not set — skipping signature verification')
    }

    // Parse body (raw middleware gives us a Buffer)
    let payload
    try {
      const raw = req.body instanceof Buffer ? req.body.toString('utf8') : String(req.body)
      payload = JSON.parse(raw)
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' })
    }

    const { type: eventType, data } = payload ?? {}

    if (!eventType || !data) {
      return res.status(400).json({ error: 'Missing event type or data' })
    }

    // Only process email delivery events
    if (!eventType.startsWith('email.')) {
      return res.status(200).json({ ok: true, skipped: true })
    }

    const deliveryStatus = normaliseEvent(eventType)
    const resendEmailId = data.email_id ?? data.id ?? null
    const recipientEmail = Array.isArray(data.to) ? data.to[0] : data.to

    // Require at least an email_id or recipient address to match
    if (!resendEmailId && !recipientEmail) {
      console.warn('[email-webhook] No email_id or recipient in payload — cannot match send log')
      return res.status(200).json({ ok: true, matched: false })
    }

    // Look up the send log row: prefer exact match on bob_job_id (= Resend email_id),
    // fall back to most-recent row for the recipient email
    let logRow = null

    if (resendEmailId) {
      const { data: byJobId } = await supabaseAdmin
        .from('outreach_send_log')
        .select('id, delivery_status, delivery_events, prospect_id')
        .eq('bob_job_id', resendEmailId)
        .maybeSingle()
      logRow = byJobId
    }

    if (!logRow && recipientEmail) {
      // Find the most recent send to this address
      const { data: prospect } = await supabaseAdmin
        .from('outreach_prospects')
        .select('id')
        .eq('email_found', recipientEmail.toLowerCase())
        .maybeSingle()

      if (prospect) {
        const { data: byProspect } = await supabaseAdmin
          .from('outreach_send_log')
          .select('id, delivery_status, delivery_events, prospect_id')
          .eq('prospect_id', prospect.id)
          .order('sent_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        logRow = byProspect
      }
    }

    if (!logRow) {
      console.warn(
        `[email-webhook] No send log row found for email_id=${resendEmailId} / to=${recipientEmail}`
      )
      return res.status(200).json({ ok: true, matched: false })
    }

    // Idempotency: discard duplicate deliveries from Svix retries
    const svixMessageId = req.headers['svix-id'] ?? null
    const existingEvents = logRow.delivery_events || []

    if (svixMessageId) {
      const alreadySeen = existingEvents.some((e) => e.svix_id === svixMessageId)
      if (alreadySeen) {
        console.log(
          `[email-webhook] Duplicate svix-id=${svixMessageId} — discarding`
        )
        return res.status(200).json({ ok: true, duplicate: true })
      }
    } else {
      // Secondary guard for events that arrive without a svix-id (e.g. non-Svix paths).
      // Deduplicate on (event type + timestamp + email_id) so a replayed payload
      // can't inflate open/click counts even when the idempotency header is absent.
      const eventTimestamp = data.created_at ?? null
      const alreadySeen = existingEvents.some(
        (e) =>
          e.type === eventType &&
          e.timestamp === eventTimestamp &&
          (e.metadata?.email_id ?? null) === resendEmailId
      )
      if (alreadySeen) {
        console.log(
          `[email-webhook] Duplicate event (no svix-id): type=${eventType} ts=${eventTimestamp} email_id=${resendEmailId} — discarding`
        )
        return res.status(200).json({ ok: true, duplicate: true })
      }
    }

    // Build the event entry for the delivery_events log
    const newEvent = {
      type: eventType,             // store the raw provider event type
      timestamp: data.created_at ?? new Date().toISOString(),
      ...(svixMessageId ? { svix_id: svixMessageId } : {}),
      metadata: {
        ...(resendEmailId ? { email_id: resendEmailId } : {}),
        ...(data.click?.link ? { link: data.click.link } : {}),
        ...(data.bounce?.message ? { bounce_message: data.bounce.message } : {}),
      },
    }

    const updates = {
      updated_at: new Date().toISOString(),
      delivery_events: [...(logRow.delivery_events || []), newEvent],
    }

    // Only upgrade delivery_status — never downgrade
    if (deliveryStatus && shouldUpgradeStatus(logRow.delivery_status, deliveryStatus)) {
      updates.delivery_status = deliveryStatus
    }

    const { error: updateErr } = await supabaseAdmin
      .from('outreach_send_log')
      .update(updates)
      .eq('id', logRow.id)

    if (updateErr) {
      console.error('[email-webhook] Failed to update send log:', updateErr.message)
      return res.status(500).json({ error: 'Failed to update send log' })
    }

    // Auto-suppress bounces (includes spam complaints mapped to 'bounced')
    if (updates.delivery_status === 'bounced') {
      await suppressBounce(logRow.prospect_id)
    }

    console.log(
      `[email-webhook] ${eventType} → log ${logRow.id}` +
        (updates.delivery_status ? ` status=${updates.delivery_status}` : ' (event logged)')
    )

    return res.status(200).json({ ok: true, log_id: logRow.id })
  }
)

export default router
