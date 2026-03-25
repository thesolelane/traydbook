-- Migration 013: Fix missing RLS on partition tables and app tables
-- Run this in the Supabase SQL Editor.
-- spatial_ref_sys is a PostGIS extension system table — intentionally skipped.

-- ============================================================
-- PARTITION TABLES: dwell_events quarterly partitions
-- These partition public.dwell_events (user_id column).
-- Policies mirror the parent table.
-- ============================================================

ALTER TABLE IF EXISTS public.dwell_events_2026_q1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.dwell_events_2026_q2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.dwell_events_2026_q3 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.dwell_events_2026_q4 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.dwell_events_2027_q1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.dwell_events_2027_q2 ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE partitions TEXT[] := ARRAY[
  'dwell_events_2026_q1','dwell_events_2026_q2','dwell_events_2026_q3','dwell_events_2026_q4',
  'dwell_events_2027_q1','dwell_events_2027_q2'
]; p TEXT; BEGIN FOREACH p IN ARRAY partitions LOOP
  EXECUTE format($f$
    DO $inner$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = %L AND policyname = 'Users can insert own dwell events'
      ) THEN
        EXECUTE $q$
          CREATE POLICY "Users can insert own dwell events" ON public.%I
            FOR INSERT WITH CHECK (auth.uid() = user_id)
        $q$;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = %L AND policyname = 'Admins can read dwell events'
      ) THEN
        EXECUTE $q$
          CREATE POLICY "Admins can read dwell events" ON public.%I
            FOR SELECT USING (
              EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND account_type = 'admin')
            )
        $q$;
      END IF;
    END $inner$;
  $f$, p, p, p, p);
END LOOP; END $$;

-- ============================================================
-- PARTITION TABLES: interaction_events quarterly partitions
-- These partition public.interaction_events (user_id column).
-- Policies mirror the parent table.
-- ============================================================

ALTER TABLE IF EXISTS public.interaction_events_2026_q1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.interaction_events_2026_q2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.interaction_events_2026_q3 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.interaction_events_2026_q4 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.interaction_events_2027_q1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.interaction_events_2027_q2 ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE partitions TEXT[] := ARRAY[
  'interaction_events_2026_q1','interaction_events_2026_q2','interaction_events_2026_q3','interaction_events_2026_q4',
  'interaction_events_2027_q1','interaction_events_2027_q2'
]; p TEXT; BEGIN FOREACH p IN ARRAY partitions LOOP
  EXECUTE format($f$
    DO $inner$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = %L AND policyname = 'Users see own events'
      ) THEN
        EXECUTE $q$
          CREATE POLICY "Users see own events" ON public.%I
            FOR SELECT USING (auth.uid() = user_id)
        $q$;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = %L AND policyname = 'Users create own events'
      ) THEN
        EXECUTE $q$
          CREATE POLICY "Users create own events" ON public.%I
            FOR INSERT WITH CHECK (auth.uid() = user_id)
        $q$;
      END IF;
    END $inner$;
  $f$, p, p, p, p);
END LOOP; END $$;

-- ============================================================
-- post_likes
-- Users can see all likes (public read), manage their own.
-- ============================================================
ALTER TABLE IF EXISTS public.post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Post likes are public" ON public.post_likes
  FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Users manage own post likes" ON public.post_likes
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- credit_bundles
-- Pricing catalogue — publicly readable, only service_role writes.
-- ============================================================
ALTER TABLE IF EXISTS public.credit_bundles ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Credit bundles are public" ON public.credit_bundles
  FOR SELECT USING (true);

-- ============================================================
-- credit_action_costs
-- Action cost catalogue — publicly readable, only service_role writes.
-- ============================================================
ALTER TABLE IF EXISTS public.credit_action_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Credit action costs are public" ON public.credit_action_costs
  FOR SELECT USING (true);

-- ============================================================
-- content_scores
-- Feed ranking scores — users see their own content's scores,
-- admins see all.
-- ============================================================
ALTER TABLE IF EXISTS public.content_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Admins can read content scores" ON public.content_scores
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND account_type = 'admin')
  );

-- ============================================================
-- user_affinity_scores
-- User-to-user affinity for feed ranking — users see their own.
-- ============================================================
ALTER TABLE IF EXISTS public.user_affinity_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users see own affinity scores" ON public.user_affinity_scores
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- search_events
-- Search analytics — users see their own search history.
-- ============================================================
ALTER TABLE IF EXISTS public.search_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users see own search events" ON public.search_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users create own search events" ON public.search_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- profile_field_sources
-- Profile data source tracking — users see their own.
-- ============================================================
ALTER TABLE IF EXISTS public.profile_field_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users see own profile field sources" ON public.profile_field_sources
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users manage own profile field sources" ON public.profile_field_sources
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- verification_orders
-- Badge/license verification orders — users see their own.
-- ============================================================
ALTER TABLE IF EXISTS public.verification_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users see own verification orders" ON public.verification_orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users create own verification orders" ON public.verification_orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Admins can manage verification orders" ON public.verification_orders
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND account_type = 'admin')
  );

-- ============================================================
-- DIAGNOSTIC: Re-run this to confirm zero MISSING rows remain
-- (spatial_ref_sys is a PostGIS system table — expected to show MISSING, ignore it)
-- ============================================================
SELECT
  t.tablename                                                          AS table_name,
  CASE WHEN c.relrowsecurity THEN 'enabled' ELSE 'MISSING' END        AS rls_status
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
WHERE t.schemaname = 'public'
ORDER BY c.relrowsecurity, t.tablename;
