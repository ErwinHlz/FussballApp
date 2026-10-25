-- Home matches can name the club pitch (and part) they are played on. Such a match appears in
-- the club's pitch schedule on exactly that pitch and blocks it for trainings: from the meeting
-- time (else the kick-off) until the end (else kick-off + 2 hours). Away matches and home
-- matches without a pitch stay out of the schedule.

alter table public.events
  add column pitch_id uuid references public.pitches (id) on delete set null,
  add column pitch_part public.pitch_part,
  add constraint events_pitch_check check (
    pitch_id is null
    or (type = 'match' and is_home is true and pitch_part is not null)
  );

create index events_pitch_idx on public.events (pitch_id) where pitch_id is not null;

-- ---------------------------------------------------------------------------
-- Keep the pitch consistent with the match
-- ---------------------------------------------------------------------------

-- An away match (or any other type) has no pitch; a pitch must belong to the team's club and
-- can only be split if it is splittable. Runs before the check above, so switching a match to
-- away simply drops its pitch.
create function private.normalize_event_pitch()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_pitch public.pitches;
begin
  if new.type <> 'match' or new.is_home is distinct from true then
    new.pitch_id := null;
  end if;
  if new.pitch_id is null then
    new.pitch_part := null;
    return new;
  end if;

  select * into v_pitch from public.pitches where id = new.pitch_id;
  if v_pitch.club_id is distinct from (select club_id from public.teams where id = new.team_id) then
    raise exception 'pitch is not in the club of the team' using errcode = '42501';
  end if;
  new.pitch_part := coalesce(new.pitch_part, 'full');
  if new.pitch_part <> 'full' and not v_pitch.splittable then
    raise exception 'pitch cannot be split' using errcode = 'P0001', hint = 'not_splittable';
  end if;
  return new;
end;
$$;

create trigger events_normalize_pitch
  before insert or update of type, is_home, pitch_id, pitch_part, team_id on public.events
  for each row execute function private.normalize_event_pitch();

-- ---------------------------------------------------------------------------
-- Occupancy
-- ---------------------------------------------------------------------------

-- Time a home match holds its pitch.
create function private.match_occupied_from(p_event public.events)
returns timestamptz
language sql immutable set search_path = ''
as $$ select coalesce(p_event.meet_at, p_event.starts_at); $$;

create function private.match_occupied_until(p_event public.events)
returns timestamptz
language sql immutable set search_path = ''
as $$ select coalesce(p_event.ends_at, p_event.starts_at + interval '2 hours'); $$;

-- True if the part of the pitch is booked on that date at an overlapping time, or a home match
-- is played there. Used by book_pitch and attach_events_to_pitch: dates with a home match on
-- the pitch are skipped like dates booked by other teams.
create or replace function private.range_taken(
  p_pitch_id uuid,
  p_part public.pitch_part,
  p_date date,
  p_start time,
  p_end time
)
returns boolean
language sql stable set search_path = ''
as $$
  select exists (
    select 1 from public.slot_bookings b
    where b.pitch_id = p_pitch_id
      and b.weekday = extract(dow from p_date)
      and p_date between b.valid_from and b.valid_until
      and b.start_time < p_end and p_start < b.end_time
      and (b.part = 'full' or p_part = 'full' or b.part = p_part)
      and not exists (
        select 1 from public.slot_booking_exceptions x where x.booking_id = b.id and x.date = p_date
      )
  )
  or exists (
    select 1
    from public.events e
    join public.pitches p on p.id = e.pitch_id
    join public.clubs c on c.id = p.club_id
    where e.pitch_id = p_pitch_id
      and not e.is_cancelled
      and (e.pitch_part = 'full' or p_part = 'full' or e.pitch_part = p_part)
      and private.match_occupied_from(e) < ((p_date + p_end) at time zone c.timezone)
      and ((p_date + p_start) at time zone c.timezone) < private.match_occupied_until(e)
  );
$$;

-- ---------------------------------------------------------------------------
-- Home matches in the club's schedule
-- ---------------------------------------------------------------------------

-- Every club member sees the schedule, also matches of other teams (only what the calendar
-- needs; the events themselves stay readable for the team only). Dates are the club's local
-- dates of the kick-off.
create function public.club_pitch_matches(p_club_id uuid, p_from date, p_until date)
returns table (
  id uuid,
  team_id uuid,
  pitch_id uuid,
  pitch_part public.pitch_part,
  opponent text,
  starts_at timestamptz,
  occupied_from timestamptz,
  occupied_until timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select e.id, e.team_id, e.pitch_id, e.pitch_part, e.opponent, e.starts_at,
    private.match_occupied_from(e), private.match_occupied_until(e)
  from public.events e
  join public.pitches p on p.id = e.pitch_id
  join public.clubs c on c.id = p.club_id
  where p.club_id = p_club_id
    and public.is_club_member(p_club_id)
    and not e.is_cancelled
    and private.local_date(e.starts_at, c.timezone) between p_from and p_until
  order by e.starts_at;
$$;

revoke execute on function public.club_pitch_matches from anon, public;
grant execute on function public.club_pitch_matches to authenticated;
