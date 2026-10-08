-- Phase 4: events (trainings and matches), training series, attendance and match squads.

create type public.event_type as enum ('training', 'match');
create type public.plan_status as enum ('draft', 'published');
create type public.attendance_status as enum ('yes', 'no', 'maybe');
create type public.squad_role as enum ('starter', 'bench', 'reserve');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Recurring trainings. One row per weekday ("Tue and Thu" = two series).
create table public.event_series (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  type public.event_type not null default 'training' check (type = 'training'),
  weekday int not null check (weekday between 0 and 6), -- 0 = Sunday (JS getDay)
  start_time time not null,
  duration_min int not null check (duration_min between 15 and 600),
  location text check (char_length(location) <= 120),
  valid_from date not null,
  valid_until date not null,
  created_at timestamptz not null default now(),
  check (valid_until >= valid_from)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  type public.event_type not null,
  series_id uuid references public.event_series (id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  meet_at timestamptz,
  location text check (char_length(location) <= 120),
  notes text check (char_length(notes) <= 2000),
  response_deadline timestamptz,
  is_cancelled boolean not null default false,
  cancel_reason text check (char_length(cancel_reason) <= 300),
  plan_status public.plan_status not null default 'draft',
  -- Matches only
  opponent text check (char_length(opponent) <= 80),
  is_home boolean,
  competition text check (competition in ('league', 'cup', 'friendly')),
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at),
  check (type = 'match' or (opponent is null and is_home is null and competition is null)),
  check (type = 'training' or opponent is not null)
);

create table public.attendances (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  member_id uuid not null references public.team_members (id) on delete cascade,
  status public.attendance_status not null,
  reason text check (reason in ('injured', 'sick', 'work', 'vacation', 'other')),
  reason_note text check (char_length(reason_note) <= 200),
  -- NULL = set automatically by the system (e.g. injured players on new events).
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (event_id, member_id),
  check (status = 'no' or (reason is null and reason_note is null))
);

create table public.match_squad (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  member_id uuid not null references public.team_members (id) on delete cascade,
  role public.squad_role not null,
  created_at timestamptz not null default now(),
  unique (event_id, member_id)
);

create index events_team_starts_idx on public.events (team_id, starts_at);
create index events_series_idx on public.events (series_id);
create index attendances_member_idx on public.attendances (member_id);
create index match_squad_member_idx on public.match_squad (member_id);
create index event_series_team_idx on public.event_series (team_id);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function public.event_team_id(p_event_id uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select team_id from public.events where id = p_event_id;
$$;

-- True if the member row belongs to the current user.
create function public.is_own_member(p_member_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.team_members
    where id = p_member_id and user_id = (select auth.uid())
  );
$$;

-- Players may answer until the response deadline (or the start, if there is none),
-- and never for cancelled events.
create function public.event_open_for_responses(p_event_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.events
    where id = p_event_id
      and not is_cancelled
      and now() < coalesce(response_deadline, starts_at)
  );
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- Track who changed an answer and when.
create function public.attendances_touch()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  -- System entries (see events_prefill_injured) stay unattributed.
  new.updated_by := case
    when current_setting('rondo.system_write', true) = 'on' then null
    else (select auth.uid())
  end;
  return new;
end;
$$;

create trigger attendances_touch
  before insert or update on public.attendances
  for each row execute function public.attendances_touch();

-- Injured players are pre-filled as "no (injured)" on every new event. They can change it.
create function public.events_prefill_injured()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform set_config('rondo.system_write', 'on', true);
  insert into public.attendances (event_id, member_id, status, reason)
  select new.id, m.id, 'no', 'injured'
  from public.team_members m
  where m.team_id = new.team_id and m.status = 'injured';
  perform set_config('rondo.system_write', 'off', true);
  return new;
end;
$$;

create trigger events_prefill_injured
  after insert on public.events
  for each row execute function public.events_prefill_injured();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.event_series enable row level security;
alter table public.events enable row level security;
alter table public.attendances enable row level security;
alter table public.match_squad enable row level security;

create policy "event_series: members read" on public.event_series
  for select to authenticated using (public.is_team_member(team_id));
create policy "event_series: coaches write" on public.event_series
  for all to authenticated
  using (public.is_team_coach(team_id)) with check (public.is_team_coach(team_id));

create policy "events: members read" on public.events
  for select to authenticated using (public.is_team_member(team_id));
create policy "events: coaches insert" on public.events
  for insert to authenticated with check (public.is_team_coach(team_id));
create policy "events: coaches update" on public.events
  for update to authenticated
  using (public.is_team_coach(team_id)) with check (public.is_team_coach(team_id));
create policy "events: coaches delete" on public.events
  for delete to authenticated using (public.is_team_coach(team_id));

create policy "attendances: members read" on public.attendances
  for select to authenticated using (public.is_team_member(public.event_team_id(event_id)));
create policy "attendances: coaches write" on public.attendances
  for all to authenticated
  using (public.is_team_coach(public.event_team_id(event_id)))
  with check (public.is_team_coach(public.event_team_id(event_id)));
create policy "attendances: players answer for themselves" on public.attendances
  for insert to authenticated
  with check (public.is_own_member(member_id) and public.event_open_for_responses(event_id));
create policy "attendances: players change own answer" on public.attendances
  for update to authenticated
  using (public.is_own_member(member_id) and public.event_open_for_responses(event_id))
  with check (public.is_own_member(member_id) and public.event_open_for_responses(event_id));

create policy "match_squad: members read" on public.match_squad
  for select to authenticated using (public.is_team_member(public.event_team_id(event_id)));
create policy "match_squad: coaches write" on public.match_squad
  for all to authenticated
  using (public.is_team_coach(public.event_team_id(event_id)))
  with check (public.is_team_coach(public.event_team_id(event_id)));

-- Columns clients may write.
revoke insert, update on public.attendances from authenticated;
grant insert (event_id, member_id, status, reason, reason_note) on public.attendances to authenticated;
grant update (status, reason, reason_note) on public.attendances to authenticated;

revoke update on public.events from authenticated;
grant update (starts_at, ends_at, meet_at, location, notes, response_deadline, is_cancelled,
  cancel_reason, plan_status, opponent, is_home, competition) on public.events to authenticated;

revoke all on public.event_series, public.events, public.attendances, public.match_squad from anon;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Creates a training series and its events atomically. Occurrences are computed by the
-- client in the user's local time zone (see generateSeriesOccurrences in the frontend).
create function public.create_training_series(
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

  return v_series;
end;
$$;

-- Replaces the nominated squad of a match in one go.
create function public.set_match_squad(p_event_id uuid, p_entries jsonb)
returns void
language plpgsql security invoker set search_path = ''
as $$
begin
  if (select type from public.events where id = p_event_id) is distinct from 'match' then
    raise exception 'not a match' using errcode = 'P0001', hint = 'not_a_match';
  end if;

  delete from public.match_squad where event_id = p_event_id;

  insert into public.match_squad (event_id, member_id, role)
  select p_event_id, (e ->> 'member_id')::uuid, (e ->> 'role')::public.squad_role
  from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb)) as e;
