-- Add owner_preferences JSONB column to users table
-- Stores project type, budget range, timeline, and trades needed
-- collected during signup for project_owner / homeowner / agent accounts.

alter table public.users
  add column if not exists owner_preferences jsonb;
