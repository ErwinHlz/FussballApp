-- Pitch schedule in 30-minute steps: teams book a time range on a pitch (Monday to Friday,
-- 15:00–20:30) instead of fixed slots set up by the admin. Fixed slots are removed; existing
-- bookings keep their times.

-- ---------------------------------------------------------------------------
-- Bookings carry pitch, weekday and times themselves
-- ---------------------------------------------------------------------------

alter table public.slot_bookings
  add column pitch_id uuid references public.pitches (id) on delete cascade,
  add column weekday int,
  add column start_time time,
  add column end_time time;

update public.slot_bookings b
set pitch_id = s.pitch_id, weekday = s.weekday, start_time = s.start_time, end_time = s.end_time
from public.pitch_slots s
where s.id = b.slot_id;

alter table public.slot_bookings
  alter column pitch_id set not null,
  alter column weekday set not null,
  alter column start_time set not null,
  alter column end_time set not null,
  add constraint slot_bookings_weekday_check check (weekday between 0 and 6),
  add constraint slot_bookings_times_check check (end_time > start_time),
  drop column slot_id;

create index slot_bookings_pitch_idx on public.slot_bookings (pitch_id, weekday);

drop function public.book_slot(uuid, uuid, public.pitch_part, date, date);
drop function private.slot_part_taken(uuid, public.pitch_part, date);
drop table public.pitch_slots;
drop function private.check_slot_overlap();

-- ---------------------------------------------------------------------------
-- Rules
-- ---------------------------------------------------------------------------

-- Bookable time: Monday to Friday, 15:00 to 20:30, in steps of 30 minutes.
create function private.bookable_range(p_weekday int, p_start time, p_end time)
returns boolean
language sql immutable set search_path = ''
as $$
  select p_weekday between 1 and 5
    and p_start >= time '15:00' and p_end <= time '20:30' and p_end > p_start
    and extract(minute from p_start) in (0, 30) and extract(second from p_start) = 0
    and extract(minute from p_end) in (0, 30) and extract(second from p_end) = 0;
$$;

-- True if the part of the pitch is booked on that date at an overlapping time.
-- 'full' conflicts with both halves.
create function private.range_taken(
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
  );
$$;

-- ---------------------------------------------------------------------------
-- Book a time range
-- ---------------------------------------------------------------------------

