-- Review and apply manually. Allows inactive/incomplete users to read themselves.
create policy users_read_own on public.users
  for select to authenticated
  using (auth.uid() = id);
