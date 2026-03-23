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

## Task Status
- ✅ Task #1: Auth, Database & Routing Foundation — DONE
- ✅ Task #2: Feed Overhaul (post types, compose, filters) — DONE
- ✅ Task #3: Full Profile System — DONE
- ✅ Task #4: Full Bid Board — RFQ Marketplace — DONE
- ✅ Task #5: Job Board — detail pages, post form & filters — DONE
- ✅ Task #6: Explore, Messages & Notifications — DONE
- ✅ Task #7: Credits, Stripe & Settings — DONE
- ✅ Task #8: Social Login + Verified Badge System — DONE
