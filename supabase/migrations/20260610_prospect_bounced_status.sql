-- Migration: Add 'bounced' to outreach_prospects status CHECK constraint
-- When an email bounces, the prospect row is now flipped to 'bounced' automatically
-- so it is excluded from future work-queue and admin review queues.

ALTER TABLE public.outreach_prospects
  DROP CONSTRAINT IF EXISTS outreach_prospects_status_check;

ALTER TABLE public.outreach_prospects
  ADD CONSTRAINT outreach_prospects_status_check
    CHECK (status IN ('pending','enriched','drafted','sent','replied','skipped','bounced'));
