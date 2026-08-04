-- Migration: Fix remaining RPC enum/column mismatches
--
-- Fixes discovered against live DB:
--
--   1. send_message: transaction_type was 'spend' (invalid) → 'send_message'
--      Also removes 'title' column from notifications INSERT (column does not
--      exist in live DB — same issue fixed for submit_bid / award_bid in 029).
--
--   2. fulfill_stripe_purchase: removes 'title' column from notifications INSERT
--      (column does not exist in live DB). transaction_type 'purchase' and
--      notification_type 'credits_added' are already valid enum values.
--
-- Valid transaction_type enum values:
--   purchase, post_rfq, post_job, send_message, request_contact,
--   boost_listing, repost_listing, verification_fee, refund, admin_adjustment
--
-- Valid notification_type enum values:
--   connection_request, connection_accepted, post_liked, post_commented,
--   bid_received, bid_awarded, bid_not_awarded, job_application,
--   rfq_closing_soon, credential_expiring, referral_received, safety_alert,
--   message_received, credits_added, profile_viewed
--
-- Run in: Supabase Dashboard → SQL Editor → New query

-- ============================================================
-- 1. send_message: 'spend' → 'send_message'; drop title column
-- ============================================================
create or replace function public.send_message(
  p_recipient_id uuid,
  p_thread_id    text,
  p_body         text
) returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_msg_id              uuid;
  v_sender_acct         text;
  v_recipient_acct      text;
  v_is_first_contact    boolean;
  v_cold_msg_cost       integer := 3;
  v_new_balance         integer;
  v_canonical_thread_id text;
begin
  if p_body is null or trim(p_body) = '' then
    raise exception 'Message body cannot be empty';
  end if;
  if auth.uid() = p_recipient_id then
    raise exception 'Cannot message yourself';
  end if;

  select account_type into v_sender_acct   from public.users where id = auth.uid();
  select account_type into v_recipient_acct from public.users where id = p_recipient_id;
  if v_sender_acct    is null then raise exception 'Sender not found'; end if;
  if v_recipient_acct is null then raise exception 'Recipient not found'; end if;

  v_canonical_thread_id := (
    case
      when auth.uid()::text < p_recipient_id::text
        then auth.uid()::text || '_' || p_recipient_id::text
      else
        p_recipient_id::text || '_' || auth.uid()::text
    end
  );

  if p_thread_id is distinct from v_canonical_thread_id then
    raise exception 'Invalid thread_id: does not match canonical participant pair';
  end if;

  if v_sender_acct != 'contractor' and v_recipient_acct = 'contractor' then
    select not exists(
      select 1 from public.messages
      where (sender_id = auth.uid() and recipient_id = p_recipient_id)
         or (sender_id = p_recipient_id and recipient_id = auth.uid())
    ) into v_is_first_contact;

    if v_is_first_contact then
      update public.users
      set    credit_balance = credit_balance - v_cold_msg_cost
      where  id = auth.uid()
        and  credit_balance >= v_cold_msg_cost
      returning credit_balance into v_new_balance;

      if not found then
        raise exception 'Insufficient credits: need % credits for first contact with a contractor', v_cold_msg_cost;
      end if;

      insert into public.credit_ledger (user_id, delta, balance_after, transaction_type, description)
      values (auth.uid(), -v_cold_msg_cost, v_new_balance, 'send_message', 'Cold message to contractor');
    end if;
  end if;

  insert into public.messages (thread_id, sender_id, recipient_id, body)
  values (v_canonical_thread_id, auth.uid(), p_recipient_id, trim(p_body))
  returning id into v_msg_id;

  insert into public.notifications (user_id, type, body, entity_id, entity_type)
  values (
    p_recipient_id,
    'message_received',
    left(trim(p_body), 100),
    auth.uid(),
    'thread:' || v_canonical_thread_id
  );

  return v_msg_id;
end;
$fn$;

revoke execute on function public.send_message(uuid, text, text) from public;
grant  execute on function public.send_message(uuid, text, text) to authenticated;

-- ============================================================
-- 2. fulfill_stripe_purchase: drop title column from notifications
-- ============================================================
create or replace function public.fulfill_stripe_purchase(
  p_stripe_session_id text,
  p_user_id           uuid,
  p_credits           int,
  p_amount_cents      int,
  p_bundle_id         text
)
returns boolean
language plpgsql security definer
set search_path = public
as $fn$
declare
  v_affected    int;
  v_new_balance int;
begin
  update public.purchases
  set status = 'completed'
  where stripe_session_id = p_stripe_session_id
    and status = 'pending';

  get diagnostics v_affected = row_count;

  if v_affected = 0 then
    insert into public.purchases (user_id, stripe_session_id, credits, amount_cents, status)
    values (p_user_id, p_stripe_session_id, p_credits, p_amount_cents, 'completed')
    on conflict (stripe_session_id) do nothing;

    get diagnostics v_affected = row_count;

    if v_affected = 0 then
      return false;
    end if;
  end if;

  update public.users
  set credit_balance = credit_balance + p_credits
  where id = p_user_id
  returning credit_balance into v_new_balance;

  insert into public.credit_ledger (user_id, delta, balance_after, transaction_type, description)
  values (
    p_user_id,
    p_credits,
    v_new_balance,
    'purchase',
    'Purchased ' || p_credits || ' credits (' || p_bundle_id || ' bundle)'
  );

  insert into public.notifications (user_id, type, body, entity_type)
  values (
    p_user_id,
    'credits_added',
    p_credits || ' credits have been added to your account.',
    'credit_purchase'
  );

  return true;
end;
$fn$;

revoke execute on function public.fulfill_stripe_purchase(text, uuid, int, int, text) from public;
revoke execute on function public.fulfill_stripe_purchase(text, uuid, int, int, text) from anon;
revoke execute on function public.fulfill_stripe_purchase(text, uuid, int, int, text) from authenticated;
grant  execute on function public.fulfill_stripe_purchase(text, uuid, int, int, text) to service_role;

notify pgrst, 'reload schema';
