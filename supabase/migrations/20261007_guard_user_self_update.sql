-- already applied to live on 7 Oct 2026
create or replace function public.guard_user_self_update()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.account_type          is distinct from old.account_type
    or new.is_verified           is distinct from old.is_verified
    or new.email_verified        is distinct from old.email_verified
    or new.is_active             is distinct from old.is_active
    or new.email                 is distinct from old.email
    or new.is_delegate           is distinct from old.is_delegate
    or new.delegate_principal_id is distinct from old.delegate_principal_id
    or new.referral_code         is distinct from old.referral_code
    or new.referral_source       is distinct from old.referral_source
    or new.referred_at           is distinct from old.referred_at
    or new.referral_credits_held is distinct from old.referral_credits_held
    or new.solana_pubkey         is distinct from old.solana_pubkey
    or coalesce(new.credit_balance, 0) > coalesce(old.credit_balance, 0)
    then
      raise exception 'Not allowed: this field can only be changed by TraydBook staff tools.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists tg_guard_user_self_update on public.users;
create trigger tg_guard_user_self_update
  before update on public.users
  for each row execute function public.guard_user_self_update();
