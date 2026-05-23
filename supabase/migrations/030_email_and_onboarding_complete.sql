-- Migration 030: Formalise email + onboarding_complete columns on public.users
-- Both columns were already used in code and migration 016, but were never
-- formally declared in schema.sql. This migration ensures any database that
-- predates the formalisation has both columns present.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email               text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS onboarding_complete boolean NOT NULL DEFAULT false;

-- Back-fill email from auth.users for any rows that are missing it.
-- (Safe to run multiple times — only updates rows where email IS NULL.)
UPDATE public.users u
SET email = a.email
FROM auth.users a
WHERE u.id = a.id
  AND u.email IS NULL
  AND a.email IS NOT NULL;
