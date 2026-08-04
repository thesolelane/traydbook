-- Migration: Add owner_preferences JSONB column to users table
-- Stores signup preferences for agents, homeowners, and project owners.
-- For agents: metro, client_types, trades_needed
-- For homeowners/project_owners: project_type, budget_range, timeline, trades_needed

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS owner_preferences JSONB;
