-- Migration: Lead Bank Balance
-- Separate from the general credit system.
-- Tracks a per-contractor lead allocation balance and a full audit ledger.
-- Run in Supabase SQL Editor for both beta and production.

-- 1. Balance column on contractor_profiles
ALTER TABLE public.contractor_profiles
  ADD COLUMN IF NOT EXISTS lead_bank_balance INTEGER NOT NULL DEFAULT 0;

-- 2. Audit ledger
CREATE TABLE IF NOT EXISTS public.lead_bank_ledger (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  delta         INTEGER     NOT NULL,              -- positive = credit, negative = debit
  balance_after INTEGER     NOT NULL,
  reason        TEXT        NOT NULL,              -- e.g. 'manual_grant', 'lead_claimed', 'lead_returned'
  created_by    UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.lead_bank_ledger ENABLE ROW LEVEL SECURITY;

-- Contractors can read their own ledger; admins manage via service role
CREATE POLICY "Users see own lead bank ledger"
  ON public.lead_bank_ledger FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_lead_bank_ledger_user
  ON public.lead_bank_ledger (user_id, created_at DESC);

-- 3. Atomic adjust function (used by server-side service role only)
CREATE OR REPLACE FUNCTION public.adjust_lead_bank(
  p_user_id   UUID,
  p_delta     INTEGER,
  p_reason    TEXT,
  p_by        UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  UPDATE public.contractor_profiles
  SET lead_bank_balance = GREATEST(0, lead_bank_balance + p_delta)
  WHERE user_id = p_user_id
  RETURNING lead_bank_balance INTO v_new_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contractor profile not found for user %', p_user_id;
  END IF;

  INSERT INTO public.lead_bank_ledger (user_id, delta, balance_after, reason, created_by)
  VALUES (p_user_id, p_delta, v_new_balance, p_reason, p_by);

  RETURN v_new_balance;
END;
$$;

-- Confirm
SELECT 'lead_bank tables created' AS status;
