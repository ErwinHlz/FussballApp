-- Team events ("event" type): a title instead of an opponent; no plan, groups or squad.

alter table public.events
  add column title text check (char_length(trim(title)) between 2 and 80);

-- Opponent only for matches, required there; events need a title.
alter table public.events
  drop constraint events_check2,
  add constraint events_match_opponent_check check (type <> 'match' or opponent is not null),
  add constraint events_event_title_check check (type <> 'event' or title is not null);

grant update (title) on public.events to authenticated;

-- Push messages show the event's title.
drop function public.claim_push_messages(int);
create function public.claim_push_messages(p_limit int default 100)
returns table (
  outbox_id bigint,
  kind text,
  payload jsonb,
  event_id uuid,
  event_type public.event_type,
  event_title text,
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
    c.id, c.kind, c.payload, e.id, e.type, e.title, e.starts_at, e.opponent, e.is_home, e.location, t.name,
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
