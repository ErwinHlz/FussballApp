-- Absences: a player is away for a period (vacation, injury …). Events in that period are
-- declined automatically; new events created later in the period too. Deleting the absence
-- removes exactly the answers it created. An explicit own answer always wins.

create table public.absences (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.team_members (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text not null check (reason in ('injured', 'sick', 'work', 'vacation', 'other')),
  note text check (char_length(note) <= 200),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (ends_at - starts_at <= interval '366 days')
);

create index absences_member_idx on public.absences (member_id, starts_at);

-- Answers created by an absence remember it, so they can be removed with the absence.
alter table public.attendances
  add column source_absence_id uuid references public.absences (id) on delete set null;

-- A user's own change turns an automatic answer into a manual one.
create or replace function public.attendances_touch()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  if current_setting('rondo.system_write', true) = 'on' then
    new.updated_by := null;
  else
    new.updated_by := (select auth.uid());
    new.source_absence_id := null;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Applying absences
-- ---------------------------------------------------------------------------

-- Declines all matching upcoming events for one absence. Players can only affect events that
-- are still open for answers; coaches (and the event trigger) also later ones.
-- Existing manual answers are kept (an explicit own answer wins).
create function public.apply_absence(p_absence_id uuid, p_include_closed boolean)
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_absence public.absences;
  v_team_id uuid;
  v_count int;
begin
  select * into v_absence from public.absences where id = p_absence_id;
  if v_absence.id is null then
    return 0;
  end if;
  select team_id into v_team_id from public.team_members where id = v_absence.member_id;

  perform set_config('rondo.system_write', 'on', true);

  with targets as (
    select e.id
    from public.events e
    where e.team_id = v_team_id
      and not e.is_cancelled
      and e.starts_at >= greatest(v_absence.starts_at, now())
      and e.starts_at < v_absence.ends_at
      and (p_include_closed or now() < coalesce(e.response_deadline, e.starts_at))
      and not exists (
        select 1 from public.attendances a
        where a.event_id = e.id and a.member_id = v_absence.member_id
          and a.updated_by is not null -- manual answer: keep it
      )
  ),
  upserted as (
    insert into public.attendances (event_id, member_id, status, reason, reason_note, source_absence_id)
    select t.id, v_absence.member_id, 'no', v_absence.reason, v_absence.note, v_absence.id
    from targets t
    on conflict (event_id, member_id) do update
      set status = 'no',
          reason = excluded.reason,
          reason_note = excluded.reason_note,
          source_absence_id = excluded.source_absence_id
    returning 1
  )
  select count(*) into v_count from upserted;

  perform set_config('rondo.system_write', 'off', true);
  return v_count;
end;
$$;

revoke execute on function public.apply_absence from anon, public, authenticated;

-- Creates absences for several own memberships (or, as coach, for squad members) and returns
-- how many events were declined.
create function public.create_absences(
  p_member_ids uuid[],
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_reason text,
  p_note text default null
)
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_member uuid;
  v_absence_id uuid;
  v_is_coach boolean;
  v_total int := 0;
begin
  if coalesce(array_length(p_member_ids, 1), 0) = 0 then
    return 0;
  end if;

  foreach v_member in array p_member_ids loop
    v_is_coach := public.is_team_coach(
      (select team_id from public.team_members where id = v_member)
    );
    if not (public.is_own_member(v_member) or v_is_coach) then
      raise exception 'not allowed' using errcode = '42501';
    end if;

    insert into public.absences (member_id, starts_at, ends_at, reason, note)
    values (v_member, p_starts_at, p_ends_at, p_reason, nullif(trim(p_note), ''))
    returning id into v_absence_id;

    v_total := v_total + public.apply_absence(v_absence_id, v_is_coach);
  end loop;

  return v_total;
end;
$$;

-- Removes an absence and the (still automatic) answers it created for upcoming events.
create function public.delete_absence(p_absence_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_member uuid;
begin
  select member_id into v_member from public.absences where id = p_absence_id;
  if v_member is null then
    raise exception 'absence not found' using errcode = 'P0002';
  end if;
  if not (
    public.is_own_member(v_member)
    or public.is_team_coach((select team_id from public.team_members where id = v_member))
  ) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  delete from public.attendances a
  using public.events e
  where a.source_absence_id = p_absence_id
    and e.id = a.event_id
    and e.starts_at >= now();

  delete from public.absences where id = p_absence_id;
end;
$$;

revoke execute on function public.create_absences, public.delete_absence from anon, public;
grant execute on function public.create_absences, public.delete_absence to authenticated;

-- New events inside an existing absence: decline right away (like injured players).
create or replace function public.events_prefill_injured()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform set_config('rondo.system_write', 'on', true);

  insert into public.attendances (event_id, member_id, status, reason, reason_note, source_absence_id)
  select distinct on (m.id)
    new.id, m.id, 'no', ab.reason, ab.note, ab.id
  from public.team_members m
  join public.absences ab
    on ab.member_id = m.id and new.starts_at >= ab.starts_at and new.starts_at < ab.ends_at
  where m.team_id = new.team_id
  order by m.id, ab.created_at desc;

  insert into public.attendances (event_id, member_id, status, reason)
  select new.id, m.id, 'no', 'injured'
  from public.team_members m
  where m.team_id = new.team_id and m.status = 'injured'
  on conflict (event_id, member_id) do nothing;

  perform set_config('rondo.system_write', 'off', true);
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS: the team sees who is away (plan trainings accordingly); writes only via the RPCs.
-- ---------------------------------------------------------------------------

alter table public.absences enable row level security;

create policy "absences: team members read" on public.absences
  for select to authenticated
  using (public.is_team_member((select team_id from public.team_members where id = member_id)));

revoke all on public.absences from anon;
revoke insert, update, delete on public.absences from authenticated;
