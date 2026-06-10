-- Migration: Add delivery_events to outreach_send_log
-- Enables Bob to report back delivery status updates (bounces, opens, clicks)

-- Extend delivery_status to include open/click tracking states
ALTER TABLE public.outreach_send_log
  DROP CONSTRAINT IF EXISTS outreach_send_log_delivery_status_check;

ALTER TABLE public.outreach_send_log
  ADD CONSTRAINT outreach_send_log_delivery_status_check
    CHECK (delivery_status IN ('sent', 'delivered', 'bounced', 'failed', 'opened', 'clicked'));

-- Append-only event log: [{type, timestamp, metadata?}, ...]
ALTER TABLE public.outreach_send_log
  ADD COLUMN IF NOT EXISTS delivery_events JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Track when the record was last touched by a delivery callback
ALTER TABLE public.outreach_send_log
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_send_log_delivery_status ON public.outreach_send_log(delivery_status);
