-- Migration: Trust Score system
-- Run in Supabase SQL Editor for both beta and production.

-- 0. Ensure all contractor_profiles columns exist in the live DB
ALTER TABLE public.contractor_profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.contractor_profiles ADD COLUMN IF NOT EXISTS business_name TEXT;
ALTER TABLE public.contractor_profiles ADD COLUMN IF NOT EXISTS years_experience INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.contractor_profiles ADD COLUMN IF NOT EXISTS secondary_trades TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.contractor_profiles ADD COLUMN IF NOT EXISTS service_radius_miles INTEGER NOT NULL DEFAULT 50;
ALTER TABLE public.contractor_profiles ADD COLUMN IF NOT EXISTS rating_avg NUMERIC(3,2) NOT NULL DEFAULT 0;
ALTER TABLE public.contractor_profiles ADD COLUMN IF NOT EXISTS rating_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.contractor_profiles ADD COLUMN IF NOT EXISTS projects_completed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.contractor_profiles ADD COLUMN IF NOT EXISTS badge_tier TEXT
  CHECK (badge_tier IN ('pro_verified','licensed','vouched'));

-- 1. Add trust_score columns
ALTER TABLE public.contractor_profiles
  ADD COLUMN IF NOT EXISTS trust_score INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.contractor_profiles
  ADD COLUMN IF NOT EXISTS trust_score_updated_at TIMESTAMPTZ;

-- 2. Trust Score calculation function (uses explicit SELECT, no %ROWTYPE)
-- Scoring breakdown (max 100):
--   Avatar present          : 10 pts
--   Bio >= 20 chars         : 10 pts
--   Years experience > 0    : 5 pts
--   Secondary trades or
--    custom service radius  : 5 pts
--   Active credential       : 20 pts
--   Badge vouched           : 10 pts
--   Badge licensed          : 15 pts
--   Badge pro_verified      : 20 pts
--   Rating >= 3.5 (1+ rev)  : 5 pts
--   Rating >= 4.0 (3+ rev)  : 5 pts bonus
--   Rating >= 4.5 (5+ rev)  : 5 pts bonus
--   Projects >= 1           : 5 pts
--   Projects >= 5           : 5 pts bonus
--   Projects >= 20          : 5 pts bonus

CREATE OR REPLACE FUNCTION public.recalculate_trust_score(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_score            INTEGER := 0;
  v_cp_id            UUID;
  v_bio              TEXT;
  v_years_exp        INTEGER;
  v_sec_trades       TEXT[];
  v_radius           INTEGER;
  v_rating_avg       NUMERIC;
  v_rating_count     INTEGER;
  v_projects         INTEGER;
  v_badge_tier       TEXT;
  v_avatar           TEXT;
  v_has_cred         BOOLEAN := FALSE;
BEGIN
  -- Fetch contractor profile fields individually
  SELECT
    id, bio, years_experience, secondary_trades,
    service_radius_miles, rating_avg, rating_count,
    projects_completed, badge_tier
  INTO
    v_cp_id, v_bio, v_years_exp, v_sec_trades,
    v_radius, v_rating_avg, v_rating_count,
    v_projects, v_badge_tier
  FROM public.contractor_profiles
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN RETURN 0; END IF;

  -- Fetch avatar from users
  SELECT avatar_url INTO v_avatar
  FROM public.users WHERE id = p_user_id;

  -- Avatar (10 pts)
  IF v_avatar IS NOT NULL AND v_avatar <> '' THEN
    v_score := v_score + 10;
  END IF;

  -- Bio (10 pts)
  IF v_bio IS NOT NULL AND LENGTH(TRIM(v_bio)) >= 20 THEN
    v_score := v_score + 10;
  END IF;

  -- Years experience (5 pts)
  IF v_years_exp IS NOT NULL AND v_years_exp > 0 THEN
    v_score := v_score + 5;
  END IF;

  -- Secondary trades or custom service radius (5 pts)
  IF (v_sec_trades IS NOT NULL AND array_length(v_sec_trades, 1) > 0)
     OR (v_radius IS NOT NULL AND v_radius <> 50) THEN
    v_score := v_score + 5;
  END IF;

  -- Active verified credential (20 pts)
  SELECT EXISTS(
    SELECT 1 FROM public.credentials
    WHERE contractor_id = v_cp_id
      AND status = 'active'
      AND verified_at IS NOT NULL
  ) INTO v_has_cred;
  IF v_has_cred THEN
    v_score := v_score + 20;
  END IF;

  -- Badge tier (mutually exclusive — take highest)
  IF v_badge_tier = 'pro_verified' THEN
    v_score := v_score + 20;
  ELSIF v_badge_tier = 'licensed' THEN
    v_score := v_score + 15;
  ELSIF v_badge_tier = 'vouched' THEN
    v_score := v_score + 10;
  END IF;

  -- Rating
  IF v_rating_avg >= 3.5 AND v_rating_count >= 1 THEN v_score := v_score + 5; END IF;
  IF v_rating_avg >= 4.0 AND v_rating_count >= 3 THEN v_score := v_score + 5; END IF;
  IF v_rating_avg >= 4.5 AND v_rating_count >= 5 THEN v_score := v_score + 5; END IF;

  -- Projects completed
  IF v_projects >= 1  THEN v_score := v_score + 5; END IF;
  IF v_projects >= 5  THEN v_score := v_score + 5; END IF;
  IF v_projects >= 20 THEN v_score := v_score + 5; END IF;

  RETURN LEAST(v_score, 100);
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger function
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
