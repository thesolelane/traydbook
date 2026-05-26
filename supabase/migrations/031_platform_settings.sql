-- Migration 031: platform_settings key/value store for feature flags
-- Pattern mirrors bob_control table.

CREATE TABLE IF NOT EXISTS public.platform_settings (
  key        text PRIMARY KEY,
  value      text NOT NULL DEFAULT 'false',
  label      text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL
);

GRANT ALL ON public.platform_settings TO service_role;

-- Seed default flags
INSERT INTO public.platform_settings (key, value, label, description) VALUES
  ('maintenance_mode',       'false', 'Maintenance Mode',       'Show maintenance page to non-admin visitors'),
  ('new_feed_algo',          'false', 'New Feed Algorithm',     'Enable experimental feed ranking'),
  ('crypto_payments',        'false', 'Crypto Payments',        'Allow Solana-based credit purchases'),
  ('referral_system_enabled','false', 'Referral System',        'Enable investor & homeowner referral programme (launch with app.traydbook.com)')
ON CONFLICT (key) DO NOTHING;
