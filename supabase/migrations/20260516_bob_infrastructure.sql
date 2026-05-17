-- Migration: Bob / Agent Infrastructure
-- Covers: service API keys, agent logs, leads table, availability windows, Bob control state.
-- Run in Supabase SQL Editor for both beta and production.

-- ============================================================
-- 1. SERVICE API KEYS (Bob auth + future external agents)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.service_api_keys (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT        NOT NULL,                        -- e.g. 'bob-agent', 'admin-dashboard'
  key_hash     TEXT        NOT NULL UNIQUE,                 -- SHA-256 of the raw key — raw key never stored
  key_prefix   TEXT        NOT NULL,                        -- first 8 chars for display e.g. 'trayd_ab'
  scopes       TEXT[]      NOT NULL DEFAULT '{}',           -- e.g. '{leads:read,leads:write,agent:log}'
  created_by   UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  last_used_at TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,
  revoked_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.service_api_keys ENABLE ROW LEVEL SECURITY;
-- Only admins via service role can manage keys — no client-side access
CREATE POLICY "No direct client access to service_api_keys"
  ON public.service_api_keys FOR ALL USING (false);

-- ============================================================
-- 2. AGENT LOGS (Bob writes, admin reads in realtime)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.agent_logs (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_name   TEXT        NOT NULL DEFAULT 'bob',
  action       TEXT        NOT NULL,   -- e.g. 'lead_delivered', 'lead_claimed', 'lead_passed', 'error'
  status       TEXT        NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'warn', 'error')),
  target_type  TEXT,                   -- 'lead', 'contractor', 'rfq', etc.
  target_id    UUID,
  contractor_id UUID       REFERENCES public.users(id) ON DELETE SET NULL,
  payload      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  duration_ms  INTEGER,               -- how long the action took
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.agent_logs ENABLE ROW LEVEL SECURITY;
-- Admins read via service role; no direct client access (admin panel reads via server)
CREATE POLICY "No direct client access to agent_logs"
  ON public.agent_logs FOR ALL USING (false);

CREATE INDEX IF NOT EXISTS idx_agent_logs_created   ON public.agent_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_logs_agent      ON public.agent_logs (agent_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_logs_contractor ON public.agent_logs (contractor_id, created_at DESC);

-- ============================================================
-- 3. LEADS TABLE (distributed leads from RFQs)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.leads (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  rfq_id          UUID        REFERENCES public.rfqs(id) ON DELETE CASCADE,
  contractor_id   UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'claimed', 'passed', 'expired')),
  delivered_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acted_at        TIMESTAMPTZ,         -- when contractor claimed or passed
  expires_at      TIMESTAMPTZ,         -- lead expires if not acted on
  queue_position  INTEGER,             -- position in queue when delivered
  trust_score_at_delivery INTEGER,     -- snapshot of score when lead was sent
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (rfq_id, contractor_id)
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Contractors see their own leads
CREATE POLICY "Contractors see own leads"
  ON public.leads FOR SELECT
  USING (auth.uid() = contractor_id);

CREATE INDEX IF NOT EXISTS idx_leads_contractor ON public.leads (contractor_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_rfq        ON public.leads (rfq_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_status     ON public.leads (status, delivered_at DESC);

-- ============================================================
-- 4. AVAILABILITY WINDOWS (contractor scheduling)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.availability_windows (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  contractor_id UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  day_of_week   INTEGER     CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=Sun, 6=Sat; NULL = specific date
  specific_date DATE,
  start_time    TIME        NOT NULL,
  end_time      TIME        NOT NULL,
  timezone      TEXT        NOT NULL DEFAULT 'America/New_York',
  is_available  BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.availability_windows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contractors manage own availability"
  ON public.availability_windows FOR ALL
  USING (auth.uid() = contractor_id);

CREATE POLICY "Public can read availability"
  ON public.availability_windows FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_availability_contractor
  ON public.availability_windows (contractor_id);

-- ============================================================
-- 5. BOB CONTROL STATE (pause/resume, overrides)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bob_control (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  key          TEXT        NOT NULL UNIQUE,  -- e.g. 'paused', 'ai_provider_override'
  value        TEXT        NOT NULL,
  set_by       UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  reason       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.bob_control ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct client access to bob_control"
  ON public.bob_control FOR ALL USING (false);

-- Seed default control values
INSERT INTO public.bob_control (key, value, reason)
VALUES
  ('paused',               'false',    'Default: Bob is active'),
  ('ai_provider_override', '',         'Empty = use default provider chain'),
  ('lead_refresh_force',   'false',    'Set true to force immediate refresh cycle'),
  ('max_leads_per_cycle',  '10',       'Max leads Bob delivers per cycle')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 6. GRANTS — allow service_role to bypass RLS on these tables
-- ============================================================
GRANT ALL ON public.service_api_keys   TO service_role;
GRANT ALL ON public.agent_logs         TO service_role;
GRANT ALL ON public.leads              TO service_role;
GRANT ALL ON public.availability_windows TO service_role;
GRANT ALL ON public.bob_control        TO service_role;

SELECT 'bob_infrastructure created' AS status;
