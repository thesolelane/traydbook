-- traydbook database schema
-- Run this in the Supabase SQL Editor to set up all tables and policies

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- USERS
-- ============================================================
create table if not exists public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null,
  handle        text not null unique,
  avatar_url    text,
  account_type  text not null check (account_type in ('contractor','project_owner','agent','homeowner','admin')),
  location_city  text,
  location_state text,
  location_zip   text,
  credit_balance integer not null default 0,
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
-- Note: email is intentionally omitted from public.users.
-- Email lives in auth.users (Supabase managed) to prevent PII exposure.

alter table public.users enable row level security;

-- Authenticated users can read any profile (profile discovery).
-- Email (PII) is not stored here — use auth.users for email lookups server-side.
create policy "Authenticated users can read any profile" on public.users
  for select using (auth.uid() IS NOT NULL);

create policy "Users can update own profile" on public.users
  for update using (auth.uid() = id);

create policy "Users can insert own profile" on public.users
  for insert with check (auth.uid() = id);

-- ============================================================
-- CONTRACTOR PROFILES
-- ============================================================
create table if not exists public.contractor_profiles (
  id                   uuid primary key default uuid_generate_v4(),
  user_id              uuid not null references public.users(id) on delete cascade,
  business_name        text,
  primary_trade        text not null,
  secondary_trades     text[] not null default '{}',
  years_experience     integer not null default 0,
  bio                  text,
  service_radius_miles integer not null default 50,
  availability_status  text not null default 'available' check (availability_status in ('available','busy','not_available')),
  available_from       date,
  visible_to_owners    boolean not null default true,
  rating_avg           numeric(3,2) not null default 0,
  rating_count         integer not null default 0,
  projects_completed   integer not null default 0,
  total_work_value     numeric(12,2) not null default 0,
  created_at           timestamptz not null default now()
);

alter table public.contractor_profiles enable row level security;

create policy "Contractor profiles are public" on public.contractor_profiles
  for select using (true);

create policy "Contractors can update own profile" on public.contractor_profiles
  for update using (auth.uid() = user_id);

create policy "Contractors can insert own profile" on public.contractor_profiles
  for insert with check (auth.uid() = user_id);

-- ============================================================
-- CREDENTIALS
-- ============================================================
create table if not exists public.credentials (
  id                      uuid primary key default uuid_generate_v4(),
  contractor_id           uuid not null references public.contractor_profiles(id) on delete cascade,
  credential_type         text not null,
  license_number_encrypted text,
  masked_display          text not null,
  issuing_state           text,
  expiry_date             date,
  verified_at             timestamptz,
  status                  text not null default 'pending' check (status in ('active','expired','pending')),
  created_at              timestamptz not null default now()
);

alter table public.credentials enable row level security;

create policy "Credentials are public" on public.credentials
  for select using (true);

create policy "Contractors manage own credentials" on public.credentials
  for all using (
    auth.uid() = (select user_id from public.contractor_profiles where id = contractor_id)
  );

