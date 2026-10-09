-- Statistics from data the app already has (no manual entry): training participation,
-- training time, answer rates, decline reasons and nominations.
-- Both functions run as the caller, so the normal RLS rules decide what is visible.
-- Only past, not cancelled events count, and only events after the member joined the team.

create function public.team_member_stats(p_team_id uuid, p_from timestamptz, p_to timestamptz)
returns table (
  member_id uuid,
  display_name text,
  role public.team_role,
  user_id uuid,
  trainings_total int,
  trainings_yes int,
  trainings_maybe int,
  trainings_no int,
  training_minutes int,
  matches_total int,
  matches_yes int,
  starter int,
  bench int,
  reserve int,
  events_total int,
  answered int,
  decline_reasons jsonb
)
language sql stable security invoker set search_path = ''
as $$
  with ev as (
    select e.id, e.type, e.starts_at, e.ends_at
    from public.events e
    where e.team_id = p_team_id
      and not e.is_cancelled
      and e.starts_at >= p_from
      and e.starts_at < least(p_to, now())
  ),
  per as (
    select
      m.id as member_id,
      ev.id as event_id,
      ev.type,
      ev.starts_at,
      ev.ends_at,
      a.status,
      ms.role as squad_role
    from public.team_members m
    join ev on ev.starts_at >= m.created_at
    left join public.attendances a on a.event_id = ev.id and a.member_id = m.id
    left join public.match_squad ms on ms.event_id = ev.id and ms.member_id = m.id
    where m.team_id = p_team_id
  )
  select
    m.id,
    m.display_name,
    m.role,
    m.user_id,
    (count(per.event_id) filter (where per.type = 'training'))::int,
    (count(*) filter (where per.type = 'training' and per.status = 'yes'))::int,
    (count(*) filter (where per.type = 'training' and per.status = 'maybe'))::int,
    (count(*) filter (where per.type = 'training' and per.status = 'no'))::int,
    -- Trainings without an end time count 0 minutes (unknown length).
    coalesce(round(sum(extract(epoch from (per.ends_at - per.starts_at)) / 60)
      filter (where per.type = 'training' and per.status = 'yes' and per.ends_at is not null)), 0)::int,
    (count(per.event_id) filter (where per.type = 'match'))::int,
    (count(*) filter (where per.type = 'match' and per.status = 'yes'))::int,
    (count(*) filter (where per.squad_role = 'starter'))::int,
    (count(*) filter (where per.squad_role = 'bench'))::int,
    (count(*) filter (where per.squad_role = 'reserve'))::int,
    count(per.event_id)::int,
    count(per.status)::int,
    coalesce((
      select jsonb_object_agg(r.reason, r.n)
      from (
        select a.reason, count(*) as n
        from public.attendances a
        join ev on ev.id = a.event_id
        where a.member_id = m.id and a.status = 'no' and a.reason is not null
          and ev.starts_at >= m.created_at
        group by a.reason
      ) r
    ), '{}'::jsonb)
  from public.team_members m
  left join per on per.member_id = m.id
  where m.team_id = p_team_id
  group by m.id
  order by m.display_name;
$$;

-- Participation per training (players only) for the trend chart.
create function public.team_training_attendance(p_team_id uuid, p_from timestamptz, p_to timestamptz)
returns table (
  event_id uuid,
  starts_at timestamptz,
  yes_count int,
  maybe_count int,
  no_count int,
  players int
)
language sql stable security invoker set search_path = ''
as $$
  select
    e.id,
    e.starts_at,
    (count(*) filter (where a.status = 'yes'))::int,
    (count(*) filter (where a.status = 'maybe'))::int,
    (count(*) filter (where a.status = 'no'))::int,
    count(m.id)::int
  from public.events e
  join public.team_members m
    on m.team_id = e.team_id and m.role = 'player' and m.created_at <= e.starts_at
  left join public.attendances a on a.event_id = e.id and a.member_id = m.id
  where e.team_id = p_team_id
    and e.type = 'training'
    and not e.is_cancelled
    and e.starts_at >= p_from
    and e.starts_at < least(p_to, now())
  group by e.id, e.starts_at
  order by e.starts_at;
$$;

revoke execute on function public.team_member_stats, public.team_training_attendance from anon, public;
grant execute on function public.team_member_stats, public.team_training_attendance to authenticated;
