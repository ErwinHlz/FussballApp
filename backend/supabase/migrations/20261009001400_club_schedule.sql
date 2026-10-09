-- Club schedule: shared weekly plan of pitches and time slots.
--
-- The club admin creates pitches (optionally split into halves A and B) and weekly slots per
-- season. Teams book a part of a slot for one date or every week; single dates can be released
-- again (exceptions). Bookings create the team's trainings, releasing cancels them.

-- Occurrence times are computed in the club's time zone (slot times are local wall-clock times).
alter table public.clubs add column timezone text not null default 'Europe/Berlin';

create type public.pitch_part as enum ('full', 'a', 'b');

create table public.pitches (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  splittable boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  -- Target of the composite key on pitch_slots: a slot's club always matches its pitch.
  unique (id, club_id)
);

create table public.pitch_slots (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null,
  pitch_id uuid not null,
  weekday int not null check (weekday between 0 and 6), -- 0 = Sunday (JS getDay)
  start_time time not null,
  end_time time not null,
  valid_from date not null,
  valid_until date not null,
  created_at timestamptz not null default now(),
  foreign key (pitch_id, club_id) references public.pitches (id, club_id) on delete cascade,
  check (end_time - start_time between interval '15 minutes' and interval '10 hours'),
  check (valid_until >= valid_from and valid_until <= valid_from + 400)
);

