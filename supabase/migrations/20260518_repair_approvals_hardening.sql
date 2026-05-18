-- Migration: Harden repair_approvals for cryptographic SQL binding and one-time use
--
-- Changes:
--   1. sql_hash     — SHA-256 of the canonical (comment-stripped) SQL statement so an
--                     approval code is cryptographically bound to the exact query reviewed.
--   2. expires_at   — TTL for the approval (server sets to createdAt + 1 hour).
--   3. used_at      — Timestamp the code was atomically consumed on execution.
--   4. used_by      — FK to the admin who executed the approved statement.
--   5. status CHECK — Extend allowed values to include 'expired' and 'used'.

-- 1. Add new columns (all nullable so existing rows are unaffected)
ALTER TABLE repair_approvals
  ADD COLUMN IF NOT EXISTS sql_hash    TEXT,
  ADD COLUMN IF NOT EXISTS expires_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS used_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS used_by     UUID REFERENCES auth.users (id) ON DELETE SET NULL;

-- 2. Drop the old status CHECK constraint (if one exists) and replace it with the
--    full set of valid states.  We use a named constraint so it can be targeted safely.
ALTER TABLE repair_approvals
  DROP CONSTRAINT IF EXISTS repair_approvals_status_check;

ALTER TABLE repair_approvals
  ADD CONSTRAINT repair_approvals_status_check
    CHECK (status IN ('pending', 'approved', 'expired', 'used'));

-- 3. Index for the hot path: looking up a pending/approved code at execution time
CREATE INDEX IF NOT EXISTS repair_approvals_code_status_idx
  ON repair_approvals (approval_code, status);

-- 4. Index for the approvals list (ordered by created_at, filtered by status)
CREATE INDEX IF NOT EXISTS repair_approvals_status_created_idx
  ON repair_approvals (status, created_at DESC);
