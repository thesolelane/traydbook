# TraydBook

The professional network for the construction trades. Contractors, tradespeople, and design professionals can post work, find jobs, submit bids, and build verified reputations.

## Brand Identity
- **Name**: TraydBook — wordmark split as "Trayd" (bone white `#F0ECE6`) + "Book" (orange `#E85D04`)
- **Logo**: Stacked pages SVG icon on orange background
- **Theme**: Dark — Forge black `#141416` background, Steel surface `#22252A` cards
- **Fonts**: Barlow Condensed (headings, labels, UI) + Barlow (body text)
- **Brand color**: `#E85D04` (orange), press state `#C44D00`
- **Text colors**: Bone white `#F0ECE6`, Dust gray `#9D9990`, `#5A5750` for muted
- **Borders**: `#2E3033`

## Architecture
- **Frontend**: React 18 + TypeScript + Vite (port 5000)
- **Backend**: Supabase (auth + database)
- **Styling**: Pure CSS custom properties, no CSS framework
- **Routing**: React Router v6

## Supabase Config
- **URL**: `https://tpwrpezsvclzblktgjli.supabase.co`
- **Anon key**: stored as `VITE_SUPABASE_ANON_KEY` env var
- **JWT secret**: stored as `SUPABASE_JWT_SECRET`
- **DB password**: stored as `SUPABASE_DB_PASSWORD`
- **Schema**: `supabase/schema.sql` — run this in Supabase SQL Editor to create all tables

## User Types
- **Contractor / Tradesperson** — free always, full access
- **Design Professional** — free always, full access
- **Project Owner** — credit-based (50 welcome credits)
- **Real Estate Agent** — credit-based
- **Homeowner** — credit-based

## Credit Costs
- Post RFQ: 10 credits
- Post job (non-contractor): 8 credits
- Cold message contractor: 3 credits
- Request contact info: 5 credits
- Boost listing: 15 credits

## Key Files
- `src/lib/supabase.ts` — Supabase client
- `src/lib/database.types.ts` — TypeScript DB types
- `src/context/AuthContext.tsx` — Auth state & helpers
- `src/components/ProtectedRoute.tsx` — Route guard
- `src/components/Navbar.tsx` — Main navigation (auth-aware, live unread dots for messages + notifications)
- `src/types/feed.ts` — FeedPost, POST_TYPE_BADGE, FilterOption, SidebarUser types
- `src/pages/Feed.tsx` — Main feed (Supabase data + filter + compose + sidebars)
- `src/components/PostCard.tsx` — Post card with type badge, inline comments, likes
- `src/components/FeedFilterBar.tsx` — Filter pill bar (URL-synced)
- `src/components/ComposeModal.tsx` — Compose modal with 4 post type flows
- `src/components/ReferModal.tsx` — Contractor search + referral post flow
- `src/pages/Explore.tsx` — Contractor discovery (/explore): search, filter sidebar, contractor cards, connect/message
- `src/pages/Messages.tsx` — Messages inbox (/messages): thread list with unread indicators + Realtime
- `src/pages/MessageThread.tsx` — Thread view (/messages/:threadId): chronological messages, send, credit gate, Realtime
- `src/pages/Notifications.tsx` — Notifications (/notifications): grouped Today/Week/Earlier, mark-all-read on load
- `src/pages/Landing.tsx` — Public landing page
- `src/pages/Login.tsx` — Sign in
- `src/pages/Signup.tsx` — Account type selection
- `src/pages/SignupContractor.tsx` — 3-step contractor onboarding
- `src/pages/SignupOwner.tsx` — 2-step owner/agent/homeowner onboarding
- `src/styles/feed.css` — Feed-specific styles (skeleton, compose trigger, spin)
- `src/styles/landing.css` — Landing page styles
- `src/styles/auth.css` — Auth page styles
- `src/index.css` — Global CSS variables + reset
- `supabase/schema.sql` — Full DB schema with RLS policies + RPCs (send_message, send_connection_request)
- `supabase/migrations/008_badge_system.sql` — Migration for badge_tier + vouches table
- `supabase/migrations/009_storage_avatars.sql` — Migration for avatars storage bucket + policies
- `supabase/migrations/010_social_links.sql` — Migration for social_links JSONB column on users

## Social Login
- Google, Apple, LinkedIn OAuth via Supabase (requires enabling in Supabase dashboard)
- New OAuth users without a profile are redirected to `/onboarding` (pick account type, confirm name, choose trade if contractor)
- `src/pages/OAuthCallback.tsx` — handles OAuth redirect and routes to feed or onboarding
- `src/pages/Onboarding.tsx` — multi-step onboarding for new OAuth users
- `src/components/SocialAuthButtons.tsx` — shared social auth button component (Login + Signup pages)

## Verified Badge System
Three badge tiers for contractors:
- `pro_verified` — license + GL insurance + workers' comp (all verified) — orange badge
- `licensed` — contractor license verified — blue badge
- `vouched` — endorsed by a Pro Verified contractor — green badge

