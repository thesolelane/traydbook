-- Migration: Outreach Unsubscribes (CAN-SPAM / CASL compliance)
-- Tracks email addresses that have opted out of outreach emails.
-- The work-queue skips any prospect whose email_found matches a row here.
--
-- NOTE: email values are always stored lower-cased at the application layer
-- (server/routes/outreach-unsubscribe.js, server/lib/unsubscribe-token.js).
-- The plain UNIQUE constraint on email is what Supabase/Postgres uses for
-- ON CONFLICT (email) in upsert calls.

CREATE TABLE IF NOT EXISTS public.outreach_unsubscribes (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email            TEXT        NOT NULL UNIQUE,
  unsubscribed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source           TEXT        NOT NULL DEFAULT 'email_link'
                               CHECK (source IN ('email_link', 'admin', 'bounce'))
);

-- Fast membership check used by the work-queue
CREATE INDEX IF NOT EXISTS idx_unsubscribes_unsubscribed_at
  ON public.outreach_unsubscribes (unsubscribed_at DESC);
