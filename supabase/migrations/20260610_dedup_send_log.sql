-- Migration: Prevent duplicate sends — unique constraint on outreach_send_log.prospect_id
-- Ensures each prospect can only appear once in the send log.
-- A second INSERT for the same prospect_id will fail with a unique-violation error,
-- making duplicate sends loud and catchable rather than silent.

ALTER TABLE public.outreach_send_log
  ADD CONSTRAINT outreach_send_log_prospect_id_unique UNIQUE (prospect_id);
