-- Migration: Referral / UTM tracking on users
-- Captures the source that brought each user to TraydBook (Marbalism outreach, organic, etc.)

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS referral_source  TEXT,        -- e.g. 'marbalism', 'organic', 'bob-outreach'
  ADD COLUMN IF NOT EXISTS utm_params       JSONB,       -- full UTM payload: source, medium, campaign, content, term
  ADD COLUMN IF NOT EXISTS referral_code    TEXT,        -- specific ref= code from the URL
  ADD COLUMN IF NOT EXISTS referred_at      TIMESTAMPTZ; -- when they landed (may differ from created_at)

CREATE INDEX IF NOT EXISTS idx_users_referral_source ON public.users (referral_source);
CREATE INDEX IF NOT EXISTS idx_users_referral_code   ON public.users (referral_code);

SELECT 'referral_tracking added' AS status;
