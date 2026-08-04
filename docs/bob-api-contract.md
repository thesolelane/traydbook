# TraydBook ↔ Bob API Contract

Generated: 2026-05-17

---

## Authentication

**Bob calling TraydBook:** Include `X-Service-Key: <service_key>` on every request.

**Admin panel calling Bob:** Include `Authorization: Bearer <ADMIN_TO_BOB_TOKEN>` on every push.

---

## Part 1 — Bob → TraydBook

Bob calls these endpoints on TraydBook's server.

**Base URL:** `https://admin.traydbook.com`

---

### Logging

#### POST /api/agent/log
**Scope:** `agent:log`
**Description:** Write an activity log entry. Appears in the Bob Monitor tab.

**Request body:**
```json
{
  "agent_name": "bob",
  "action": "lead.found",
  "status": "success",
  "target_type": "rfq",
  "target_id": "uuid",
  "contractor_id": "uuid",
  "message": "Found matching lead",
  "metadata": {},
  "duration_ms": 320,
  "ai_provider": "ollama"
}
```

**Response `201`:**
```json
{ "ok": true, "id": "uuid", "created_at": "2026-05-17T00:00:00Z" }
```

**Action vocabulary (use these values for `action`):**

| Category | Actions |
|---|---|
| Leads | `lead.found`, `lead.delivered`, `lead.expired`, `lead.matched` |
| Outreach | `outreach.sent`, `outreach.failed`, `outreach.scheduled` |
| Content | `content.generated`, `content.posted`, `content.failed` |
| System | `system.startup`, `system.shutdown`, `system.error`, `system.health` |
| Admin panel | `panel.suggestion` |

---

### Leads

#### POST /api/leads
**Scope:** `leads:write`
**Description:** Deliver a lead to a contractor.

**Request body:**
```json
{
  "rfq_id": "uuid",
  "contractor_id": "uuid",
  "expires_at": "2026-05-18T00:00:00Z",
  "queue_position": 1,
  "trust_score_at_delivery": 87,
  "notes": "Strong match"
}
```

**Response `201`:**
```json
{ "ok": true, "lead": { "id": "uuid", "status": "pending", "delivered_at": "..." } }
```

---

#### GET /api/leads/:id
**Scope:** `leads:read`
**Description:** Fetch a single lead by ID.

**Response `200`:**
```json
{ "lead": { "id": "uuid", "status": "pending", ... } }
```

---

#### POST /api/leads/:id/claim
**Scope:** `leads:write`
**Description:** Mark a lead as claimed. Automatically deducts 1 credit from the contractor's lead bank.

**Response `200`:**
```json
{ "ok": true, "lead": { "id": "uuid", "status": "claimed", "contractor_id": "uuid" } }
```

**Error `409`:** Lead already acted on or not found.

---

#### POST /api/leads/:id/pass
**Scope:** `leads:write`
**Description:** Mark a lead as passed (contractor skipped it). No lead bank deduction.

**Response `200`:**
```json
{ "ok": true, "lead": { "id": "uuid", "status": "passed" } }
```

---

### Contractor

#### GET /api/contractor/:id/profile
**Scope:** `contractor:read`
**Description:** Full user + contractor profile data.

**Response `200`:**
```json
{
  "user": {
    "id": "uuid",
    "display_name": "John Smith",
    "handle": "johnsmith",
    "avatar_url": null,
    "account_type": "contractor",
    "location_city": "Austin",
    "location_state": "TX",
    "created_at": "..."
  },
  "profile": {
    "primary_trade": "plumbing",
    "secondary_trades": ["hvac"],
    "years_experience": 8,
    "bio": "...",
    "service_radius_miles": 25,
    "badge_tier": "pro_verified",
    "trust_score": 87,
    "lead_bank_balance": 12,
    "rating_avg": 4.8,
    "rating_count": 34,
    "projects_completed": 102,
    "availability_status": "available"
  }
}
```

---

#### GET /api/contractor/:id/lead-bank
**Scope:** `contractor:read`
**Description:** Current lead bank balance and last 20 ledger entries.

**Response `200`:**
```json
{
  "balance": 12,
  "ledger": [
    { "id": "uuid", "delta": -1, "balance_after": 12, "reason": "lead_claimed", "created_at": "..." }
  ]
}
```

---

#### PATCH /api/contractor/:id/lead-bank
**Scope:** `lead-bank:write`
**Description:** Adjust a contractor's lead bank balance. Use positive delta to add, negative to deduct.

**Request body:**
```json
{ "delta": -1, "reason": "lead_claimed" }
```

**Response `200`:**
```json
{ "ok": true, "new_balance": 11 }
```

---

### Outreach

#### POST /api/admin/outreach/send-log
**Scope:** `outreach:write`
**Description:** Record a completed email send in the send log. Bob must call this immediately after Resend accepts the message and **set `bob_job_id` to the `id` returned by the Resend API** (`data.id` in the Resend response). This is the key that lets the delivery webhook match incoming events back to the exact send-log row.

**Request body:**
```json
{
  "prospect_id": "uuid",
  "template_id": "uuid",
  "rendered_subject": "Grow Your Business with TraydBook — Alex",
  "rendered_body_html": "<p>Hi Alex …</p>",
  "rendered_body_text": "Hi Alex …",
  "delivery_status": "sent",
  "bob_job_id": "<resend_email_id>"
}
```

**Field notes:**

