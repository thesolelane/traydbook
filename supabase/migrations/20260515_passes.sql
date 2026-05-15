-- Migration: Skip/Pass tracking
-- Records when a contractor explicitly passes on an RFQ, job, or future lead.
-- Run in Supabase SQL Editor for both beta and production.

CREATE TABLE IF NOT EXISTS public.passes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('rfq', 'job', 'lead')),
  target_id   UUID NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, target_type, target_id)
);

ALTER TABLE public.passes ENABLE ROW LEVEL SECURITY;

-- Users can only see and manage their own passes
CREATE POLICY "Users manage own passes"
  ON public.passes FOR ALL
  USING (auth.uid() = user_id);

-- Index for fast lookup when rendering a list of RFQs
CREATE INDEX IF NOT EXISTS idx_passes_user_type
  ON public.passes (user_id, target_type);

-- Confirm
SELECT 'passes table created' AS status;
