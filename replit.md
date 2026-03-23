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
- `src/components/Navbar.tsx` — Main navigation (auth-aware)
- `src/pages/Landing.tsx` — Public landing page
- `src/pages/Login.tsx` — Sign in
- `src/pages/Signup.tsx` — Account type selection
- `src/pages/SignupContractor.tsx` — 3-step contractor onboarding
- `src/pages/SignupOwner.tsx` — 2-step owner/agent/homeowner onboarding
- `src/styles/landing.css` — Landing page styles
- `src/styles/auth.css` — Auth page styles
- `src/index.css` — Global CSS variables + reset
- `supabase/schema.sql` — Full DB schema with RLS policies

## Task Status
- ✅ Task #1: Auth, Database & Routing Foundation — DONE
- ⏳ Task #2: Feed Overhaul (post types, compose, filters)
- ⏳ Task #3: Full Profile System
- ⏳ Task #4: Full Bid Board — RFQ Marketplace
- ⏳ Task #5: Job Board — detail pages, post form & filters
- ⏳ Task #6: Explore, Messages & Notifications
- ⏳ Task #7: Credits, Stripe & Settings
