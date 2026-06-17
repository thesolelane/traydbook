-- Single-call stats aggregation for outreach_prospects.
-- Replaces 11 sequential HEAD requests with one Postgres round-trip.
-- The admin server calls supabaseAdmin.rpc('get_prospect_stats') and gets
-- total, by_status, and by_type in a single HTTP response.

CREATE OR REPLACE FUNCTION get_prospect_stats()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'total',     (SELECT COUNT(*) FROM outreach_prospects),
    'by_status', (
      SELECT COALESCE(json_object_agg(status, cnt), '{}'::json)
      FROM (
        SELECT status, COUNT(*) AS cnt
        FROM outreach_prospects
        GROUP BY status
      ) s
    ),
    'by_type',   (
      SELECT COALESCE(json_object_agg(prospect_type, cnt), '{}'::json)
      FROM (
        SELECT prospect_type, COUNT(*) AS cnt
        FROM outreach_prospects
        GROUP BY prospect_type
      ) t
    )
  );
$$;

-- Allow the service role (used by the admin server) to call this function.
GRANT EXECUTE ON FUNCTION get_prospect_stats() TO service_role;
