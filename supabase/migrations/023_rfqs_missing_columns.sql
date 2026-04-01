-- Migration 023: Add missing columns to rfqs and job_listings tables
-- Safe to re-run — uses ADD COLUMN IF NOT EXISTS throughout.

-- rfqs: requirements array was missing from original table creation
alter table public.rfqs
  add column if not exists requirements text[] not null default '{}';

-- job_listings: add any potentially missing columns
alter table public.job_listings
  add column if not exists certs_required  text[]  not null default '{}',
  add column if not exists duration_weeks  integer,
  add column if not exists is_urgent       boolean not null default false;
