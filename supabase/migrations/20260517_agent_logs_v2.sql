-- Migration: Align agent_logs with Bob's exact contract
-- Adds missing columns, fixes target_id type, updates status values, adds indexes.

-- Add missing columns
ALTER TABLE public.agent_logs
  ADD COLUMN IF NOT EXISTS message      TEXT,
  ADD COLUMN IF NOT EXISTS ai_provider  TEXT,
  ADD COLUMN IF NOT EXISTS metadata     JSONB NOT NULL DEFAULT '{}'::jsonb;

-- target_id needs to be TEXT not UUID (Bob uses string IDs, not always UUIDs)
ALTER TABLE public.agent_logs
  ALTER COLUMN target_id TYPE TEXT USING target_id::text;

-- Drop old status check and replace with Bob's vocabulary
ALTER TABLE public.agent_logs
  DROP CONSTRAINT IF EXISTS agent_logs_status_check;

ALTER TABLE public.agent_logs
  ADD CONSTRAINT agent_logs_status_check
  CHECK (status IN ('success','failure','skipped','ok','warn','error'));

-- Add index on (target_type, target_id) as Bob's contract requires
CREATE INDEX IF NOT EXISTS idx_agent_logs_target
  ON public.agent_logs (target_type, target_id);

SELECT 'agent_logs_v2 applied' AS status;