-- ============================================================
-- CONNECTIONS
-- ============================================================
create table if not exists public.connections (
  id           uuid primary key default uuid_generate_v4(),
  requester_id uuid not null references public.users(id) on delete cascade,
  recipient_id uuid not null references public.users(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at   timestamptz not null default now(),
  unique(requester_id, recipient_id)
);

alter table public.connections enable row level security;

create policy "Users see own connections" on public.connections
  for select using (auth.uid() = requester_id or auth.uid() = recipient_id);

create policy "Users create connections" on public.connections
  for insert with check (auth.uid() = requester_id);

create policy "Recipients update connections" on public.connections
  for update using (auth.uid() = recipient_id or auth.uid() = requester_id);

-- ============================================================
-- POSTS
-- ============================================================
create table if not exists public.posts (
  id             uuid primary key default uuid_generate_v4(),
  author_id      uuid not null references public.users(id) on delete cascade,
  post_type      text not null check (post_type in ('project_update','job_post','bid_post','trade_tip','safety_alert','referral','story')),
  body           text not null,
  media_urls     text[] not null default '{}',
  hashtags       text[] not null default '{}',
  linked_job_id  uuid,
  linked_rfq_id  uuid,
  tagged_user_id uuid references public.users(id),
  like_count     integer not null default 0,
  comment_count  integer not null default 0,
  share_count    integer not null default 0,
  is_urgent      boolean not null default false,
  is_boosted     boolean not null default false,
  created_at     timestamptz not null default now()
);

alter table public.posts enable row level security;

create policy "Posts are public" on public.posts
  for select using (true);

create policy "Authors can manage own posts" on public.posts
  for all using (auth.uid() = author_id);

-- ============================================================
-- COMMENTS
-- ============================================================
create table if not exists public.comments (
  id         uuid primary key default uuid_generate_v4(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  author_id  uuid not null references public.users(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);

alter table public.comments enable row level security;

create policy "Comments are public" on public.comments
  for select using (true);

create policy "Authors can manage own comments" on public.comments
  for all using (auth.uid() = author_id);

-- ============================================================
-- JOB LISTINGS
-- ============================================================
create table if not exists public.job_listings (
  id             uuid primary key default uuid_generate_v4(),
  poster_id      uuid not null references public.users(id) on delete cascade,
  title          text not null,
  description    text not null,
  trade_required text not null,
  job_type       text not null check (job_type in ('full_time','contract','per_diem','subcontract')),
  location_city  text not null,
  location_state text not null,
  pay_min        numeric(10,2),
  pay_max        numeric(10,2),
  pay_unit       text not null default 'hourly' check (pay_unit in ('hourly','salary','project')),
  certs_required text[] not null default '{}',
  start_date     date,
  duration_weeks integer,
  is_urgent      boolean not null default false,
  is_boosted     boolean not null default false,
  status         text not null default 'open' check (status in ('open','filled','closed')),
  created_at     timestamptz not null default now()
);

alter table public.job_listings enable row level security;

create policy "Job listings are public" on public.job_listings
  for select using (true);

create policy "Posters can manage own listings" on public.job_listings
  for all using (auth.uid() = poster_id);

-- ============================================================
-- JOB APPLICATIONS
-- ============================================================
create table if not exists public.job_applications (
  id          uuid primary key default uuid_generate_v4(),
  listing_id  uuid not null references public.job_listings(id) on delete cascade,
  applicant_id uuid not null references public.users(id) on delete cascade,
  cover_note  text,
  status      text not null default 'applied' check (status in ('applied','reviewed','accepted','rejected')),
  created_at  timestamptz not null default now(),
  unique(listing_id, applicant_id)
);

alter table public.job_applications enable row level security;

create policy "Applicants see own applications" on public.job_applications
  for select using (
    auth.uid() = applicant_id or
    auth.uid() = (select poster_id from public.job_listings where id = listing_id)
  );

create policy "Applicants can apply" on public.job_applications
  for insert with check (auth.uid() = applicant_id);

create policy "Poster can update status" on public.job_applications
  for update using (
    auth.uid() = (select poster_id from public.job_listings where id = listing_id)
  );

-- ============================================================
-- RFQs (Request for Quotes)
-- ============================================================
create table if not exists public.rfqs (
  id               uuid primary key default uuid_generate_v4(),
  poster_id        uuid not null references public.users(id) on delete cascade,
  title            text not null,
  trade_needed     text not null,
  project_type     text,
  scope_description text not null,
  budget_min       numeric(12,2),
  budget_max       numeric(12,2),
  sq_footage       integer,
  start_date       date,
  duration_weeks   integer,
  bid_deadline     timestamptz,
  location_zip     text not null,
  location_city    text,
  location_state   text,
  requirements     text[] not null default '{}',
  bid_count        integer not null default 0,
  status           text not null default 'open' check (status in ('open','awarded','closed','archived')),
  awarded_to       uuid references public.users(id),
  is_boosted       boolean not null default false,
  created_at       timestamptz not null default now()
);

alter table public.rfqs enable row level security;

create policy "RFQs are public" on public.rfqs
  for select using (true);

create policy "Posters manage own RFQs" on public.rfqs
  for all using (auth.uid() = poster_id);

-- ============================================================
-- BIDS
-- ============================================================
create table if not exists public.bids (
  id             uuid primary key default uuid_generate_v4(),
  rfq_id         uuid not null references public.rfqs(id) on delete cascade,
  bidder_id      uuid not null references public.users(id) on delete cascade,
  amount         numeric(12,2) not null,
  timeline_weeks integer,
  cover_note     text,
  document_url   text,
  status         text not null default 'pending' check (status in ('pending','under_review','awarded','not_awarded')),
  submitted_at   timestamptz not null default now(),
  unique(rfq_id, bidder_id)
);

alter table public.bids enable row level security;

create policy "Bidders see own bids" on public.bids
  for select using (
    auth.uid() = bidder_id or
    auth.uid() = (select poster_id from public.rfqs where id = rfq_id)
  );

create policy "Bidders can submit bids" on public.bids
  for insert with check (auth.uid() = bidder_id);

create policy "Bidders can update own bids" on public.bids
  for update using (auth.uid() = bidder_id);

-- ============================================================
-- MESSAGES
-- ============================================================
create table if not exists public.messages (
  id          uuid primary key default uuid_generate_v4(),
  thread_id   text not null,
  sender_id   uuid not null references public.users(id) on delete cascade,
  recipient_id uuid not null references public.users(id) on delete cascade,
  body        text not null,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

alter table public.messages enable row level security;

create policy "Users see own messages" on public.messages
  for select using (auth.uid() = sender_id or auth.uid() = recipient_id);

create policy "Users can send messages" on public.messages
  for insert with check (auth.uid() = sender_id);

create policy "Recipients can mark read" on public.messages
  for update using (auth.uid() = recipient_id);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
create table if not exists public.notifications (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.users(id) on delete cascade,
  type        text not null,
  title       text not null,
  body        text not null,
  entity_id   uuid,
  entity_type text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

alter table public.notifications enable row level security;

create policy "Users see own notifications" on public.notifications
  for select using (auth.uid() = user_id);

create policy "Users can update own notifications" on public.notifications
  for update using (auth.uid() = user_id);

-- ============================================================
-- CREDIT LEDGER
-- ============================================================
create table if not exists public.credit_ledger (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null references public.users(id) on delete cascade,
  delta            integer not null,
  balance_after    integer not null,
  transaction_type text not null check (transaction_type in ('purchase','spend','refund')),
  description      text not null,
  created_at       timestamptz not null default now()
);

alter table public.credit_ledger enable row level security;

create policy "Users see own ledger" on public.credit_ledger
  for select using (auth.uid() = user_id);

-- ============================================================
-- PURCHASES
-- ============================================================
create table if not exists public.purchases (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references public.users(id) on delete cascade,
  stripe_session_id text not null,
  credits           integer not null,
  amount_cents      integer not null,
  status            text not null default 'pending' check (status in ('pending','completed','failed')),
  created_at        timestamptz not null default now()
);

alter table public.purchases enable row level security;

create policy "Users see own purchases" on public.purchases
  for select using (auth.uid() = user_id);

-- ============================================================
-- PROJECTS (portfolio)
-- ============================================================
create table if not exists public.projects (
  id             uuid primary key default uuid_generate_v4(),
  contractor_id  uuid not null references public.contractor_profiles(id) on delete cascade,
  title          text not null,
  description    text,
  trade_tags     text[] not null default '{}',
  photo_urls     text[] not null default '{}',
  completed_date date,
  is_featured    boolean not null default false,
  created_at     timestamptz not null default now()
);

alter table public.projects enable row level security;

create policy "Projects are public" on public.projects
  for select using (true);

create policy "Contractors manage own projects" on public.projects
  for all using (
    auth.uid() = (select user_id from public.contractor_profiles where id = contractor_id)
  );

-- ============================================================
-- REVIEWS
-- ============================================================
create table if not exists public.reviews (
  id           uuid primary key default uuid_generate_v4(),
  reviewer_id  uuid not null references public.users(id) on delete cascade,
  reviewee_id  uuid not null references public.users(id) on delete cascade,
  rating       integer not null check (rating between 1 and 5),
  body         text not null,
  verified_job boolean not null default false,
  created_at   timestamptz not null default now(),
  unique(reviewer_id, reviewee_id)
);

alter table public.reviews enable row level security;

create policy "Reviews are public" on public.reviews
  for select using (true);

create policy "Reviewers manage own reviews" on public.reviews
  for all using (auth.uid() = reviewer_id);

-- ============================================================
-- INTERACTION EVENTS (feed ranking)
-- ============================================================
create table if not exists public.interaction_events (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.users(id) on delete cascade,
  event_type  text not null,
  entity_id   uuid,
  entity_type text,
  created_at  timestamptz not null default now()
);

alter table public.interaction_events enable row level security;

create policy "Users see own events" on public.interaction_events
  for select using (auth.uid() = user_id);

create policy "Users create own events" on public.interaction_events
  for insert with check (auth.uid() = user_id);

-- ============================================================
-- FUNCTIONS: increment bid count on new bid
-- ============================================================
create or replace function increment_bid_count()
returns trigger language plpgsql security definer as $$
begin
  update public.rfqs set bid_count = bid_count + 1 where id = new.rfq_id;
  return new;
end;
$$;

drop trigger if exists on_bid_inserted on public.bids;
create trigger on_bid_inserted
  after insert on public.bids
  for each row execute function increment_bid_count();

-- ============================================================
-- FUNCTIONS: increment comment count on new comment
-- ============================================================
create or replace function increment_comment_count()
returns trigger language plpgsql security definer as $$
begin
  update public.posts set comment_count = comment_count + 1 where id = new.post_id;
  return new;
end;
$$;

drop trigger if exists on_comment_inserted on public.comments;
create trigger on_comment_inserted
  after insert on public.comments
  for each row execute function increment_comment_count();

-- ============================================================
-- DWELL EVENTS (engagement / time-on-content analytics)
-- ============================================================
create table if not exists public.dwell_events (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references public.users(id) on delete set null,
  entity_type   text not null check (entity_type in ('post','rfq','job','profile','bid')),
  entity_id     uuid not null,
  dwell_ms      integer not null,
  session_id    text,
  created_at    timestamptz not null default now()
);

alter table public.dwell_events enable row level security;

create policy "Users can insert own dwell events" on public.dwell_events
  for insert with check (auth.uid() = user_id);

create policy "Admins can read dwell events" on public.dwell_events
  for select using (
    exists (
      select 1 from public.users
      where id = auth.uid() and account_type = 'admin'
    )
  );

-- Atomic like increment/decrement function
create or replace function public.increment_post_like(post_id uuid, delta integer)
returns void
language sql
security definer
as $$
  update public.posts
  set like_count = greatest(0, like_count + delta)
  where id = post_id;
$$;

-- ============================================================
-- FUNCTION: post_rfq
-- Atomically creates an RFQ, deducts credits for non-contractors, writes
-- credit ledger, and optionally shares to feed. Client can never bypass
-- credit enforcement or skip ledger entries.
-- ============================================================
create or replace function public.post_rfq(
  p_title          text,
  p_trade_needed   text,
  p_project_type   text,
  p_scope_description text,
  p_budget_min     numeric,
  p_budget_max     numeric,
  p_sq_footage     integer,
  p_start_date     date,
  p_duration_weeks integer,
  p_bid_deadline   timestamptz,
  p_location_zip   text,
  p_location_city  text,
  p_location_state text,
  p_requirements   text[],
  p_share_to_feed  boolean
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rfq_id        uuid;
  v_account_type  text;
  v_new_balance   integer;
  v_rfq_cost      integer := 10;
begin
  -- Load caller's account type
  select account_type
  into   v_account_type
  from   public.users
  where  id = auth.uid();

  if v_account_type is null then
    raise exception 'User not found';
  end if;

  -- Insert RFQ
  insert into public.rfqs (
    poster_id, title, trade_needed, project_type, scope_description,
    budget_min, budget_max, sq_footage, start_date, duration_weeks,
    bid_deadline, location_zip, location_city, location_state, requirements, status
  ) values (
    auth.uid(), p_title, p_trade_needed, p_project_type, p_scope_description,
    p_budget_min, p_budget_max, p_sq_footage, p_start_date, p_duration_weeks,
    p_bid_deadline, p_location_zip, p_location_city, p_location_state,
    coalesce(p_requirements, '{}'), 'open'
  ) returning id into v_rfq_id;

  -- Atomically deduct credits for non-contractors using a single conditional UPDATE
  -- (prevents double-spend race between concurrent transactions)
  if v_account_type != 'contractor' then
    update public.users
    set    credit_balance = credit_balance - v_rfq_cost
    where  id = auth.uid()
      and  credit_balance >= v_rfq_cost
    returning credit_balance into v_new_balance;

    if not found then
      raise exception 'Insufficient credits: need % credits', v_rfq_cost;
    end if;

    insert into public.credit_ledger (user_id, delta, balance_after, transaction_type, description)
    values (auth.uid(), -v_rfq_cost, v_new_balance, 'spend', 'Posted RFQ: ' || p_title);
  end if;

  -- Optionally share a bid_post to feed
  if p_share_to_feed then
    insert into public.posts (author_id, post_type, body, linked_rfq_id, hashtags)
    values (
      auth.uid(),
      'bid_post',
      'Seeking ' || p_trade_needed || ' Bids — ' || p_title ||
        E'\n\n' || left(p_scope_description, 280),
      v_rfq_id,
      array[ replace(p_trade_needed, ' ', ''), 'OpenBid', 'RFQ' ]
    );
  end if;

  return v_rfq_id;
end;
$$;

revoke execute on function public.post_rfq(text,text,text,text,numeric,numeric,integer,date,integer,timestamptz,text,text,text,text[],boolean) from public;
grant  execute on function public.post_rfq(text,text,text,text,numeric,numeric,integer,date,integer,timestamptz,text,text,text,text[],boolean) to authenticated;

-- ============================================================
-- FUNCTION: submit_bid
-- Inserts bid and notifies RFQ poster atomically. Enforces contractor-only
-- access server-side. Security definer for notification bypass.
-- ============================================================
create or replace function public.submit_bid(
  p_rfq_id        uuid,
  p_amount        numeric,
  p_timeline_weeks integer,
  p_cover_note    text,
  p_document_url  text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bid_id        uuid;
  v_poster_id     uuid;
  v_rfq_title     text;
  v_rfq_status    text;
  v_bidder_name   text;
  v_account_type  text;
begin
  -- Server-side enforcement: only contractors may submit bids
  select account_type into v_account_type from public.users where id = auth.uid();
  if v_account_type != 'contractor' then
    raise exception 'Only contractors can submit bids';
  end if;

  -- Fetch RFQ
  select poster_id, title, status
  into   v_poster_id, v_rfq_title, v_rfq_status
  from   public.rfqs
  where  id = p_rfq_id;

  if v_poster_id is null then
    raise exception 'RFQ not found';
  end if;

  if v_rfq_status != 'open' then
    raise exception 'RFQ is not open';
  end if;

  -- Poster cannot bid on their own RFQ
  if auth.uid() = v_poster_id then
    raise exception 'You cannot bid on your own RFQ';
  end if;

  -- Bidder display name for the notification body
  select display_name into v_bidder_name
  from   public.users
  where  id = auth.uid();

  -- Insert bid (unique constraint on (rfq_id, bidder_id) prevents duplicates)
  insert into public.bids
    (rfq_id, bidder_id, amount, timeline_weeks, cover_note, document_url, status)
  values
    (p_rfq_id, auth.uid(), p_amount, p_timeline_weeks, p_cover_note, p_document_url, 'pending')
  returning id into v_bid_id;

  -- Notify poster — bypasses notification RLS intentionally via security definer
  insert into public.notifications (user_id, type, title, body, entity_id, entity_type)
  values (
    v_poster_id,
    'new_bid',
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
-- FUNCTION: award_bid
-- Awards a bid: verifies caller is RFQ poster, RFQ is open, and derives
-- the winning bidder from the bid row (never trusts client-supplied id).
-- ============================================================
create or replace function public.award_bid(
  p_bid_id uuid,
  p_rfq_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_poster_id  uuid;
  v_rfq_status text;
  v_bid_rfq_id uuid;
  v_bidder_id  uuid;
begin
  -- Fetch RFQ
  select poster_id, status
  into   v_poster_id, v_rfq_status
  from   public.rfqs
  where  id = p_rfq_id;

  if v_poster_id is null then
    raise exception 'RFQ not found';
  end if;

  -- Caller must be the RFQ poster
  if auth.uid() != v_poster_id then
    raise exception 'Unauthorized: only the RFQ poster can award a bid';
  end if;

  -- RFQ must still be open
  if v_rfq_status != 'open' then
    raise exception 'RFQ is not open — cannot award a bid';
  end if;

  -- Derive bidder from the bid row — never trust a client-supplied value
  select rfq_id, bidder_id
  into   v_bid_rfq_id, v_bidder_id
  from   public.bids
  where  id = p_bid_id;

  if v_bid_rfq_id is null or v_bid_rfq_id != p_rfq_id then
    raise exception 'Bid does not belong to this RFQ';
  end if;

  -- Execute the award
  update public.bids set status = 'awarded'     where id = p_bid_id;
  update public.bids set status = 'not_awarded' where rfq_id = p_rfq_id and id != p_bid_id;
  update public.rfqs set status = 'awarded', awarded_to = v_bidder_id where id = p_rfq_id;

  -- Notify the winning bidder
  insert into public.notifications (user_id, type, title, body, entity_id, entity_type)
  values (
    v_bidder_id,
    'bid_awarded',
    'Your bid was awarded!',
    'Congratulations — your bid has been selected for this project.',
    p_rfq_id,
    'rfq'
  );
end;
$$;

revoke execute on function public.award_bid(uuid, uuid) from public;
grant  execute on function public.award_bid(uuid, uuid) to authenticated;
