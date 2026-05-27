-- Migration 032: Referral system schema
-- Adds investor + brokerage account types, referral columns on users,
-- referral_signups log table, and a trigger to release held credits
-- automatically when a referrer's balance drops to zero.

-- ── New account types ────────────────────────────────────────────────────────
-- account_type is an ENUM in the live DB.
-- ADD VALUE is idempotent-safe (IF NOT EXISTS requires Postgres 9.6+, which Supabase ships).
ALTER TYPE account_type ADD VALUE IF NOT EXISTS 'investor';
ALTER TYPE account_type ADD VALUE IF NOT EXISTS 'brokerage';

-- ── Referral columns on users ────────────────────────────────────────────────
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referral_code        text UNIQUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referral_credits_held integer NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code_idx
  ON public.users(referral_code) WHERE referral_code IS NOT NULL;

-- ── Referral signups log ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.referral_signups (
  id               uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  referral_code    text        NOT NULL,
  referrer_id      uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  referred_user_id uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  credits_earned   integer     NOT NULL DEFAULT 10,
  held             boolean     NOT NULL DEFAULT false,
  released_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(referred_user_id)  -- each user can only be referred once
);

GRANT ALL ON public.referral_signups TO service_role;

CREATE INDEX IF NOT EXISTS referral_signups_referrer_idx ON public.referral_signups(referrer_id);
CREATE INDEX IF NOT EXISTS referral_signups_code_idx     ON public.referral_signups(referral_code);

-- ── Trigger: release held credits when balance drops to 0 ────────────────────
CREATE OR REPLACE FUNCTION public.release_held_referral_credits()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.credit_balance = 0
     AND OLD.credit_balance > 0
     AND NEW.referral_credits_held > 0
  THEN
    NEW.credit_balance        := NEW.referral_credits_held;
    NEW.referral_credits_held := 0;
    UPDATE public.referral_signups
      SET held = false, released_at = now()
      WHERE referrer_id = NEW.id AND held = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_release_held_referral_credits ON public.users;
CREATE TRIGGER trg_release_held_referral_credits
  BEFORE UPDATE OF credit_balance ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.release_held_referral_credits();
