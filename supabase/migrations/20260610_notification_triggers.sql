-- ============================================================
-- Notification triggers for social events
--
-- Already wired elsewhere (do NOT duplicate):
--   message_received  — inside send_message() stored function
--   bid_submitted     — inside submit_bid() stored function
--   bid_awarded       — inside award_bid() stored function
--   credits_added     — inside fulfill_stripe_purchase() stored function
--
-- This migration adds the four missing event notifications:
--   post_liked           — when increment_post_like(delta=1) is called
--   post_commented       — on INSERT into public.comments
--   connection_request   — on INSERT into public.connections (status=pending)
--   connection_accepted  — on UPDATE of public.connections to status=accepted
-- ============================================================


-- ============================================================
-- 1. post_liked
--    Modify increment_post_like to also fire a notification when
--    delta = 1 (a new like) and the liker is not the post author.
-- ============================================================
create or replace function public.increment_post_like(post_id uuid, delta integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_id     uuid;
  v_liker_id      uuid;
  v_liker_name    text;
  v_post_preview  text;
begin
  -- Update the counter
  update public.posts
  set like_count = greatest(0, like_count + delta)
  where id = post_id
  returning author_id, left(body, 80) into v_author_id, v_post_preview;

  -- Only notify on a like (delta > 0), and not if liking own post
  v_liker_id := auth.uid();
  if delta > 0 and v_author_id is not null and v_author_id <> v_liker_id then
    select display_name into v_liker_name
    from public.users
    where id = v_liker_id;

    insert into public.notifications (user_id, type, title, body, entity_id, entity_type)
    values (
      v_author_id,
      'post_liked',
      coalesce(v_liker_name, 'Someone') || ' liked your post',
      coalesce(nullif(trim(v_post_preview), ''), 'your post'),
      post_id,
      'post'
    );
  end if;
end;
$$;


-- ============================================================
-- 2. post_commented
--    Trigger function: fires after a new comment is inserted.
--    Notifies the post author (unless they commented on their own post).
-- ============================================================
create or replace function public.notify_post_commented()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_id     uuid;
  v_post_preview  text;
  v_commenter_name text;
begin
  select author_id, left(body, 80)
  into   v_author_id, v_post_preview
  from   public.posts
  where  id = new.post_id;

  -- Skip if author not found or commenter == author
  if v_author_id is null or v_author_id = new.author_id then
    return new;
  end if;

  select display_name into v_commenter_name
  from   public.users
  where  id = new.author_id;

  insert into public.notifications (user_id, type, title, body, entity_id, entity_type)
  values (
    v_author_id,
    'post_commented',
    coalesce(v_commenter_name, 'Someone') || ' commented on your post',
    case
      when length(trim(new.body)) > 100 then left(trim(new.body), 100) || '…'
      else trim(new.body)
    end,
    new.post_id,
    'post'
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_post_commented on public.comments;
create trigger trg_notify_post_commented
  after insert on public.comments
  for each row execute function public.notify_post_commented();


-- ============================================================
-- 3. connection_request
--    Trigger function: fires after a new connection row is inserted
--    with status = 'pending'. Notifies the recipient.
-- ============================================================
create or replace function public.notify_connection_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requester_name text;
begin
  if new.status <> 'pending' then
    return new;
  end if;

  select display_name into v_requester_name
  from   public.users
  where  id = new.requester_id;

  insert into public.notifications (user_id, type, title, body, entity_id, entity_type)
  values (
    new.recipient_id,
    'connection_request',
    coalesce(v_requester_name, 'Someone') || ' wants to connect',
    'Accept to start exchanging messages and referrals.',
    new.requester_id,
    'user'
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_connection_request on public.connections;
create trigger trg_notify_connection_request
  after insert on public.connections
  for each row execute function public.notify_connection_request();


-- ============================================================
-- 4. connection_accepted
--    Trigger function: fires after a connections row is updated
--    from any non-accepted status to 'accepted'.
--    Notifies the original requester.
-- ============================================================
create or replace function public.notify_connection_accepted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acceptor_name text;
begin
  -- Only fire when transitioning into 'accepted'
  if old.status = 'accepted' or new.status <> 'accepted' then
    return new;
  end if;

  select display_name into v_acceptor_name
  from   public.users
  where  id = new.recipient_id;

  insert into public.notifications (user_id, type, title, body, entity_id, entity_type)
  values (
    new.requester_id,
    'connection_accepted',
    coalesce(v_acceptor_name, 'Someone') || ' accepted your connection',
    'You''re now connected — send them a message to get started.',
    new.recipient_id,
    'user'
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_connection_accepted on public.connections;
create trigger trg_notify_connection_accepted
  after update on public.connections
  for each row execute function public.notify_connection_accepted();
