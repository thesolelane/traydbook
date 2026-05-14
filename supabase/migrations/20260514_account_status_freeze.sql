-- Migration: Account status (freeze / delete) + is_private flag
-- Run in Supabase SQL Editor for both beta and production.

-- Add account_status column if it doesn't exist
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'active'
    CHECK (account_status IN ('active', 'frozen', 'deleted'));

-- Add frozen_at timestamp
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMPTZ;

-- Add is_private flag (hides profile from Explore and public search)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE;

-- Update any existing soft-deleted rows (deleted_at set) to use new status
UPDATE public.users
  SET account_status = 'deleted'
  WHERE deleted_at IS NOT NULL AND account_status = 'active';

-- Optional: index for status queries (admin panel filters)
CREATE INDEX IF NOT EXISTS idx_users_account_status ON public.users (account_status);

-- Confirm columns were added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('account_status', 'frozen_at', 'is_private', 'deleted_at')
ORDER BY column_name;
