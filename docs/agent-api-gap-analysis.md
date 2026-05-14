# Agent System — API Gap Analysis

This document maps what the external AI agent system needs against what TraydBook's API currently provides.

---

## Service API Key

**Current state:** No scoped service key system exists. The server uses the Supabase service role key (full DB access) or user JWT tokens (tied to a logged-in user). Neither is appropriate for an agent.

**What needs to be built:**
- A `service_api_keys` table in Supabase (id, name, key_hash, scopes[], created_at, last_used_at)
- A key generation endpoint (admin only): `POST /api/admin/service-keys`
- Middleware that accepts `X-Service-Key: <key>` header and validates scope before each agent request
- Scopes to implement: `leads:read`, `leads:write`, `contractor:read`, `lead_bank:write`, `agent_log:write`, `skips:read`

**No admin privileges, no billing access** — enforced at the middleware level.

---

## Endpoints the Agent Needs — Current Status

| What the agent needs | Endpoint | Status |
|---|---|---|
| Read contractor profile | Supabase direct query | ✅ Exists (via Supabase client) |
| Read contractor's subscription tier | Supabase `users.account_type` | ✅ Exists |
| Read contractor's service areas | Supabase `contractor_profiles.service_areas` | ✅ Exists |
| Read lead bank balance | Supabase `users` table | ⚠️ Column not built yet |
| Read Trust Score | — | ❌ Not built |
| Read availability windows | — | ❌ Not built |
| Deliver lead to contractor dashboard | — | ❌ Not built |
| Deduct from lead bank on delivery | — | ❌ Not built |
| Log agent activity | — | ❌ Not built |
| Read skip/pass actions | — | ❌ Not built (UI not built either) |
| Adjust credits (admin use) | `POST /api/admin/credits` | ✅ Exists (admin only) |

---

## Webhooks

**Current state:** TraydBook has a Stripe webhook receiver (`POST /api/webhooks/stripe`). No general outbound webhook system exists.

**What needs to be built:**
A webhook dispatch system that fires signed POST requests to a registered endpoint when platform events occur.

| Event | Trigger point in code | Status |
|---|---|---|
| `contractor.profile_updated` | After any `UPDATE` on `users` or `contractor_profiles` | ❌ Not built |
| `lead.claimed` | When contractor accepts a lead | ❌ Not built (leads not built) |
| `lead.passed` | When contractor skips a lead | ❌ Not built |
| `lead.expired` | Scheduled job when lead window closes | ❌ Not built |
| `subscription.activated` | Stripe webhook → subscription created | ⚠️ Stripe webhook exists, needs event routing |
| `subscription.cancelled` | Stripe webhook → subscription cancelled | ⚠️ Stripe webhook exists, needs event routing |
| `lead_bank.low` | When lead bank drops below threshold | ❌ Not built |

**Recommended approach:** Add a `webhook_subscriptions` table (url, events[], secret) and a `dispatchWebhook(event, payload)` utility that signs payloads with HMAC-SHA256 and fires async POST requests. Mirror the Stripe webhook pattern already in the codebase.

---

## OpenAPI Spec

The full OpenAPI 3.0 spec for existing endpoints is at `docs/openapi.yaml`.

**Endpoints that exist today:** 38 routes across auth, posts, team, SMS, wallet, billing, and admin.

**Endpoints that need to be built for the agent system:**

```
POST   /api/leads                          Create/deliver a lead to a contractor
GET    /api/leads                          List leads for current contractor
PATCH  /api/leads/:id/claim               Contractor claims a lead
PATCH  /api/leads/:id/pass                Contractor passes on a lead
GET    /api/contractor/:id/trust-score    Get Trust Score for a contractor
GET    /api/contractor/:id/lead-bank      Get lead bank balance
PATCH  /api/contractor/:id/lead-bank      Adjust lead bank balance
POST   /api/agent/log                     Log agent activity entry
GET    /api/agent/log/:contractor_id      Get agent activity for a contractor
POST   /api/webhooks/register             Register an outbound webhook endpoint
DELETE /api/webhooks/:id                  Remove a webhook subscription
```

---

## Build Priority Order

1. **Lead bank balance column** — simple DB migration, unblocks everything else
2. **Service API key system** — needed before agent can authenticate
3. **Lead delivery endpoint** — core of the agent's job
4. **Skip/Pass UI + endpoint** — needed for queue logic
5. **Agent activity log** — visibility for contractors
6. **Trust Score calculation** — needed for queue ranking
7. **Webhook system** — needed for real-time agent reactions
8. **Availability windows** — needed for scheduling phase

---

## Notes for the External Dev

- Auth: Use `X-Service-Key` header (to be built). Do not use a user JWT.
- All Supabase data is Postgres — direct queries via the service key are possible but should go through the API layer, not directly to the DB, to keep audit logs intact.
- Stripe subscription events already flow through `/api/webhooks/stripe` — we can add routing for `subscription.activated` and `subscription.cancelled` from there without rebuilding anything.
- The existing admin credit adjustment endpoint (`POST /api/admin/credits`) is close to what lead bank deduction needs — the agent endpoint will follow the same pattern but with `leads:write` scope instead of admin auth.