| Field | Required | Description |
|---|---|---|
| `prospect_id` | ✅ | The outreach prospect who received this email |
| `template_id` | ✅ | The approved template Bob used |
| `rendered_subject` | ✅ | Subject after merge-tag substitution |
| `rendered_body_html` | ✅ | HTML body after merge-tag substitution |
| `rendered_body_text` | — | Plain-text body (recommended; used as fallback by email clients) |
| `delivery_status` | — | Initial status; defaults to `sent` |
| `bob_job_id` | ✅ **required** | The `id` from the Resend `emails.send()` response (the Resend email_id). The endpoint returns `400` if this field is missing or blank. It is stored so the delivery webhook can match incoming events back to this exact row without any ambiguity. |

**Resend → bob_job_id mapping:**
```js
const { data, error } = await resend.emails.send({ from, to, subject, html, text })
// data.id is the Resend email_id — store it as bob_job_id
await fetch(`${TRAYDBOOK_API}/api/admin/outreach/send-log`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Service-Key': SERVICE_KEY },
  body: JSON.stringify({
    prospect_id, template_id, rendered_subject, rendered_body_html, rendered_body_text,
    bob_job_id: data.id,   // ← the Resend email_id
  }),
})
```

**Response `201`:**
```json
{
  "id": "uuid",
  "prospect_id": "uuid",
  "template_id": "uuid",
  "rendered_subject": "…",
  "delivery_status": "sent",
  "bob_job_id": "<resend_email_id>",
  "sent_at": "2026-08-04T00:00:00Z"
}
```

**Error `422`:** Prospect email is suppressed (previously bounced or opted out). Bob should mark the prospect as `skipped` and move on.

---

#### Delivery webhook — how events flow back

Resend posts delivery events (delivered, opened, clicked, bounced) to:

```
POST /api/webhooks/email-delivery
```

The webhook matches each event to a send-log row by looking up `bob_job_id = data.email_id` in `outreach_send_log`. When `bob_job_id` is set correctly, the match is exact and reliable. If it is missing, the webhook attempts a less-precise fallback match on the recipient email address (most-recent send to that address), which may mis-match when a prospect was emailed more than once.

**Resend event → delivery_status mapping:**

| Resend event type | Stored `delivery_status` |
|---|---|
| `email.sent` | `sent` |
| `email.delivered` | `delivered` |
| `email.opened` | `opened` |
| `email.clicked` | `clicked` |
| `email.bounced` | `bounced` (address auto-suppressed) |
| `email.complained` | `bounced` (spam complaint treated as bounce) |
| `email.delivery_delayed` | *(event logged, status unchanged)* |

Status is only ever upgraded, never downgraded (severity order: sent < delivered < opened < clicked < failed < bounced).

---

### Control State

#### GET /api/bob/control
**Scope:** `agent:read`
**Description:** Read current control flags. Bob should poll this at the start of each cycle to check for pause/override signals.

**Response `200`:**
```json
{
  "paused": false,
  "ai_provider_override": null,
  "lead_refresh_force": false,
  "max_leads_per_cycle": 10
}
```

**Control keys:**

| Key | Type | Description |
|---|---|---|
| `paused` | boolean | Hard pause — Bob should stop all activity immediately |
| `ai_provider_override` | string or null | Force a specific provider (e.g. `"ollama"`, `"openai"`) |
| `lead_refresh_force` | boolean | Trigger an immediate lead search cycle |
| `max_leads_per_cycle` | number | Maximum leads to distribute in one run |

---

## Part 2 — Admin Panel → Bob

The admin panel pushes these events to Bob's server in real time.
Bob must implement these endpoints.

**Base URL:** `https://bob.traydbook.com`

All requests include `Authorization: Bearer <ADMIN_TO_BOB_TOKEN>`.
Requests are fire-and-forget — the admin panel does not block on a response. Return `200` quickly.

---

#### GET /bob/healthz
**Trigger:** Admin clicks "Ping Bob" in the Bob Monitor tab.
**Description:** Connectivity check. Return 200 if Bob is alive.

**Response `200`:**
```json
{ "ok": true }
```

---

#### POST /bob/control
**Trigger:** Admin changes a control flag (pause, AI provider, max leads, force refresh).

**Request body:**
```json
{ "key": "paused", "value": "true" }
```

Keys match the `GET /api/bob/control` response. Values are always strings.

---

#### POST /bob/contractor/trust-update
**Trigger:** Admin manually recalculates a contractor's trust score.

**Request body:**
```json
{ "contractor_id": "uuid", "new_score": 87 }
```

---

#### POST /bob/contractor/lead-bank
**Trigger:** Admin manually adjusts a contractor's lead bank balance.

**Request body:**
```json
{ "contractor_id": "uuid", "new_balance": 12, "delta": 2 }
```

---

#### POST /bob/user/suspend
**Trigger:** Admin suspends or reinstates a user account.

**Request body:**
```json
{ "user_id": "uuid", "suspended": true }
```

Bob should remove suspended users from active outreach pools immediately.

---

#### POST /bob/content/removed
**Trigger:** Admin rejects content in the moderation queue.

**Request body:**
```json
{ "content_id": "uuid", "content_type": "post", "reason": "spam" }
```

---

#### POST /bob/command
**Trigger:** Admin submits a raw command via the AI Command Bar.

**Request body:**
```json
{ "command": "pause_outreach", "args": {} }
```

---

#### POST /bob/suggestion/approved
**Trigger:** Admin clicks "Approve" on a Bob suggestion in the Bob Monitor tab.

**Request body:**
```json
{ "suggestion_id": "uuid" }
```

---

## Summary

| Direction | Count | Auth |
|---|---|---|
| Bob → TraydBook | 10 endpoints | `X-Service-Key` |
| Admin → Bob | 8 endpoints | `Authorization: Bearer` |

**Bob's service key scopes required:**
`agent:log`, `agent:read`, `leads:read`, `leads:write`, `contractor:read`, `lead-bank:write`
