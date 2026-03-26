-- Migration 018: Staff roles + admin_invites table
-- Run in Supabase SQL Editor

-- ============================================================
-- STEP 1: Extend account_type CHECK constraint
-- ============================================================
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_account_type_check;
ALTER TABLE public.users ADD CONSTRAINT users_account_type_check
  CHECK (account_type IN (
    'contractor','project_owner','agent','homeowner',
    'admin','admin_2','hired_dev','moderator'
  ));

-- ============================================================
-- STEP 2: Create admin_invites table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admin_invites (
  id          uuid primary key default uuid_generate_v4(),
  invited_by  uuid not null references public.users(id) on delete cascade,
  email       text not null,
  role        text not null check (role in (
    'admin','admin_2','hired_dev','moderator',
    'contractor','project_owner','agent','homeowner'
  )),
  token       text not null unique default encode(gen_random_bytes(32), 'hex'),
  expires_at  timestamptz not null default (now() + interval '7 days'),
  used_at     timestamptz,
  used_by     uuid references public.users(id),
  created_at  timestamptz not null default now()
);

ALTER TABLE public.admin_invites ENABLE ROW LEVEL SECURITY;

-- Super admin can do everything
CREATE POLICY "Super admin manages invites" ON public.admin_invites
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND account_type = 'admin')
  );

-- Anyone can read their own invite by token (for accept page)
CREATE POLICY "Anyone can read invites" ON public.admin_invites
  FOR SELECT USING (true);

GRANT ALL ON public.admin_invites TO service_role;
GRANT SELECT, INSERT ON public.admin_invites TO authenticated, anon;

-- Confirm
SELECT 'Migration 018 complete' AS status;
