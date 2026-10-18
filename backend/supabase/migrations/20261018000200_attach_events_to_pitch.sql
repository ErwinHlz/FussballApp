-- Trainings created without the schedule can be entered into it afterwards: the training (or
-- all upcoming trainings of its series) gets a booking of a pitch part at its own times.

create function public.attach_events_to_pitch(
  p_event_id uuid,
  p_pitch_id uuid,
  p_part public.pitch_part,
  p_whole_series boolean default false
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_event public.events;
  v_pitch public.pitches;
  v_tz text;
  v_date date;
  v_start time;
  v_end time;
  v_weekday int;
  v_events uuid[];
  v_dates date[];
  v_free date[];
  v_booking public.slot_bookings;
  v_location text;
begin
  select * into v_event from public.events where id = p_event_id;
  if not found then
    raise exception 'event not found' using errcode = 'P0002';
  end if;
  if not public.is_team_coach(v_event.team_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if v_event.type <> 'training' or v_event.is_cancelled or v_event.booking_id is not null
     or v_event.ends_at is null then
    raise exception 'event cannot be entered' using errcode = 'P0001', hint = 'not_attachable';
  end if;

  select * into v_pitch from public.pitches where id = p_pitch_id for update;
  if not found then
    raise exception 'pitch not found' using errcode = 'P0002';
  end if;
  if (select club_id from public.teams where id = v_event.team_id) is distinct from v_pitch.club_id then
    raise exception 'team is not in the club of the pitch' using errcode = '42501';
  end if;
  if p_part <> 'full' and not v_pitch.splittable then
    raise exception 'pitch cannot be split' using errcode = 'P0001', hint = 'not_splittable';
  end if;

  select timezone into v_tz from public.clubs where id = v_pitch.club_id;
  v_date := (v_event.starts_at at time zone v_tz)::date;
  v_start := (v_event.starts_at at time zone v_tz)::time;
  v_end := (v_event.ends_at at time zone v_tz)::time;
  v_weekday := extract(dow from v_date);
  if not private.bookable_range(v_weekday, v_start, v_end) then
    raise exception 'outside the bookable times' using errcode = 'P0001', hint = 'not_bookable';
  end if;

  -- This training, or every upcoming one of its series at the same weekday and times.
  select array_agg(e.id order by e.starts_at), array_agg((e.starts_at at time zone v_tz)::date order by e.starts_at)
  into v_events, v_dates
  from public.events e
  where (e.id = p_event_id or (
      p_whole_series and v_event.series_id is not null and e.series_id = v_event.series_id
      and e.starts_at > now()
    ))
    and not e.is_cancelled and e.booking_id is null
    and (e.starts_at at time zone v_tz)::time = v_start
    and (e.ends_at at time zone v_tz)::time = v_end
    and extract(dow from (e.starts_at at time zone v_tz)) = v_weekday;

  select array_agg(d order by d) into v_free
  from unnest(v_dates) as d
  where not private.range_taken(p_pitch_id, p_part, d, v_start, v_end);

  if v_free is null then
    raise exception 'time is taken' using errcode = 'P0001', hint = 'slot_taken';
  end if;

  insert into public.slot_bookings
    (club_id, pitch_id, team_id, part, weekday, start_time, end_time, valid_from, valid_until)
  values (
    v_pitch.club_id, p_pitch_id, v_event.team_id, p_part, v_weekday, v_start, v_end,
    v_free[1], v_free[array_length(v_free, 1)]
  )
  returning * into v_booking;

  -- Weeks in between without a training of this booking stay free for others.
  insert into public.slot_booking_exceptions (booking_id, date)
  select v_booking.id, d::date
  from generate_series(v_booking.valid_from::timestamp, v_booking.valid_until::timestamp, interval '7 days') as d
  where d::date <> all (v_free);

  v_location := v_pitch.name || case p_part when 'a' then ' · A' when 'b' then ' · B' else '' end;
  update public.events e
  set booking_id = v_booking.id, location = v_location
  where e.id = any (v_events) and (e.starts_at at time zone v_tz)::date = any (v_free);

  return jsonb_build_object(
    'booking_id', v_booking.id,
    'booked', array_length(v_free, 1),
    'skipped', array_length(v_dates, 1) - array_length(v_free, 1)
  );
end;
$$;

revoke execute on function public.attach_events_to_pitch from anon, public;
grant execute on function public.attach_events_to_pitch to authenticated;
