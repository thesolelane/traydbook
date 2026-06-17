-- Add contractor_id to bids table.
-- The live DB bids table only has bidder_id (users.id); code in Profile.tsx and
-- database.types.ts expects contractor_id (contractor_profiles.id).
-- This adds the column, backfills existing rows, and indexes it.

ALTER TABLE public.bids
  ADD COLUMN IF NOT EXISTS contractor_id uuid references public.contractor_profiles(id);

-- Backfill: bidder_id (users.id) → contractor_profiles where user_id matches
UPDATE public.bids b
SET contractor_id = cp.id
FROM public.contractor_profiles cp
WHERE cp.user_id = b.bidder_id
  AND b.contractor_id IS NULL;

CREATE INDEX IF NOT EXISTS bids_contractor_id_idx ON public.bids(contractor_id);
