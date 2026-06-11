-- Add person_key for cross-license deduplication
-- person_key = lower(first_name) | lower(last_name) | zip_code
-- Two rows with the same person_key are the same human.

ALTER TABLE outreach_prospects
  ADD COLUMN IF NOT EXISTS person_key varchar;

-- Index for fast GROUP BY / dedup lookups
CREATE INDEX IF NOT EXISTS idx_outreach_prospects_person_key
  ON outreach_prospects (person_key);

-- Backfill existing rows
UPDATE outreach_prospects
SET person_key = LOWER(COALESCE(first_name, ''))
               || '|'
               || LOWER(COALESCE(last_name, ''))
               || '|'
               || COALESCE(zip_code, '')
WHERE person_key IS NULL;
