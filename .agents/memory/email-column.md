---
name: Email column in public.users
description: email IS stored in public.users — schema.sql had a stale comment saying it was omitted.
---

The `email` column exists in `public.users` and has been used since early development (migration `016` inserts it for the admin profile). For a long time `schema.sql` had a comment saying email was "intentionally omitted" — this was wrong and caused confusion.

**Current state (as of migration 030):**
- `email text` is declared in the `CREATE TABLE public.users` block in `schema.sql`
- `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email text` guard also present for older DBs
- Migration `030_email_and_onboarding_complete.sql` back-fills email from `auth.users` for any rows that were missing it
- `onboarding.js` writes `email: req.user.email` (from the verified Supabase JWT) at user creation — this is the canonical write path

**Why both auth.users and public.users:**
Storing email in `public.users` allows the admin panel and server routes to query/search by email in a single DB query without calling `supabaseAdmin.auth.admin.listUsers` (which is slow and paginated). The service-role key bypasses RLS so server-side reads are safe.

**How to apply:**
- Never remove the email column or revert to auth-only — too many routes depend on it
- When writing new onboarding paths (OAuth, staff invite, etc.) always include `email: req.user.email` in the `public.users` insert
- The admin `/api/admin/users` search includes `email.ilike` — keep that in sync if the endpoint is refactored
