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

-- Extend purchases status constraint to include 'held'
-- (held = payment taken but credit_issuance_enabled was false at webhook time)
ALTER TABLE public.purchases
  DROP CONSTRAINT IF EXISTS purchases_status_check;

ALTER TABLE public.purchases
  ADD CONSTRAINT purchases_status_check
  CHECK (status IN ('pending', 'completed', 'failed', 'held'));
