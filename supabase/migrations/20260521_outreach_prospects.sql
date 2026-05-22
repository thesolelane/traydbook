-- Migration: Outreach Prospects
-- Stores imported leads (contractors, real estate agents) for Bob outreach

CREATE TABLE IF NOT EXISTS public.outreach_prospects (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_type       TEXT        NOT NULL DEFAULT 'contractor'
                                  CHECK (prospect_type IN ('contractor', 'real_estate_agent', 'other')),

  -- From CSV (contractor license records)
  board_code          TEXT,
  type_class          TEXT,
  business_name       TEXT,
  first_name          TEXT,
  middle_initial      TEXT,
  last_name           TEXT,
  general_type        TEXT,
  address1            TEXT,
  address2            TEXT,
  city                TEXT,
  state               TEXT,
  zip_code            TEXT,
  license_number      TEXT,
  license_issued      DATE,
  license_expiration  DATE,
  status_description  TEXT,

  -- Enrichment by Bob
  email_found         TEXT,
  phone_found         TEXT,
  enrichment_source   TEXT,
  enrichment_notes    TEXT,
  enriched_at         TIMESTAMPTZ,

  -- Outreach tracking
  email_subject       TEXT,
  email_body          TEXT,
  drafted_at          TIMESTAMPTZ,
  sent_at             TIMESTAMPTZ,
  replied_at          TIMESTAMPTZ,
  reply_notes         TEXT,

  -- Status pipeline
  status              TEXT        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending','enriched','drafted','sent','replied','skipped')),
  skip_reason         TEXT,
  bob_notes           TEXT,

  -- Import metadata
  import_batch        TEXT,
  imported_by         UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Deduplicate by license number per type
  UNIQUE (license_number, prospect_type)
);

CREATE INDEX IF NOT EXISTS idx_prospects_status   ON public.outreach_prospects(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prospects_type     ON public.outreach_prospects(prospect_type, status);
CREATE INDEX IF NOT EXISTS idx_prospects_batch    ON public.outreach_prospects(import_batch);
CREATE INDEX IF NOT EXISTS idx_prospects_state    ON public.outreach_prospects(state, city);
