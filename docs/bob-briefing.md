# Bob Agent — Admin API Briefing

> **Last updated:** 2026-05-20
> Share this document with whoever operates Bob's server whenever the admin API contract changes.

---

## What changed and why Bob needs to know

Several security hardening changes were made to the admin panel. Some of them affect how Bob interacts with the TraydBook admin API.

---

## 1. Env var names — canonical vs legacy

The canonical names (from Bob's handoff spec) are now preferred. The legacy names are still accepted as fallbacks.

| Purpose | Canonical (use this) | Legacy (still works) |
|---|---|---|
| Bob's agent server URL | `BOB_URL` | `BOB_AGENT_ENDPOINT` |
| Shared bearer token | `BOB_ADMIN_KEY` | `ADMIN_TO_BOB_TOKEN` |

Set these on both sides:
- **TraydBook admin server** (Coolify — admin service): `BOB_URL`, `BOB_ADMIN_KEY`
- **Bob's server**: `BOB_ADMIN_KEY` (same value — Bob verifies inbound requests with it)

`bob.traydbook.com` DNS is now live on t1 (192.168.1.20). Use the public URL:
```
BOB_URL=https://bob.traydbook.com
BOB_ADMIN_KEY=<shared_secret>
```

---

## 2. All `/api/admin/bob/*` routes now require authentication

Previously these routes were unprotected. They now require:

- A valid Supabase JWT in the `Authorization: Bearer <token>` header
- The calling account must have `account_type` of `admin` or `admin_2`

**Affected routes:**

| Route | Method | Minimum role |
|---|---|---|
| `/api/admin/bob/logs` | GET | Any staff |
| `/api/admin/bob/control` | GET | Any staff |
| `/api/admin/bob/control` | PATCH | `admin` or `admin_2` |
| `/api/admin/bob/lead-stats` | GET | Any staff |
| `/api/admin/bob/ping` | GET | Any staff |
| `/api/admin/bob/command` | POST | `admin` or `admin_2` |
| `/api/admin/bob/suggestion/:id/approve` | POST | `admin` or `admin_2` |

Calls without a valid token will receive `401 Unauthorized`. Calls with a valid token but insufficient role will receive `403 Forbidden`.

**The admin → Bob push direction is unchanged** — when the admin panel pushes to Bob's server it sends `Authorization: Bearer <BOB_ADMIN_KEY>`. Bob verifies that token on its end.

---

## 3. Rate limits are now enforced

All admin API routes are rate-limited. Bob's routes fall under the **Bob/AI tier**:

- **`/api/admin/bob/*`** — **20 requests per 15 minutes per IP**

If Bob polls the admin API (e.g. for logs or control flags), make sure the polling interval doesn't exceed this. A safe polling interval is no more than once every 60 seconds for any single endpoint.

When a rate limit is hit the server returns:

```json
HTTP 429
{
  "error": "TOO_MANY_REQUESTS",
  "message": "AI command rate limit exceeded — maximum 20 requests per 15 minutes."
}
```

The response also includes `RateLimit-Limit`, `RateLimit-Remaining`, and `RateLimit-Reset` headers — Bob can read these to back off gracefully.

---

## 4. SQL repair approval — new flow

If Bob ever submits or acts on SQL repair requests, the flow has changed significantly:

**Old flow:** Submit SQL → get an approval code → execute with that code.

**New flow:**
1. `POST /api/admin/repair/request` — submit SQL + description. Returns a pending request. **The requester does not receive the code** — a second admin must view and approve it.
2. `POST /api/admin/repair/approve` — a *different* super-admin approves the pending request. Self-approval is blocked at the server.
3. `POST /api/admin/repair/execute` — execute the approved SQL. The approval code is **cryptographically bound to the SHA-256 hash of the exact SQL submitted**. Submitting different SQL with the same code will be rejected. Codes expire **1 hour** after the approval request was created. Each code can only be used **once** — the `approved → used` transition is atomic.

This means Bob cannot unilaterally approve and execute its own SQL. A human admin must be in the loop.

---

## 5. SSRF protection on webhook dispatch

`POST /api/admin/webhooks/dispatch` now resolves the target hostname via DNS and rejects requests to any private/loopback IP range (10.x, 172.16-31.x, 192.168.x, 127.x, ::1, etc.) **after DNS resolution** — not just by string matching. HTTP redirects are also disabled.

If Bob dispatches webhooks to internal services, those calls will now be blocked. Webhook targets must be publicly reachable hostnames.

---

## 6. Security scan endpoints (for awareness)

A new set of routes exists at `/api/admin/security/*`:

| Route | What it does |
|---|---|
| `GET /api/admin/security/audit` | Runs `npm audit` and returns vulnerability report |
| `GET /api/admin/security/codescan` | Scans source files for secrets, weak patterns |
| `POST /api/admin/security/snapshot` | Captures HMAC-signed file integrity snapshot |
| `GET /api/admin/security/snapshot` | Compares current file state to snapshot |

These are **rate-limited to 5 requests per hour** — they invoke shell processes and are intentionally expensive. Bob should not poll these.

---

## 7. `/healthz` change

The public health check at `GET /healthz` no longer returns `safe_mode_reason`. It only returns:

```json
{ "ok": true, "safe_mode": false }
```

The detailed reason is only available at `GET /api/admin-health`, which is behind the IP allowlist.

---

## Summary checklist for Bob's operator

**Env vars:**
- [ ] Set `BOB_URL=https://bob.traydbook.com` on the TraydBook admin service in Coolify (`bob.traydbook.com` DNS is live on t1)
- [ ] Set `BOB_ADMIN_KEY=<shared_secret>` on the TraydBook admin service — must exactly match the value on Bob's side

**Integration:**
- [ ] Confirm `GET /api/bob/control` returns the expected shape including `traydbook_url_override`
- [ ] Issue a dev-scoped service key for Bob from the admin panel (`/api/admin/api-keys`) and add it to Bob's Coolify env as `TRAYDBOOK_SERVICE_KEY` with `TRAYDBOOK_API_URL=https://dev.traydbook.com`
- [ ] Once dev is verified, issue a prod key and point Bob at `https://app.traydbook.com`

**Auth:**
- [ ] Ensure Bob's outbound calls to `/api/admin/bob/*` include a valid `Authorization: Bearer <jwt>` header
- [ ] Confirm polling interval is > 60 seconds per endpoint to stay within the 20 req/15min rate limit

**Security:**
- [ ] If Bob dispatches webhooks via the admin API, confirm all target URLs are publicly reachable (no internal IPs)
- [ ] If Bob was relying on unilateral SQL repair execution, update its flow to expect human-in-the-loop approval
- [ ] Update any health check monitoring that was parsing `safe_mode_reason` from `/healthz`

**Bob's known commands (for the admin command bar):**

| Command | Args | Effect |
|---|---|---|
| `pause_outreach` | `{}` | Stops Bob's scheduler |
| `resume_outreach` | `{}` | Resumes outreach |
| `trigger_lead_search` | `{}` | Queues a lead search immediately |
| `switch_provider` | `{"provider": "openrouter"\|"openai"\|"anthropic"\|"perplexity"\|"groq"\|"ollama"\|null}` | Overrides AI provider; null clears override |
