-- Migration 036: Harden referral credit release trigger
--
-- The original trigger (032) only fires when credit_balance drops to EXACTLY 0.
-- This revision fires when balance drops to <= 0 (catches any edge-case overdraft)
-- and adds an immediate backfill for users already sitting at 0 with held credits.

-- ── Recreate trigger function with <= 0 condition ─────────────────────────────
CREATE OR REPLACE FUNCTION public.release_held_referral_credits()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.credit_balance <= 0
     AND OLD.credit_balance > 0
     AND NEW.referral_credits_held > 0
  THEN
    -- Release held credits and zero out the held column
    NEW.credit_balance        := NEW.referral_credits_held;
    NEW.referral_credits_held := 0;
    -- Mark signups as released
    UPDATE public.referral_signups
      SET held = false, released_at = now()
      WHERE referrer_id = NEW.id AND held = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger (drop first to reset)
DROP TRIGGER IF EXISTS trg_release_held_referral_credits ON public.users;
CREATE TRIGGER trg_release_held_referral_credits
  BEFORE UPDATE OF credit_balance ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.release_held_referral_credits();

-- ── Immediate backfill ────────────────────────────────────────────────────────
-- Release held credits for users already at credit_balance = 0.
-- Does NOT modify users who already spent credits (they will be caught next spend).
UPDATE public.users
SET
  credit_balance        = referral_credits_held,
  referral_credits_held = 0
WHERE credit_balance = 0
  AND referral_credits_held > 0;

-- Mark the corresponding signup rows as released too
UPDATE public.referral_signups rs
SET held = false, released_at = now()
WHERE rs.held = true
  AND NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = rs.referrer_id AND u.referral_credits_held > 0
  );
