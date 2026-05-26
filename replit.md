# TraydBook

TraydBook is a professional network enabling construction industry professionals to connect, find work, bid on projects, and establish verified reputations.

## Run & Operate

To run the application, use `npm run dev`.
For a production build, use `npm run build` followed by `npm run start`.
Typechecking is handled by TypeScript during development and build.
Database schema is managed via `supabase/schema.sql` and migrations in `supabase/migrations/`.
Stripe products need to be seeded using `scripts/seed-stripe-products.js`.

**Required Environment Variables:**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `APP_ORIGIN` (e.g., `https://app.traydbook.com`)
- `TELNYX_API_KEY`
- `TELNYX_PHONE_NUMBER`
- `SMS_STARTER_PRICE_ID`
- `SMS_UNLIMITED_PRICE_ID`
- `NODE_ENV` (set to `production` for deployments)
- `ADMIN_ALLOWED_IPS` (for admin panel, comma-separated IPs)
- `SUPABASE_ENV` (optional, `beta` or `production`)
- `BETA_SUPABASE_URL` (if `SUPABASE_ENV` is `beta`)
- `BETA_SUPABASE_ANON_KEY` (if `SUPABASE_ENV` is `beta`)
- `BETA_SUPABASE_SERVICE_ROLE_KEY` (if `SUPABASE_ENV` is `beta`)
- `KEY_MASTER_SECRET` (optional — enables admin key rotation)
- `ADMIN_REQUEST_SECRET` (optional — enables HMAC request signing)
- `SLACK_WEBHOOK_URL` (optional — security alert Slack notifications)
- `PAGERDUTY_KEY` (optional — CRITICAL alert paging)
- `BOB_ENDPOINT` (optional — Ollama endpoint for AI command bar, e.g. `http://bob:11434`)
- `BOB_MODEL` (optional — Ollama model name, default `llama3`)
- `BOB_URL` (optional — Bob's agent server URL, e.g. `https://bob.traydbook.com`; enables push commands from admin panel)
- `BOB_ADMIN_KEY` (required if BOB_URL set — shared bearer token; admin sends as `Authorization: Bearer`, Bob verifies on inbound requests)
- `BOB_AGENT_ENDPOINT` (legacy alias for BOB_URL — still accepted)
- `ADMIN_TO_BOB_TOKEN` (legacy alias for BOB_ADMIN_KEY — still accepted)
- `ENABLE_KEY_ROTATION` (`true` to activate 10-minute key rotation)
- `SOLANA_TREASURY_PRIVATE_KEY` (for admin rewards)
- `SIM_WEBHOOK_SECRET` (for internal simulation webhook)
- `RESEND_API_KEY` (for wallet key emails via Resend — `POST /api/wallet/email-key`)

## Stack

- **Frontend**: React 18, TypeScript, Vite
- **Backend**: Supabase (Auth, Database), Express.js (Node 20 Alpine)
- **Styling**: Pure CSS (custom properties)
- **Routing**: React Router v6
- **ORM**: _Populate as you build_
- **Validation**: _Populate as you build_
- **Build Tool**: Vite, Docker

## Where things live

- **Database Schema**: `supabase/schema.sql`
- **Database Migrations**: `supabase/migrations/`
- **Supabase Client Config**: `src/lib/supabase.ts`
- **TypeScript DB Types**: `src/lib/database.types.ts`
- **Auth Context**: `src/context/AuthContext.tsx`
- **Main Feed Logic**: `src/pages/Feed.tsx`
- **API Contracts**: `server/routes/` directory for various API endpoints (e.g., `server/routes/stripe.js`, `server/routes/team.js`, `server/routes/wallet.js`)
- **Theme/Global Styles**: `src/index.css` (global CSS variables + reset)
- **Deployment Scripts/Configs**: `deploy/`
- **Admin Panel**: `admin-app/` for frontend, `admin-server.js` for backend.
- **Canonical Trade Options**: `src/data/trades.ts`

## Architecture decisions

- **Separate Admin Panel**: The admin panel is a standalone application with its own build and server, allowing independent deployment and enhanced security via IP whitelisting.
- **Client-Side Solana Wallet Generation**: Solana private keys are generated and remain exclusively client-side, never touching the server, to maximize user security. The public key is saved to `users.solana_pubkey` via `POST /api/wallet/save-pubkey`.
- **Pure CSS Styling**: No external CSS framework is used to maintain full control over styling and minimize bundle size.
- **Environment-Agnostic Supabase Configuration**: A single `SUPABASE_ENV` variable controls whether the app connects to production or beta Supabase projects, simplifying environment switching.
- **Module-Based Server Structure**: The server logic is refactored into focused modules by concern (e.g., `stripe.js`, `wallet.js`, `team.js`) to improve maintainability and scalability.
- **Admin Safe Mode**: On startup, `admin-server.js` runs secret validation + Supabase connection check. Any failure activates safe mode — all write routes are quarantined, read-only monitoring still works.
- **AI Command Bar (BOB-first)**: Admin natural language commands use Ollama (`BOB_ENDPOINT`) if configured, falling back to OpenAI. Neither is required; the endpoint returns a 503 with a hint if neither is set.
- **Email in public.users**: `email` is stored in both `auth.users` (Supabase-managed) and `public.users.email` (written at onboarding via `req.user.email` from the verified JWT). This avoids repeated `auth.admin.listUsers` round-trips on admin queries and enables server-side email search. Migration `030` back-fills any rows missing it.

## Product

- **User Types**: Contractors/Tradespeople, Design Professionals (free), Project Owners, Real Estate Agents, Homeowners (credit-based).
- **Credit System**: Users purchase credits to perform actions like posting RFQs, jobs, sending messages, or boosting listings.
- **Verified Badge System**: Contractors can earn `pro_verified`, `licensed`, or `vouched` badges based on credentials, enhancing trust.
- **Diverse Post Types**: Supports `project_update`, `bid_post`, `job_post`, `trade_tip`, `safety_alert`, `referral` posts.
- **Real-time Messaging & Notifications**: Features a messaging inbox with unread indicators and real-time updates, plus grouped notifications.
- **SMS Alerts**: Optional, subscription-based SMS notifications for message alerts via Telnyx.
- **Team Delegation**: Allows users to delegate account management to team members with different roles (Admin/Contributor).
- **Solana Wallet Integration**: Contractors automatically receive a Solana wallet upon signup for future crypto-related features.
- **Social Login**: Supports Google, Apple, and LinkedIn OAuth for streamlined user onboarding.

## User preferences

_Populate as you build_

## Investor & Homeowner Referral Programme (planned)

Both investors and homeowners receive welcome credits and a personal referral link. A shared rule governs when referral earnings are paid out.

### Investor tier
| Cohort | Welcome credits |
|---|---|
| First 100 investors | 50 free credits on account creation |
| After first 100 | Referral link only (no welcome bonus) |

### Homeowner tier
| Cohort | Welcome credits |
|---|---|
| First 100 homeowners | 50 free credits on account creation |
| After first 100 | Referral link only (no welcome bonus) |

### Referral reward (both tiers)
- **+10 credits** awarded to the referrer each time someone completes onboarding using their referral link
- No cap on total referral earnings

### Shared rule — credits must be exhausted before referral payouts
- Referral credits are **held** (not added to balance) while the user still has any welcome or previously issued credits remaining
- Once their balance reaches **0**, the held referral credits are released to their balance
- This prevents credit hoarding and ensures users engage with the platform before earning more

**Implementation notes (not yet built):**
- `investor` account type; homeowners already exist (`homeowner`)
- `referral_code` column on `users` — unique slug generated at account creation for both types
- `referral_signups` table: `(id, referral_code, referred_user_id, awarded_at, held)`
- `referral_credits_held` column on `users` — pending credits not yet released
- Payout trigger: when a credit debit brings `credit_balance` to 0, check `referral_credits_held > 0`, release to balance and log
- Welcome bonus cohort check at onboarding time via `COUNT(*)` on matching account type
- Admin view: referral stats, held balance, and release history per user

---

## Brokerage Referral Credit Programme (planned)

Real estate brokerages that sign up receive a pool of credits they can distribute to their agents and homeowner clients (buyers/sellers) once those users have created accounts.

**Tiered credit pool by signup order (first 300 brokerages):**
| Brokerage cohort | Credits issued to brokerage on signup |
|---|---|
| 1 – 100 | 250 credits |
| 101 – 200 | 150 credits |
| 201 – 300 | 50 credits |

**Rules:**
- Credits are held at the brokerage level until the brokerage issues them to a named user
- Recipient must have an existing TraydBook account (agent or homeowner) before transfer
- Credits transferred to agents/homeowners behave like normal platform credits
- Cohort position is determined by the brokerage's `created_at` timestamp (first 100 rows with `account_type = 'brokerage'`, etc.)

**Implementation notes (not yet built):**
- Requires a `brokerage` account type and a `brokerage_credit_pool` table (or column on users)
- A `brokerage_credit_transfers` log table to track who issued what to whom
- Admin endpoint to view pool balances and transfer history
- Cohort calculation should be a DB view or function so it updates automatically as brokerages join

---

## Planned Platform Features (core — not AI-agent specific)

These apply to all contractors regardless of AI subscription tier:

- **Trust Score** — calculated from profile data: license verification, badges earned, photos uploaded, response rate, review scores. Drives queue position in lead distribution.
- **Queue Position** — lead distribution logic ranks contractors by Trust Score. Higher score = earlier access to leads in their trade/area.
- **Skip / Pass UI** — contractor can pass on a lead. Platform records the skip (affects analytics, not punished but tracked).
- **Lead Bank Balance** — per-contractor credit/lead balance tracked in the database. Separate from the general credit system.
- **Profile Completeness Dashboard** — shows contractors exactly what fields are missing and what each unlocks (e.g. "Add license number → unlock Verified badge → move up 12 positions in queue").
- **"You Missed X Leads" Nudge** — shown to all contractors including free users. Displays how many leads passed through their trade/area that they were ineligible for, as an incentive to complete their profile and/or upgrade.

## Gotchas

- **Live Stripe Keys**: Avoid triggering Stripe checkout flows during development as live keys are in use and will charge real cards.
- **Supabase ENUM vs. Text**: The live staging DB may have ENUM types where `schema.sql` defines text columns. Always refer to the specified enum values in the `Live DB vs schema.sql Differences` section for consistency.
- **Simulation Environment**: The simulation script `scripts/simulate.mjs` is designed to run in a Coolify host environment and may not function as expected in a Replit development container due to network access restrictions.
- **Simulator is a Separate Tool**: The simulator is being built as a standalone external tool, not bundled with TraydBook. This gives truer end-to-end test results. `server/routes/sim.js` and `scripts/simulate.mjs` can be removed from this repo during a future cleanup pass once the external simulator is fully operational.
- **Admin Panel IP Whitelist**: Remember to configure `ADMIN_ALLOWED_IPS` for the admin panel; leaving it empty allows all IPs.
- **Solana Wallet Setup**: New contractor signups are redirected to `/wallet-setup` before `/feed`.
- **Sim Data Leftovers**: Previous simulation test runs (`scripts/simulate.mjs`) did not fully clean up after themselves — the database may contain leftover fake users, posts, bids, and messages from those runs. Before any production launch, do a manual cleanup pass in Supabase to remove sim-generated records (they typically have generated display names and handle patterns). Consider adding a dedicated cleanup/teardown function to the sim script.

## Pointers

- **Supabase Documentation**: [https://supabase.com/docs](https://supabase.com/docs)
- **React Router v6 Documentation**: [https://reactrouter.com/docs/en/v6](https://reactrouter.com/docs/en/v6)
- **Stripe API Documentation**: [https://stripe.com/docs/api](https://stripe.com/docs/api)
- **Telnyx API Documentation**: [https://developers.telnyx.com/docs](https://developers.telnyx.com/docs)
- **Solana Web3.js Documentation**: [https://solana-web3.readthedocs.io/en/latest/](https://solana-web3.readthedocs.io/en/latest/)
- **Docker Documentation**: [https://docs.docker.com/](https://docs.docker.com/)
- **Vite Documentation**: [https://vitejs.dev/guide/](https://vitejs.dev/guide/)
- **PM2 Documentation**: [https://pm2.keymetrics.io/docs/usage/quick-start/](https://pm2.keymetrics.io/docs/usage/quick-start/)
- **Nginx Documentation**: [https://nginx.org/en/docs/](https://nginx.org/en/docs/)