end;
$$;

revoke execute on function public.create_training_series, public.set_match_squad from anon, public;
grant execute on function public.create_training_series, public.set_match_squad to authenticated;

revoke execute on function public.event_team_id, public.is_own_member,
  public.event_open_for_responses from anon, public;
grant execute on function public.event_team_id, public.is_own_member,
  public.event_open_for_responses to authenticated;

-- ---------------------------------------------------------------------------
-- Linking a manual player (Phase 3) must keep answers and nominations.
-- The account's own answers win over answers the coach entered for the manual entry.
-- ---------------------------------------------------------------------------

create or replace function public.link_team_member(p_manual_member_id uuid, p_account_member_id uuid)
returns public.team_members
language plpgsql security definer set search_path = ''
as $$
declare
  v_manual public.team_members;
  v_account public.team_members;
  v_result public.team_members;
begin
  select * into v_manual from public.team_members where id = p_manual_member_id for update;
  select * into v_account from public.team_members where id = p_account_member_id for update;

  if v_manual.id is null or v_account.id is null then
    raise exception 'member not found' using errcode = 'P0002';
  end if;
  if not public.is_team_coach(v_manual.team_id) then
    raise exception 'only coaches can link players' using errcode = '42501';
  end if;
  if v_manual.team_id <> v_account.team_id then
    raise exception 'members belong to different teams' using errcode = 'P0001', hint = 'different_teams';
  end if;
  if v_manual.user_id is not null then
    raise exception 'player already has an account' using errcode = 'P0001', hint = 'already_linked';
  end if;
  if v_account.user_id is null then
    raise exception 'target has no account' using errcode = 'P0001', hint = 'no_account';
  end if;

  -- Move answers and nominations from the account entry to the manual entry.
  delete from public.attendances a
  where a.member_id = v_manual.id
    and exists (select 1 from public.attendances b where b.member_id = v_account.id and b.event_id = a.event_id);
  update public.attendances set member_id = v_manual.id where member_id = v_account.id;

  delete from public.match_squad a
  where a.member_id = v_account.id
    and exists (select 1 from public.match_squad b where b.member_id = v_manual.id and b.event_id = a.event_id);
  update public.match_squad set member_id = v_manual.id where member_id = v_account.id;

  delete from public.team_members where id = v_account.id;

  update public.team_members
  set
    user_id = v_account.user_id,
    role = case when v_account.role = 'coach' then 'coach'::public.team_role else v_manual.role end
  where id = v_manual.id
  returning * into v_result;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Realtime: live attendance overview for coaches (RLS applies to subscriptions).
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.attendances, public.match_squad, public.events;
