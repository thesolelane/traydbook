-- Grant table access for outreach tables to all Supabase roles
GRANT ALL ON public.outreach_templates   TO service_role, authenticated, anon;
GRANT ALL ON public.outreach_send_log    TO service_role, authenticated, anon;
GRANT ALL ON public.outreach_prospects   TO service_role, authenticated, anon;
