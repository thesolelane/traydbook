-- Review and apply manually BEFORE deploying browser reads of this view.
-- Intentionally owner-executed: the view exposes only these public fields even
-- after a later migration limits direct users reads to the authenticated owner.
create or replace view public.public_profiles
with (security_barrier = true)
as
select
  u.id,
  u.handle,
  u.display_name,
  u.avatar_url,
  -- Contractor bios are stored in contractor_profiles in the checked-in schema.
  -- Also preserve a users.bio if the manually maintained database has one.
  coalesce(to_jsonb(u)->>'bio', cp.bio) as bio,
  u.account_type,
  u.location_city,
  u.location_state,
  u.is_verified,
  u.created_at
from public.users u
left join public.contractor_profiles cp on cp.user_id = u.id
where u.is_active = true and u.deleted_at is null;

-- Anonymous access is limited to the same public columns (landing-page ticker).
revoke all on public.public_profiles from public;
grant select on public.public_profiles to anon, authenticated, service_role;
notify pgrst, 'reload schema';