create table public.slot_bookings (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  slot_id uuid not null references public.pitch_slots (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  part public.pitch_part not null,
  valid_from date not null,
  valid_until date not null,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (valid_until >= valid_from)
);

-- Dates inside a booking's range that it does not occupy (released or taken by others).
create table public.slot_booking_exceptions (
  booking_id uuid not null references public.slot_bookings (id) on delete cascade,
  date date not null,
  primary key (booking_id, date)
);

alter table public.events
  add column booking_id uuid references public.slot_bookings (id) on delete set null;

create index pitches_club_idx on public.pitches (club_id);
create index pitch_slots_pitch_idx on public.pitch_slots (pitch_id);
create index pitch_slots_club_idx on public.pitch_slots (club_id);
create index slot_bookings_slot_idx on public.slot_bookings (slot_id);
create index slot_bookings_club_idx on public.slot_bookings (club_id);
create index slot_bookings_team_idx on public.slot_bookings (team_id);
create index events_booking_idx on public.events (booking_id);

-- A pitch cannot have two slots at the same time.
create function private.check_slot_overlap()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (
    select 1 from public.pitch_slots s
    where s.pitch_id = new.pitch_id and s.id <> new.id and s.weekday = new.weekday
      and s.start_time < new.end_time and new.start_time < s.end_time
      and s.valid_from <= new.valid_until and new.valid_from <= s.valid_until
  ) then
    raise exception 'slot overlaps another slot' using errcode = 'P0001', hint = 'slot_overlap';
  end if;
  return new;
end;
$$;

create trigger pitch_slots_no_overlap
  before insert on public.pitch_slots
  for each row execute function private.check_slot_overlap();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function public.booking_club_id(p_booking_id uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select club_id from public.slot_bookings where id = p_booking_id;
$$;

-- True if the part of the slot is booked on that date. 'full' conflicts with both halves.
create function private.slot_part_taken(p_slot_id uuid, p_part public.pitch_part, p_date date)
returns boolean
language sql stable set search_path = ''
as $$
  select exists (
    select 1 from public.slot_bookings b
    where b.slot_id = p_slot_id
      and p_date between b.valid_from and b.valid_until
      and (b.part = 'full' or p_part = 'full' or b.part = p_part)
      and not exists (
        select 1 from public.slot_booking_exceptions x where x.booking_id = b.id and x.date = p_date
      )
  );
$$;

-- Local date of an event in the club's time zone.
create function private.local_date(p_at timestamptz, p_tz text)
returns date
language sql immutable set search_path = ''
as $$
  select (p_at at time zone p_tz)::date;
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.pitches enable row level security;
alter table public.pitch_slots enable row level security;
alter table public.slot_bookings enable row level security;
alter table public.slot_booking_exceptions enable row level security;

create policy "pitches: club members read" on public.pitches
  for select to authenticated using (public.is_club_member(club_id));
create policy "pitches: admins insert" on public.pitches
  for insert to authenticated with check (public.is_club_admin(club_id));
create policy "pitches: admins update" on public.pitches
  for update to authenticated
  using (public.is_club_admin(club_id)) with check (public.is_club_admin(club_id));
create policy "pitches: admins delete" on public.pitches
  for delete to authenticated using (public.is_club_admin(club_id));

-- Slots are created and deleted, never moved: bookings and trainings depend on their times.
create policy "pitch_slots: club members read" on public.pitch_slots
  for select to authenticated using (public.is_club_member(club_id));
create policy "pitch_slots: admins insert" on public.pitch_slots
  for insert to authenticated with check (public.is_club_admin(club_id));
create policy "pitch_slots: admins delete" on public.pitch_slots
  for delete to authenticated using (public.is_club_admin(club_id));

-- Bookings are changed through book_slot / release_slot_date / end_slot_booking only.
create policy "slot_bookings: club members read" on public.slot_bookings
  for select to authenticated using (public.is_club_member(club_id));
create policy "slot_booking_exceptions: club members read" on public.slot_booking_exceptions
  for select to authenticated using (public.is_club_member(public.booking_club_id(booking_id)));

revoke all on public.pitches, public.pitch_slots, public.slot_bookings,
  public.slot_booking_exceptions from anon;
revoke insert, update, delete on public.pitch_slots, public.slot_bookings,
  public.slot_booking_exceptions from authenticated;
grant insert, delete on public.pitch_slots to authenticated;
revoke update on public.pitches from authenticated;
grant update (name, sort_order) on public.pitches to authenticated;

-- ---------------------------------------------------------------------------
-- Trainings follow the bookings
-- ---------------------------------------------------------------------------

-- Removing a booking (released, slot or pitch deleted) cancels its upcoming trainings.
create function private.cancel_booking_events()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  -- When a whole club or team is deleted, its events are already gone or about to go.
  update public.events e
  set is_cancelled = true
  where e.booking_id = old.id and not e.is_cancelled and e.starts_at > now()
    and exists (select 1 from public.teams t where t.id = e.team_id);
  return old;
end;
$$;

create trigger slot_bookings_cancel_events
  before delete on public.slot_bookings
  for each row execute function private.cancel_booking_events();

-- ---------------------------------------------------------------------------
-- Team names of the club (coaches cannot read other teams directly)
-- ---------------------------------------------------------------------------

create function public.club_team_names(p_club_id uuid)
returns table (id uuid, name text)
language sql stable security definer set search_path = ''
as $$
  select t.id, t.name from public.teams t
  where t.club_id = p_club_id and public.is_club_member(p_club_id)
  order by t.name;
$$;

-- ---------------------------------------------------------------------------
-- Book a slot
-- ---------------------------------------------------------------------------

-- Books the part of a slot for the team from p_from to p_until (default: end of the slot's
-- season). Dates already taken by other teams are skipped. Creates the trainings: one event for
-- a single date, otherwise a training series (one push notification).
create function public.book_slot(
  p_slot_id uuid,
  p_team_id uuid,
  p_part public.pitch_part,
  p_from date,
  p_until date default null
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_slot public.pitch_slots;
  v_pitch public.pitches;
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

  -- Lock the slot: concurrent bookings of the same slot wait for each other.
  select * into v_slot from public.pitch_slots where id = p_slot_id for update;
  if not found then
    raise exception 'slot not found' using errcode = 'P0002';
  end if;
  if (select club_id from public.teams where id = p_team_id) is distinct from v_slot.club_id then
    raise exception 'team is not in the club of the slot' using errcode = '42501';
  end if;

  select * into v_pitch from public.pitches where id = v_slot.pitch_id;
  if p_part <> 'full' and not v_pitch.splittable then
    raise exception 'pitch cannot be split' using errcode = 'P0001', hint = 'not_splittable';
  end if;

  select timezone into v_tz from public.clubs where id = v_slot.club_id;

  -- Upcoming occurrences inside the requested range and the slot's season.
  select coalesce(array_agg(d::date order by d), '{}') into v_dates
  from generate_series(
    greatest(p_from, v_slot.valid_from)::timestamp,
    least(coalesce(p_until, v_slot.valid_until), v_slot.valid_until)::timestamp,
    interval '1 day'
  ) as d
  where extract(dow from d) = v_slot.weekday
    and ((d::date + v_slot.start_time) at time zone v_tz) > now();

  select array_agg(d order by d) into v_free
  from unnest(v_dates) as d
  where not private.slot_part_taken(p_slot_id, p_part, d);

  if v_free is null then
    raise exception 'slot is taken' using errcode = 'P0001', hint = 'slot_taken';
  end if;

  insert into public.slot_bookings (club_id, slot_id, team_id, part, valid_from, valid_until)
  values (v_slot.club_id, p_slot_id, p_team_id, p_part, v_free[1], v_free[array_length(v_free, 1)])
  returning * into v_booking;

  insert into public.slot_booking_exceptions (booking_id, date)
  select v_booking.id, d from unnest(v_dates) as d
  where d between v_booking.valid_from and v_booking.valid_until and d <> all (v_free);

  v_location := v_pitch.name || case p_part when 'a' then ' · A' when 'b' then ' · B' else '' end;

  if p_until is not null and p_until = p_from then
    insert into public.events (team_id, type, starts_at, ends_at, location, booking_id)
    values (
      p_team_id, 'training',
      (v_free[1] + v_slot.start_time) at time zone v_tz,
      (v_free[1] + v_slot.end_time) at time zone v_tz,
      v_location, v_booking.id
    );
  else
    insert into public.event_series
      (team_id, weekday, start_time, duration_min, location, valid_from, valid_until)
    values (
      p_team_id, v_slot.weekday, v_slot.start_time,
      (extract(epoch from v_slot.end_time - v_slot.start_time) / 60)::int,
      v_location, v_booking.valid_from, v_booking.valid_until
    )
    returning * into v_series;

    insert into public.events (team_id, type, series_id, starts_at, ends_at, location, booking_id)
    select p_team_id, 'training', v_series.id,
      (d + v_slot.start_time) at time zone v_tz,
      (d + v_slot.end_time) at time zone v_tz,
      v_location, v_booking.id
    from unnest(v_free) as d;

    select id into v_first from public.events
    where series_id = v_series.id order by starts_at limit 1;
    perform public.enqueue_series_notification(v_first, array_length(v_free, 1), v_slot.weekday);
  end if;

  return jsonb_build_object(
    'booking_id', v_booking.id,
    'booked', array_length(v_free, 1),
    'skipped', coalesce(array_length(v_dates, 1), 0) - array_length(v_free, 1)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Release
-- ---------------------------------------------------------------------------

-- Gives back one date of a booking; the training on that date is cancelled.
create function public.release_slot_date(p_booking_id uuid, p_date date)
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
     or extract(dow from p_date) <> (select weekday from public.pitch_slots where id = v_booking.slot_id)
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

-- Gives back all dates of a booking from p_from on (today at the earliest).
create function public.end_slot_booking(p_booking_id uuid, p_from date)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_booking public.slot_bookings;
  v_tz text;
  v_from date;
begin
  select * into v_booking from public.slot_bookings where id = p_booking_id for update;
  if not found then
    raise exception 'booking not found' using errcode = 'P0002';
  end if;
  if not public.is_team_coach(v_booking.team_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select timezone into v_tz from public.clubs where id = v_booking.club_id;
  v_from := greatest(p_from, (now() at time zone v_tz)::date);

  if v_from <= v_booking.valid_from then
    -- Nothing left: the delete trigger cancels the upcoming trainings.
    delete from public.slot_bookings where id = p_booking_id;
    return;
  end if;
  if v_from > v_booking.valid_until then
    return;
  end if;

  update public.events
  set is_cancelled = true
  where booking_id = p_booking_id and not is_cancelled
    and private.local_date(starts_at, v_tz) >= v_from;
  delete from public.slot_booking_exceptions where booking_id = p_booking_id and date >= v_from;
  update public.slot_bookings set valid_until = v_from - 1 where id = p_booking_id;
end;
$$;

revoke execute on function public.book_slot, public.release_slot_date, public.end_slot_booking,
  public.club_team_names, public.booking_club_id from anon, public;
grant execute on function public.book_slot, public.release_slot_date, public.end_slot_booking,
  public.club_team_names, public.booking_club_id to authenticated;
