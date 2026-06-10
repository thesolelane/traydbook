-- Migration: Add partial index to efficiently serve Bob's outreach work queue.
--
-- The work-queue query always filters status = 'enriched' and orders by created_at ASC.
-- A partial index scoped to status = 'enriched' lets Postgres satisfy the entire
-- query (filter + sort) without touching bounced, skipped, sent, or any other
-- status rows — making the exclusion efficient at scale as the non-enriched
-- population grows.
--
-- The existing idx_prospects_status (status, created_at DESC) remains useful for
-- the stats/admin list queries that scan across multiple status values.

CREATE INDEX IF NOT EXISTS idx_prospects_work_queue
  ON public.outreach_prospects (created_at ASC)
  WHERE status = 'enriched';
