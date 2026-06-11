-- Grant table access for outreach tables to the server-side service role only.
-- The admin server connects via the service_role key which bypasses RLS but
-- still requires explicit GRANT. authenticated/anon are intentionally excluded
-- since these tables are admin-only and never queried client-side.
GRANT ALL ON public.outreach_templates TO service_role;
GRANT ALL ON public.outreach_send_log  TO service_role;
GRANT ALL ON public.outreach_prospects TO service_role;
