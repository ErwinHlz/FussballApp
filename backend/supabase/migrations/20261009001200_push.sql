-- Web push notifications.
--
-- Flow: triggers write events into notification_outbox -> a cron job (every minute) enqueues
-- deadline reminders and calls the Edge Function `push-dispatch` -> the function claims
-- pending messages with their recipients' devices (claim_push_messages) and sends them.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Devices
-- ---------------------------------------------------------------------------

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https?://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  locale text not null default 'de' check (locale in ('de', 'en')),
  user_agent text check (char_length(user_agent) <= 300),
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
create policy "push_subscriptions: own read" on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "push_subscriptions: own delete" on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.push_subscriptions from anon;
revoke insert, update on public.push_subscriptions from authenticated;

-- Registers this device for the current user (a shared device moves to the new user).
create function public.save_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_locale text default 'de',
  p_user_agent text default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, locale, user_agent)
  values ((select auth.uid()), p_endpoint, p_p256dh, p_auth,
    case when p_locale = 'en' then 'en' else 'de' end, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        locale = excluded.locale,
        user_agent = excluded.user_agent;
end;
$$;

-- ---------------------------------------------------------------------------
-- Outbox
-- ---------------------------------------------------------------------------

alter table public.events
  add column created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  add column reminder_sent_at timestamptz;

create table public.notification_outbox (
  id bigint generated always as identity primary key,
  kind text not null check (kind in (
    'event_created', 'series_created', 'event_cancelled', 'plan_published', 'nomination', 'reminder', 'test'
  )),
  event_id uuid references public.events (id) on delete cascade,
  actor_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index notification_outbox_pending_idx on public.notification_outbox (id) where processed_at is null;

-- Internal only: no client access at all.
alter table public.notification_outbox enable row level security;
revoke all on public.notification_outbox from anon, authenticated;

create function public.events_notify()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- Series announce themselves once (create_training_series), not per date.
    if new.series_id is null and new.starts_at > now() then
      insert into public.notification_outbox (kind, event_id, actor_id)
      values ('event_created', new.id, (select auth.uid()));
    end if;
  elsif tg_op = 'UPDATE' then
    if new.is_cancelled and not old.is_cancelled and new.starts_at > now() then
      insert into public.notification_outbox (kind, event_id, actor_id)
      values ('event_cancelled', new.id, (select auth.uid()));
    end if;
    if new.plan_status = 'published' and old.plan_status is distinct from 'published'
       and new.starts_at > now() then
      insert into public.notification_outbox (kind, event_id, actor_id)
      values ('plan_published', new.id, (select auth.uid()));
    end if;
  end if;
  return new;
end;
$$;

create trigger events_notify
  after insert or update of is_cancelled, plan_status on public.events
  for each row execute function public.events_notify();

-- Series: one notification for all dates.
create or replace function public.create_training_series(
  p_team_id uuid,
  p_weekday int,
  p_start_time time,
  p_duration_min int,
  p_location text,
  p_valid_from date,
  p_valid_until date,
  p_starts_at timestamptz[],
  p_deadline_hours int default null
)
returns public.event_series
language plpgsql security invoker set search_path = ''
as $$
declare
  v_series public.event_series;
  v_first uuid;
begin
  if coalesce(array_length(p_starts_at, 1), 0) = 0 then
    raise exception 'series has no dates' using errcode = 'P0001', hint = 'empty_series';
  end if;
  if array_length(p_starts_at, 1) > 200 then
    raise exception 'too many dates' using errcode = 'P0001', hint = 'too_many';
  end if;

  insert into public.event_series
    (team_id, weekday, start_time, duration_min, location, valid_from, valid_until)
  values
    (p_team_id, p_weekday, p_start_time, p_duration_min, nullif(trim(p_location), ''), p_valid_from, p_valid_until)
  returning * into v_series;

  insert into public.events (team_id, type, series_id, starts_at, ends_at, location, response_deadline)
  select
    p_team_id,
    'training',
    v_series.id,
    s,
    s + make_interval(mins => p_duration_min),
    v_series.location,
    case when p_deadline_hours is null then null else s - make_interval(hours => p_deadline_hours) end
  from unnest(p_starts_at) as s;

  select id into v_first from public.events
  where series_id = v_series.id order by starts_at limit 1;

  perform public.enqueue_series_notification(v_first, array_length(p_starts_at, 1), p_weekday);
  return v_series;
end;
$$;

-- security definer helper: the outbox is not writable by clients.
create function public.enqueue_series_notification(p_first_event uuid, p_count int, p_weekday int)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.notification_outbox (kind, event_id, actor_id, payload)
  values ('series_created', p_first_event, (select auth.uid()),
    jsonb_build_object('count', p_count, 'weekday', p_weekday));
$$;
revoke execute on function public.enqueue_series_notification from anon, public;
grant execute on function public.enqueue_series_notification to authenticated;

-- Nomination: notify only members who are newly in the squad.
create or replace function public.set_match_squad(p_event_id uuid, p_entries jsonb)
returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  v_before uuid[];
  v_new uuid[];
begin
  if (select type from public.events where id = p_event_id) is distinct from 'match' then
    raise exception 'not a match' using errcode = 'P0001', hint = 'not_a_match';
  end if;

  select coalesce(array_agg(member_id), '{}') into v_before
  from public.match_squad where event_id = p_event_id;

  delete from public.match_squad where event_id = p_event_id;

  insert into public.match_squad (event_id, member_id, role)
  select p_event_id, (e ->> 'member_id')::uuid, (e ->> 'role')::public.squad_role
  from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb)) as e;

  select coalesce(array_agg(member_id), '{}') into v_new
  from public.match_squad where event_id = p_event_id and not (member_id = any (v_before));

  if cardinality(v_new) > 0 then
    perform public.enqueue_nomination(p_event_id, v_new);
  end if;