-- Books the part of the pitch from p_start to p_end on the weekday of p_from, for that date
-- (p_until = p_from) or every week until p_until (default: the next 30 June). Dates already
-- taken are skipped. Creates the trainings: one event for a single date, otherwise a series.
create function public.book_pitch(
  p_pitch_id uuid,
  p_team_id uuid,
  p_part public.pitch_part,
  p_start time,
  p_end time,
  p_from date,
  p_until date default null
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_pitch public.pitches;
  v_weekday int := extract(dow from p_from);
  v_until date;
  v_tz text;
  v_dates date[];
  v_free date[];
  v_booking public.slot_bookings;
  v_series public.event_series;
  v_location text;
  v_first uuid;
begin
  if not public.is_team_coach(p_team_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  -- Lock the pitch: concurrent bookings of the same pitch wait for each other.
  select * into v_pitch from public.pitches where id = p_pitch_id for update;
  if not found then
    raise exception 'pitch not found' using errcode = 'P0002';
  end if;
  if (select club_id from public.teams where id = p_team_id) is distinct from v_pitch.club_id then
    raise exception 'team is not in the club of the pitch' using errcode = '42501';
  end if;
  if p_part <> 'full' and not v_pitch.splittable then
    raise exception 'pitch cannot be split' using errcode = 'P0001', hint = 'not_splittable';
  end if;
  if not private.bookable_range(v_weekday, p_start, p_end) then
    raise exception 'outside the bookable times' using errcode = 'P0001', hint = 'not_bookable';
  end if;

  v_until := coalesce(
    p_until,
    make_date(extract(year from p_from)::int + case when extract(month from p_from) >= 7 then 1 else 0 end, 6, 30)
  );
  if v_until < p_from or v_until > p_from + 400 then
    raise exception 'invalid range' using errcode = 'P0001', hint = 'invalid_range';
  end if;

  select timezone into v_tz from public.clubs where id = v_pitch.club_id;

  select coalesce(array_agg(d::date order by d), '{}') into v_dates
  from generate_series(p_from::timestamp, v_until::timestamp, interval '7 days') as d
  where ((d::date + p_start) at time zone v_tz) > now();

  select array_agg(d order by d) into v_free
  from unnest(v_dates) as d
  where not private.range_taken(p_pitch_id, p_part, d, p_start, p_end);

  if v_free is null then
    raise exception 'time is taken' using errcode = 'P0001', hint = 'slot_taken';
  end if;

  insert into public.slot_bookings
    (club_id, pitch_id, team_id, part, weekday, start_time, end_time, valid_from, valid_until)
  values (
    v_pitch.club_id, p_pitch_id, p_team_id, p_part, v_weekday, p_start, p_end,
    v_free[1], v_free[array_length(v_free, 1)]
  )
  returning * into v_booking;

  insert into public.slot_booking_exceptions (booking_id, date)
  select v_booking.id, d from unnest(v_dates) as d
  where d between v_booking.valid_from and v_booking.valid_until and d <> all (v_free);

  v_location := v_pitch.name || case p_part when 'a' then ' · A' when 'b' then ' · B' else '' end;

  if v_until = p_from then
    insert into public.events (team_id, type, starts_at, ends_at, location, booking_id)
    values (
      p_team_id, 'training',
      (v_free[1] + p_start) at time zone v_tz,
      (v_free[1] + p_end) at time zone v_tz,
      v_location, v_booking.id
    );
  else
    insert into public.event_series
      (team_id, weekday, start_time, duration_min, location, valid_from, valid_until)
    values (
      p_team_id, v_weekday, p_start,
      (extract(epoch from p_end - p_start) / 60)::int,
      v_location, v_booking.valid_from, v_booking.valid_until
    )
    returning * into v_series;

    insert into public.events (team_id, type, series_id, starts_at, ends_at, location, booking_id)
    select p_team_id, 'training', v_series.id,
      (d + p_start) at time zone v_tz,
      (d + p_end) at time zone v_tz,
      v_location, v_booking.id
    from unnest(v_free) as d;

    select id into v_first from public.events
    where series_id = v_series.id order by starts_at limit 1;
    perform public.enqueue_series_notification(v_first, array_length(v_free, 1), v_weekday);
  end if;

  return jsonb_build_object(
    'booking_id', v_booking.id,
    'booked', array_length(v_free, 1),
    'skipped', coalesce(array_length(v_dates, 1), 0) - array_length(v_free, 1)
  );
end;
$$;

-- Release of a single date: the weekday now comes from the booking itself.
create or replace function public.release_slot_date(p_booking_id uuid, p_date date)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_booking public.slot_bookings;
  v_tz text;
begin
  select * into v_booking from public.slot_bookings where id = p_booking_id for update;
  if not found then
    raise exception 'booking not found' using errcode = 'P0002';
  end if;
  if not public.is_team_coach(v_booking.team_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select timezone into v_tz from public.clubs where id = v_booking.club_id;

  if p_date not between v_booking.valid_from and v_booking.valid_until
     or p_date < (now() at time zone v_tz)::date
     or extract(dow from p_date) <> v_booking.weekday
     or exists (
       select 1 from public.slot_booking_exceptions where booking_id = p_booking_id and date = p_date
     ) then
    raise exception 'date is not booked' using errcode = 'P0001', hint = 'not_booked';
  end if;

  update public.events
  set is_cancelled = true
  where booking_id = p_booking_id and not is_cancelled
    and private.local_date(starts_at, v_tz) = p_date;

  if v_booking.valid_from = v_booking.valid_until then
    delete from public.slot_bookings where id = p_booking_id;
  else
    insert into public.slot_booking_exceptions (booking_id, date) values (p_booking_id, p_date);
  end if;
end;
$$;

revoke execute on function public.book_pitch from anon, public;
grant execute on function public.book_pitch to authenticated;
