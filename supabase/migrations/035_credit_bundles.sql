-- Migration 035: credit_bundles table
-- Replaces the hardcoded BUNDLES array in clients.js with DB-managed bundles.
-- Each bundle maps to a Stripe product + price created via the Admin API.

CREATE TABLE IF NOT EXISTS public.credit_bundles (
  id            uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          text        NOT NULL,
  credits       integer     NOT NULL CHECK (credits > 0),
  price_cents   integer     NOT NULL CHECK (price_cents > 0),
  stripe_price_id   text    UNIQUE,
  stripe_product_id text,
  active        boolean     NOT NULL DEFAULT true,
  sort_order    integer     NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.credit_bundles TO service_role;

CREATE INDEX IF NOT EXISTS credit_bundles_active_idx ON public.credit_bundles(active, sort_order);

-- Seed existing hardcoded bundles so nothing breaks during transition
INSERT INTO public.credit_bundles (name, credits, price_cents, stripe_price_id, stripe_product_id, sort_order)
VALUES
  ('Starter',      25,  900,  'price_1TEMD8CXFkuyP9oE1vVyWb2D', 'prod_UClkf2uXvDLFsN', 0),
  ('Builder',      75,  2400, 'price_1TEMD9CXFkuyP9oEEtINcbiN', 'prod_UClkweiFvm2VPM', 1),
  ('Professional', 200, 5400, 'price_1TEMD9CXFkuyP9oEJKb5PKGL', 'prod_UClkuhQHCsalUv', 2),
  ('Power',        500, 9900, 'price_1TEMDACXFkuyP9oEJxlOr18m', 'prod_UClksIMbwsf3xh', 3)
ON CONFLICT (stripe_price_id) DO NOTHING;
