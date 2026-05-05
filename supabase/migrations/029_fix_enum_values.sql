-- Migration 029: Fix enum value mismatches against live DB enums.
--
-- Live DB has transaction_type as an ENUM (not text as in schema.sql):
--   valid values: purchase, post_rfq, post_job, send_message, request_contact,
--                 boost_listing, repost_listing, verification_fee, refund, admin_adjustment
-- Our functions were inserting 'spend' → invalid → 22P02.
--
-- Live DB has notification_type as an ENUM:
--   valid values: connection_request, connection_accepted, post_liked, post_commented,
--                 bid_received, bid_awarded, bid_not_awarded, job_application,
--                 rfq_closing_soon, credential_expiring, referral_received, safety_alert,
--                 message_received, credits_added, profile_viewed
-- submit_bid was inserting 'new_bid' → invalid → would fail when bids are submitted.

-- ============================================================
-- Fix post_rfq: 'spend' → 'post_rfq'
-- ============================================================
create or replace function public.post_rfq(
  p_title             text,
  p_trade_needed      text,
  p_project_type      text,
  p_scope_description text,
  p_budget_min        numeric,
  p_budget_max        numeric,
  p_sq_footage        integer,
  p_start_date        date,
  p_duration_weeks    integer,
  p_bid_deadline      timestamptz,
  p_location_zip      text,
  p_location_city     text,
  p_location_state    text,
  p_requirements      text[],
  p_share_to_feed     boolean
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rfq_id       uuid;
  v_account_type text;
  v_new_balance  integer;
  v_rfq_cost     integer := 10;
begin
  select account_type into v_account_type from public.users where id = auth.uid();
  if v_account_type is null then raise exception 'User not found'; end if;

  insert into public.rfqs (
    poster_id, title, trade_needed, project_type, scope_description,
    budget_min, budget_max, sq_footage, start_date, duration_weeks,
    bid_deadline, location_zip, location_city, location_state,
    requirements, status, osha_required
  ) values (
    auth.uid(), p_title, p_trade_needed, p_project_type, p_scope_description,
    p_budget_min, p_budget_max, p_sq_footage, p_start_date, p_duration_weeks,
    p_bid_deadline, p_location_zip, p_location_city, p_location_state,
    coalesce(p_requirements, '{}'), 'open', 'none'
  ) returning id into v_rfq_id;

  if v_account_type != 'contractor' then
    update public.users
    set credit_balance = credit_balance - v_rfq_cost
    where id = auth.uid() and credit_balance >= v_rfq_cost
    returning credit_balance into v_new_balance;
    if not found then raise exception 'Insufficient credits: need % credits', v_rfq_cost; end if;
    insert into public.credit_ledger (user_id, delta, balance_after, transaction_type, description)
    values (auth.uid(), -v_rfq_cost, v_new_balance, 'post_rfq', 'Posted RFQ: ' || p_title);
  end if;

  if p_share_to_feed then
    insert into public.posts (author_id, post_type, body, linked_rfq_id, hashtags)
    values (auth.uid(), 'bid_post',
      'Seeking ' || p_trade_needed || ' Bids — ' || p_title || E'\n\n' || left(p_scope_description, 280),
      v_rfq_id, array[ replace(p_trade_needed, ' ', ''), 'OpenBid', 'RFQ' ]);
  end if;

  return v_rfq_id;
end;
$$;

revoke execute on function public.post_rfq(text,text,text,text,numeric,numeric,integer,date,integer,timestamptz,text,text,text,text[],boolean) from public;
grant  execute on function public.post_rfq(text,text,text,text,numeric,numeric,integer,date,integer,timestamptz,text,text,text,text[],boolean) to authenticated;

-- ============================================================
-- Fix submit_bid: notification type 'new_bid' → 'bid_received'
-- ============================================================
create or replace function public.submit_bid(
  p_rfq_id         uuid,
  p_amount         numeric,
  p_timeline_weeks integer,
  p_cover_note     text,
  p_document_url   text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bid_id       uuid;
  v_poster_id    uuid;
  v_rfq_title    text;
  v_rfq_status   text;
  v_bidder_name  text;
  v_account_type text;
begin
  select account_type into v_account_type from public.users where id = auth.uid();
  if v_account_type != 'contractor' then
    raise exception 'Only contractors can submit bids';
  end if;

  select poster_id, title, status
  into   v_poster_id, v_rfq_title, v_rfq_status
  from   public.rfqs
  where  id = p_rfq_id;

  if v_poster_id is null then raise exception 'RFQ not found'; end if;
  if v_rfq_status != 'open' then raise exception 'RFQ is not open'; end if;
  if auth.uid() = v_poster_id then raise exception 'You cannot bid on your own RFQ'; end if;

  select display_name into v_bidder_name
  from   public.users
  where  id = auth.uid();

  insert into public.bids
    (rfq_id, bidder_id, amount, timeline_weeks, cover_note, document_url, status)
  values
    (p_rfq_id, auth.uid(), p_amount, p_timeline_weeks, p_cover_note, p_document_url, 'pending')
  returning id into v_bid_id;

  insert into public.notifications (user_id, type, title, body, entity_id, entity_type)
  values (
    v_poster_id,
    'bid_received',
    'New bid received',
    coalesce(v_bidder_name, 'A contractor') || ' submitted a bid of $' ||
      round(p_amount)::text || ' on "' || v_rfq_title || '"',
    p_rfq_id,
    'rfq'
  );

  return v_bid_id;
end;
$$;

revoke execute on function public.submit_bid(uuid, numeric, integer, text, text) from public;
grant  execute on function public.submit_bid(uuid, numeric, integer, text, text) to authenticated;

-- ============================================================
-- Fix post_job: 'spend' → 'post_job' (preventive, same pattern)
-- ============================================================
create or replace function public.post_job(
  p_title          text,
  p_description    text,
  p_trade_required text,
  p_job_type       text,
  p_location_city  text,
  p_location_state text,
  p_pay_min        numeric,
  p_pay_max        numeric,
  p_pay_unit       text,
  p_certs_required text[],
  p_start_date     date,
  p_duration_weeks integer,
  p_is_urgent      boolean,
  p_share_to_feed  boolean
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id       uuid;
  v_account_type text;
  v_new_balance  integer;
  v_job_cost     integer := 5;
begin
  select account_type into v_account_type from public.users where id = auth.uid();
  if v_account_type is null then raise exception 'User not found'; end if;

  insert into public.job_listings (
    poster_id, title, description, trade_required, job_type,
    location_city, location_state, pay_min, pay_max, pay_unit,
    certs_required, start_date, duration_weeks, is_urgent, status
  ) values (
    auth.uid(), p_title, p_description, p_trade_required, p_job_type,
    p_location_city, p_location_state, p_pay_min, p_pay_max, p_pay_unit,
    coalesce(p_certs_required, '{}'), p_start_date, p_duration_weeks,
    coalesce(p_is_urgent, false), 'open'
  ) returning id into v_job_id;

  if v_account_type != 'contractor' then
    update public.users
    set credit_balance = credit_balance - v_job_cost
    where id = auth.uid() and credit_balance >= v_job_cost
    returning credit_balance into v_new_balance;
    if not found then raise exception 'Insufficient credits: need % credits', v_job_cost; end if;
    insert into public.credit_ledger (user_id, delta, balance_after, transaction_type, description)
    values (auth.uid(), -v_job_cost, v_new_balance, 'post_job', 'Posted Job: ' || p_title);
  end if;

  if p_share_to_feed then
    insert into public.posts (author_id, post_type, body, linked_job_id, hashtags)
    values (auth.uid(), 'job_post',
      'Hiring: ' || p_title || E'\n\n' || left(p_description, 280),
      v_job_id, array[ replace(p_trade_required, ' ', ''), 'NowHiring', 'Jobs' ]);
  end if;

  return v_job_id;
end;
$$;

revoke execute on function public.post_job(text,text,text,text,text,text,numeric,numeric,text,text[],date,integer,boolean,boolean) from public;
grant  execute on function public.post_job(text,text,text,text,text,text,numeric,numeric,text,text[],date,integer,boolean,boolean) to authenticated;

notify pgrst, 'reload schema';
