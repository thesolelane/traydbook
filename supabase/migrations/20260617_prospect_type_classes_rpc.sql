-- RPC: get_prospect_type_classes(prospect_type text default null)
-- Returns all distinct, non-empty type_class values from outreach_prospects.
-- Called by the admin /type-classes endpoint. Replaces the 4-request sampling
-- approach (count + 3 range fetches) with a single server-side DISTINCT scan.

CREATE OR REPLACE FUNCTION get_prospect_type_classes(
  p_prospect_type text DEFAULT NULL
)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    json_agg(tc ORDER BY tc),
    '[]'::json
  )
  FROM (
    SELECT DISTINCT type_class AS tc
    FROM outreach_prospects
    WHERE type_class IS NOT NULL
      AND type_class <> ''
      AND (p_prospect_type IS NULL OR prospect_type = p_prospect_type)
  ) sub;
$$;

GRANT EXECUTE ON FUNCTION get_prospect_type_classes(text) TO service_role;