end;
$$;

create function public.enqueue_nomination(p_event_id uuid, p_member_ids uuid[])
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_team_coach(public.event_team_id(p_event_id)) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.notification_outbox (kind, event_id, actor_id, payload)
  values ('nomination', p_event_id, (select auth.uid()), jsonb_build_object('member_ids', to_jsonb(p_member_ids)));
end;
$$;
revoke execute on function public.enqueue_nomination from anon, public;
grant execute on function public.enqueue_nomination to authenticated;

-- Test notification to the own devices.
create function public.request_test_push()
returns void
language sql security definer set search_path = ''
as $$
  insert into public.notification_outbox (kind, actor_id, payload)
  select 'test', (select auth.uid()), jsonb_build_object('user_id', (select auth.uid()))
  where (select auth.uid()) is not null;
$$;

revoke execute on function public.save_push_subscription, public.request_test_push from anon, public;
grant execute on function public.save_push_subscription, public.request_test_push to authenticated;

-- ---------------------------------------------------------------------------
-- Reminders: once per event, when the response deadline is less than 24 hours away.
-- ---------------------------------------------------------------------------

create function private.enqueue_reminders()
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_count int;
begin
  with due as (
    update public.events e
    set reminder_sent_at = now()
    where not e.is_cancelled
      and e.reminder_sent_at is null
      and e.response_deadline is not null
      and e.response_deadline > now()
      and e.response_deadline <= now() + interval '24 hours'
    returning e.id
  )
  insert into public.notification_outbox (kind, event_id)
  select 'reminder', id from due;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Claiming messages (Edge Function, service role only)
-- ---------------------------------------------------------------------------

create function public.claim_push_messages(p_limit int default 100)
returns table (
  outbox_id bigint,
  kind text,
  payload jsonb,
  event_id uuid,
  event_type public.event_type,
  starts_at timestamptz,
  opponent text,
  is_home boolean,
  location text,
  team_name text,
  subscription_id uuid,
  endpoint text,
  p256dh text,
  auth text,
  locale text
)
language plpgsql security definer set search_path = ''
as $$
begin
  return query
  with claimed as (
    update public.notification_outbox o
    set processed_at = now()
    where o.id in (
      select id from public.notification_outbox
      where processed_at is null
      order by id
      limit p_limit
      for update skip locked
    )
    returning o.*
  ),
  recipients as (
    -- Team-wide messages: every member with an account except whoever triggered it.
    select c.id as outbox_id, m.user_id
    from claimed c
    join public.events e on e.id = c.event_id
    join public.team_members m on m.team_id = e.team_id and m.user_id is not null
    where c.kind in ('event_created', 'series_created', 'event_cancelled')
      and m.user_id is distinct from c.actor_id
    union
    -- Published plans: players.
    select c.id, m.user_id
    from claimed c
    join public.events e on e.id = c.event_id
    join public.team_members m
      on m.team_id = e.team_id and m.user_id is not null and m.role = 'player'
    where c.kind = 'plan_published' and m.user_id is distinct from c.actor_id
    union
    -- Nominations: the newly nominated members.
    select c.id, m.user_id
    from claimed c
    join public.team_members m
      on m.id in (select (jsonb_array_elements_text(c.payload -> 'member_ids'))::uuid)
    where c.kind = 'nomination' and m.user_id is not null
    union
    -- Reminders: members who have not answered yet.
    select c.id, m.user_id
    from claimed c
    join public.events e on e.id = c.event_id
    join public.team_members m on m.team_id = e.team_id and m.user_id is not null
    where c.kind = 'reminder'
      and m.created_at <= e.starts_at
      and not exists (
        select 1 from public.attendances a where a.event_id = e.id and a.member_id = m.id
      )
    union
    select c.id, (c.payload ->> 'user_id')::uuid
    from claimed c
    where c.kind = 'test'
  )
  select
    c.id, c.kind, c.payload, e.id, e.type, e.starts_at, e.opponent, e.is_home, e.location, t.name,
    s.id, s.endpoint, s.p256dh, s.auth, s.locale
  from recipients r
  join claimed c on c.id = r.outbox_id
  join public.push_subscriptions s on s.user_id = r.user_id
  left join public.events e on e.id = c.event_id
  left join public.teams t on t.id = e.team_id
  order by c.id;
end;
$$;

revoke execute on function public.claim_push_messages from anon, public, authenticated;
grant execute on function public.claim_push_messages to service_role;

-- ---------------------------------------------------------------------------
-- Cron: every minute enqueue reminders and wake the Edge Function if needed.
-- The function URL and key differ per environment: set them once in private.push_config
-- (see backend/scripts/setup-push.mjs). Without config, nothing is called.
-- ---------------------------------------------------------------------------

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create table private.push_config (
  id int primary key default 1 check (id = 1),
  dispatch_url text not null,
  service_key text not null
);

create function private.run_push_cron()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_config private.push_config;
begin
  perform private.enqueue_reminders();
  select * into v_config from private.push_config where id = 1;
  if v_config.dispatch_url is null then
    return;
  end if;
  if exists (select 1 from public.notification_outbox where processed_at is null) then
    perform net.http_post(
      url := v_config.dispatch_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_config.service_key
      ),
      body := '{}'::jsonb
    );
  end if;
end;
$$;

select cron.schedule('push-dispatch', '* * * * *', 'select private.run_push_cron()');
