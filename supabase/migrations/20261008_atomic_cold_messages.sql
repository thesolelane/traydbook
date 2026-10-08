-- Review and apply manually. No live SQL has been run.
-- The authenticated server route calls this existing RPC with the caller's JWT.
-- COLD_MESSAGE_COST = 3; the message, credit debit and ledger insert are atomic.
create or replace function public.send_message(
  p_recipient_id uuid,
  p_thread_id text,
  p_body text
) returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_sender_id uuid := auth.uid();
  v_sender_acct text;
  v_recipient_acct text;
  v_msg_id uuid;
  v_new_balance integer;
  v_cold_message_cost constant integer := 3;
  v_thread_id text;
begin
  if v_sender_id is null then raise exception 'Sign-in required'; end if;
  if p_body is null or trim(p_body) = '' or length(p_body) > 10000 then
    raise exception 'Message must contain 1–10000 characters';
  end if;
  if p_recipient_id is null or v_sender_id = p_recipient_id then
    raise exception 'Invalid recipient';
  end if;
  v_thread_id := case when v_sender_id::text < p_recipient_id::text
    then v_sender_id::text || '_' || p_recipient_id::text
    else p_recipient_id::text || '_' || v_sender_id::text end;
  if p_thread_id is distinct from v_thread_id then raise exception 'Invalid thread_id'; end if;

  -- Serialize both directions of first contact, even for simultaneous requests.
  perform pg_advisory_xact_lock(hashtextextended(v_thread_id, 0));
  select account_type into v_sender_acct from public.users
    where id = v_sender_id and is_active = true and deleted_at is null;
  select account_type into v_recipient_acct from public.users
    where id = p_recipient_id and is_active = true and deleted_at is null;
  if v_sender_acct is null then raise exception 'Sender not found or inactive'; end if;
  if v_recipient_acct is null then raise exception 'Recipient not found or inactive'; end if;

  if v_sender_acct <> 'contractor' and v_recipient_acct = 'contractor'
    and not exists (
      select 1 from public.connections where status = 'accepted' and
        ((requester_id = v_sender_id and recipient_id = p_recipient_id) or
         (requester_id = p_recipient_id and recipient_id = v_sender_id))
    )
    and not exists (
      select 1 from public.messages where
        (sender_id = v_sender_id and recipient_id = p_recipient_id) or
        (sender_id = p_recipient_id and recipient_id = v_sender_id)
    )
  then
    update public.users set credit_balance = credit_balance - v_cold_message_cost
      where id = v_sender_id and credit_balance >= v_cold_message_cost
      returning credit_balance into v_new_balance;
    if not found then raise exception 'Insufficient credits: need 3 credits for first contact with a contractor'; end if;
    insert into public.credit_ledger (user_id, delta, balance_after, transaction_type, description)
      values (v_sender_id, -v_cold_message_cost, v_new_balance, 'send_message', 'Cold message to contractor');
  end if;

  insert into public.messages (thread_id, sender_id, recipient_id, body)
    values (v_thread_id, v_sender_id, p_recipient_id, trim(p_body))
    returning id into v_msg_id;
  insert into public.notifications (user_id, type, body, entity_id, entity_type)
    values (p_recipient_id, 'message_received', left(trim(p_body), 100), v_sender_id, 'thread:' || v_thread_id);
  return v_msg_id;
end;
$fn$;

revoke execute on function public.send_message(uuid, text, text) from public, anon;
grant execute on function public.send_message(uuid, text, text) to authenticated;
