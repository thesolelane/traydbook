-- Migration: Add rendered_body_text to outreach_send_log
-- Stores the plain-text version of the rendered email body (CAN-SPAM compliance).

ALTER TABLE public.outreach_send_log
  ADD COLUMN IF NOT EXISTS rendered_body_text TEXT;
