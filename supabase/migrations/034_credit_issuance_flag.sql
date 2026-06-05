-- Migration 034: credit_issuance_enabled flag + held purchase status

-- Add credit_issuance_enabled platform flag (master kill switch)
INSERT INTO public.platform_settings (key, value, label, description)
VALUES (
  'credit_issuance_enabled',
  'true',
  'Credit Issuance',
  'Master switch — when OFF, Stripe webhook holds credits instead of issuing them (emergency use only)'
)
ON CONFLICT (key) DO NOTHING;

-- Extend purchases status to include 'held'
-- (held = payment taken but credit_issuance_enabled was false at webhook time)
-- Live DB uses a purchase_status ENUM; use ALTER TYPE to add the value safely.
-- The IF NOT EXISTS guard prevents errors on re-runs.
DO $$
BEGIN
  -- Try ENUM path first (live DB)
  IF EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'purchase_status'
  ) THEN
    ALTER TYPE purchase_status ADD VALUE IF NOT EXISTS 'held';
  ELSE
    -- Text column with CHECK constraint path (schema.sql / fresh DBs)
    ALTER TABLE public.purchases DROP CONSTRAINT IF EXISTS purchases_status_check;
    ALTER TABLE public.purchases ADD CONSTRAINT purchases_status_check
      CHECK (status IN ('pending', 'completed', 'failed', 'held'));
  END IF;
END $$;