Badge is stored on `contractor_profiles.badge_tier`. Updated by admin or database trigger.
Contractors submit credentials (license, GL, WC) in Settings → "Verification & Badges".
Pro Verified contractors can vouch for others via the Vouch button on their profiles.
`src/components/VerifiedBadge.tsx` — badge display component (used on Profile, Explore cards)

## Post Types
- `project_update` → blue badge "Project Update"
- `bid_post` → orange badge "Open Bid"
- `job_post` + is_urgent → red badge "Urgent Hire"
- `trade_tip` → green badge "Trade Tip"
- `safety_alert` → yellow badge "Safety Alert"
- `referral` → purple badge "Referral"

## Stripe
- **Keys**: LIVE keys in use (`sk_live_...`) — real payments are charged
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` stored as Replit secrets
- **Email**: `customer_email` passed to Stripe checkout — Stripe automatically sends a payment receipt to this address after purchase
- **Webhook**: Must be registered in the Stripe dashboard under Developers → Webhooks
  - Dev (Replit): point to `https://<replit-dev-domain>/api/webhooks/stripe`
  - Production (own server): point to `https://yourdomain.com/api/webhooks/stripe`
  - Each environment needs its own webhook endpoint + its own `STRIPE_WEBHOOK_SECRET`
  - Listen for: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
- **Seed script**: `scripts/seed-stripe-products.js` — run once to create/update products in Stripe (idempotent, safe to re-run)

### Live Stripe Products & Prices

**One-time credit bundles** (`mode: 'payment'`)
| Bundle       | Credits | Price | Stripe Price ID                        | Stripe Product ID      |
|---|---|---|---|---|
| Starter      | 25 cr   | $9    | `price_1TEMD8CXFkuyP9oE1vVyWb2D`     | `prod_UClkf2uXvDLFsN` |
| Builder      | 75 cr   | $24   | `price_1TEMD9CXFkuyP9oEEtINcbiN`     | `prod_UClkweiFvm2VPM` |
| Professional | 200 cr  | $54   | `price_1TEMD9CXFkuyP9oEJKb5PKGL`     | `prod_UClkuhQHCsalUv` |
| Power        | 500 cr  | $99   | `price_1TEMDACXFkuyP9oEJxlOr18m`     | `prod_UClksIMbwsf3xh` |

**Monthly subscriptions** (`mode: 'subscription'`)
| Plan        | Price      | Stripe Price ID                    | Stripe Product ID      |
|---|---|---|---|
| SMS Alerts  | $1.99/mo   | `price_1TEMF1CXFkuyP9oESpMHcTBR`  | `prod_UClmMWnPYp7C78` |

- ⚠️ Since live keys are active in Replit, avoid triggering the checkout flow during development — it will charge real cards

## Deployment
All deployment files live in `deploy/` and must be updated as the app evolves (new env vars, new services, etc.):
- `deploy/UBUNTU_SETUP.md` — full Ubuntu 22.04 server setup guide (Node, PM2, Nginx, SSL)
- `deploy/WINDOWS_SETUP.md` — full Windows Server setup guide (same stack, Windows paths)
- `deploy/deploy.sh` — one-command Linux deploy script (git pull → build → PM2 reload)
- `deploy/deploy.ps1` — one-command Windows deploy script (PowerShell)
- `deploy/nginx.conf` — Nginx config for Ubuntu (static SPA + /api proxy + SSL-ready)
- `deploy/nginx-windows.conf` — same config for Windows paths
- `deploy/ecosystem.config.js` — PM2 process config (auto-restart, log paths)
- `deploy/.env.example` — template of every env var the server needs

### Deployment roadmap
1. **Now**: Replit (development + active builds)
2. **Beta**: Local Ubuntu or Windows server — run `deploy.sh` or `deploy.ps1` after each push
3. **Production**: Hetzner (or equivalent non-US VPS) — same scripts, live domain + SSL via Let's Encrypt

### Required env vars on any server
```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY          ← live key
STRIPE_WEBHOOK_SECRET      ← from Stripe dashboard for that server's webhook URL
APP_ORIGIN                 ← https://yourdomain.com (controls Stripe redirect URLs)
NODE_ENV=production
```

## Task Status
- ✅ Task #1: Auth, Database & Routing Foundation — DONE
- ✅ Task #2: Feed Overhaul (post types, compose, filters) — DONE
- ✅ Task #3: Full Profile System — DONE
- ✅ Task #4: Full Bid Board — RFQ Marketplace — DONE
- ✅ Task #5: Job Board — detail pages, post form & filters — DONE
- ✅ Task #6: Explore, Messages & Notifications — DONE
- ✅ Task #7: Credits, Stripe & Settings — DONE
- ✅ Task #8: Social Login + Verified Badge System — DONE
- ✅ Task #8 (Profile Polish): Social Links & Avatar Validation — DONE
- 🔄 Task #9: SMS Message Alerts (Telnyx, two-tier subscription) — IN PROGRESS
