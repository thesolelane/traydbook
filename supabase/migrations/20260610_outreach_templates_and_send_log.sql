-- Migration: Patch outreach_templates + outreach_send_log
-- Adds missing columns on top of what migration 037 created.
-- Safe to run after 037 — all statements are IF NOT EXISTS / idempotent.

-- outreach_templates: add body_html (server requires it; 037 only created body_text)
ALTER TABLE public.outreach_templates
  ADD COLUMN IF NOT EXISTS body_html TEXT;

-- outreach_templates: body_text is optional when body_html is supplied
ALTER TABLE public.outreach_templates
  ALTER COLUMN body_text DROP NOT NULL;

-- outreach_send_log: add HTML + plain-text rendered columns (server writes both)
ALTER TABLE public.outreach_send_log
  ADD COLUMN IF NOT EXISTS rendered_body_html TEXT;

ALTER TABLE public.outreach_send_log
  ADD COLUMN IF NOT EXISTS rendered_body_text TEXT;
