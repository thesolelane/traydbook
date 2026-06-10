-- Migration: Outreach Email Templates & Send Log
-- Enables Bob to autonomously pick a pre-approved template, fill merge tags, send, and log

CREATE TABLE IF NOT EXISTS public.outreach_templates (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  prospect_type TEXT        NOT NULL DEFAULT 'contractor'
                            CHECK (prospect_type IN ('contractor', 'real_estate_agent')),
  subject       TEXT        NOT NULL,
  body_html     TEXT        NOT NULL,
  body_text     TEXT,
  status        TEXT        NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft', 'approved', 'paused')),
  created_by    UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_templates_status_type ON public.outreach_templates(status, prospect_type);

-- Send log: one row per outbound email Bob sends
CREATE TABLE IF NOT EXISTS public.outreach_send_log (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id       UUID        NOT NULL REFERENCES public.outreach_prospects(id) ON DELETE CASCADE,
  template_id       UUID        NOT NULL REFERENCES public.outreach_templates(id) ON DELETE RESTRICT,
  rendered_subject  TEXT        NOT NULL,
  rendered_body_html TEXT       NOT NULL,
  delivery_status   TEXT        NOT NULL DEFAULT 'sent'
                                CHECK (delivery_status IN ('sent', 'delivered', 'bounced', 'failed')),
  bob_job_id        TEXT,
  sent_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_send_log_prospect   ON public.outreach_send_log(prospect_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_send_log_template   ON public.outreach_send_log(template_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_send_log_sent_at    ON public.outreach_send_log(sent_at DESC);
