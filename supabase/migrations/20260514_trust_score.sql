-- Migration: Trust Score system
-- Run in Supabase SQL Editor for both beta and production.

-- 1. Add trust_score column to contractor_profiles
ALTER TABLE public.contractor_profiles
  ADD COLUMN IF NOT EXISTS trust_score INTEGER NOT NULL DEFAULT 0
    CHECK (trust_score BETWEEN 0 AND 100);

ALTER TABLE public.contractor_profiles
  ADD COLUMN IF NOT EXISTS trust_score_updated_at TIMESTAMPTZ;

-- 2. Trust Score calculation function
-- Scoring breakdown (max 100):
--   Avatar present          : 10 pts
--   Bio >= 20 chars         : 10 pts
--   Years experience > 0    : 5 pts
--   Secondary trades or
--    custom service radius  : 5 pts
--   Active credential       : 20 pts
--   Badge tier vouched      : 10 pts
--   Badge tier licensed     : 15 pts
--   Badge tier pro_verified : 20 pts
--   Rating >= 3.5 (1+ rev)  : 5 pts
--   Rating >= 4.0 (3+ rev)  : 5 pts bonus
--   Rating >= 4.5 (5+ rev)  : 5 pts bonus
--   Projects >= 1           : 5 pts
--   Projects >= 5           : 5 pts bonus
--   Projects >= 20          : 5 pts bonus

CREATE OR REPLACE FUNCTION public.recalculate_trust_score(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_score       INTEGER := 0;
  v_cp          public.contractor_profiles%ROWTYPE;
  v_avatar      TEXT;
  v_has_cred    BOOLEAN := FALSE;
BEGIN
  SELECT * INTO v_cp FROM public.contractor_profiles WHERE user_id = p_user_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  SELECT avatar_url INTO v_avatar FROM public.users WHERE id = p_user_id;

  -- Avatar
  IF v_avatar IS NOT NULL AND v_avatar <> '' THEN
    v_score := v_score + 10;
  END IF;

  -- Bio
  IF v_cp.bio IS NOT NULL AND LENGTH(TRIM(v_cp.bio)) >= 20 THEN
    v_score := v_score + 10;
  END IF;

  -- Years experience
  IF v_cp.years_experience > 0 THEN
    v_score := v_score + 5;
  END IF;

  -- Secondary trades or custom service radius
  IF (v_cp.secondary_trades IS NOT NULL AND array_length(v_cp.secondary_trades, 1) > 0)
     OR v_cp.service_radius_miles <> 50 THEN
    v_score := v_score + 5;
  END IF;

  -- Active verified credential
  SELECT EXISTS(
    SELECT 1 FROM public.credentials
    WHERE contractor_id = v_cp.id
      AND status = 'active'
      AND verified_at IS NOT NULL
  ) INTO v_has_cred;
  IF v_has_cred THEN
    v_score := v_score + 20;
  END IF;

  -- Badge tier (mutually exclusive, take highest)
  IF v_cp.badge_tier = 'pro_verified' THEN
    v_score := v_score + 20;
  ELSIF v_cp.badge_tier = 'licensed' THEN
    v_score := v_score + 15;
  ELSIF v_cp.badge_tier = 'vouched' THEN
    v_score := v_score + 10;
  END IF;

  -- Rating
  IF v_cp.rating_avg >= 3.5 AND v_cp.rating_count >= 1 THEN
    v_score := v_score + 5;
  END IF;
  IF v_cp.rating_avg >= 4.0 AND v_cp.rating_count >= 3 THEN
    v_score := v_score + 5;
  END IF;
  IF v_cp.rating_avg >= 4.5 AND v_cp.rating_count >= 5 THEN
    v_score := v_score + 5;
  END IF;

  -- Projects completed
  IF v_cp.projects_completed >= 1  THEN v_score := v_score + 5; END IF;
  IF v_cp.projects_completed >= 5  THEN v_score := v_score + 5; END IF;
  IF v_cp.projects_completed >= 20 THEN v_score := v_score + 5; END IF;

  RETURN LEAST(v_score, 100);
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger function — fires after any contractor_profiles update
CREATE OR REPLACE FUNCTION public.trigger_recalculate_trust_score()
RETURNS TRIGGER AS $$
BEGIN
  NEW.trust_score := public.recalculate_trust_score(NEW.user_id);
  NEW.trust_score_updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Attach trigger to contractor_profiles
DROP TRIGGER IF EXISTS tg_trust_score_update ON public.contractor_profiles;
CREATE TRIGGER tg_trust_score_update
  BEFORE UPDATE ON public.contractor_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_recalculate_trust_score();

-- 5. Back-fill trust scores for all existing contractors
UPDATE public.contractor_profiles
SET
  trust_score = public.recalculate_trust_score(user_id),
  trust_score_updated_at = NOW();

-- 6. Confirm results
SELECT
  u.display_name,
  cp.primary_trade,
  cp.badge_tier,
  cp.trust_score,
  cp.trust_score_updated_at
FROM public.contractor_profiles cp
JOIN public.users u ON u.id = cp.user_id
ORDER BY cp.trust_score DESC
LIMIT 20;
