-- Add joined_user_id + joined_at to outreach_prospects
-- and extend the status CHECK to include 'converted'

ALTER TABLE public.outreach_prospects
  ADD COLUMN IF NOT EXISTS joined_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS joined_at       timestamptz;

-- Extend status constraint to include 'converted'
-- Drop the existing check (name may vary across environments) then re-add it cleanly
DO $$
DECLARE
  c text;
BEGIN
  SELECT conname INTO c
  FROM   pg_constraint
  WHERE  conrelid = 'public.outreach_prospects'::regclass
    AND  contype  = 'c'
    AND  pg_get_constraintdef(oid) LIKE '%status%IN%';
  IF c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.outreach_prospects DROP CONSTRAINT %I', c);
  END IF;
END $$;

ALTER TABLE public.outreach_prospects
  ADD CONSTRAINT outreach_prospects_status_check
  CHECK (status IN ('pending','enriched','drafted','sent','replied','skipped','bounced','converted'));

-- Index for quick lookup of unmatched prospects
CREATE INDEX IF NOT EXISTS idx_prospects_joined_user
  ON public.outreach_prospects (joined_user_id)
  WHERE joined_user_id IS NOT NULL;

-- Seed the scheduler tracking key into platform_settings
INSERT INTO public.platform_settings (key, value, label, description)
VALUES ('last_prospect_match_run', '', 'Last Prospect Match Run',
        'ISO timestamp of the last prospect→user matching scan (7-day auto-schedule)')
ON CONFLICT (key) DO NOTHING;
