-- Bookings made while creating a training take its response deadline (hours before the start;
-- NULL = no deadline).

drop function public.book_pitch(uuid, uuid, public.pitch_part, time, time, date, date);

create function public.book_pitch(
  p_pitch_id uuid,
  p_team_id uuid,
  p_part public.pitch_part,
  p_start time,
  p_end time,
  p_from date,
  p_until date default null,
  p_deadline_hours int default null
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
    insert into public.events (team_id, type, starts_at, ends_at, location, booking_id, response_deadline)
    values (
      p_team_id, 'training',
      (v_free[1] + p_start) at time zone v_tz,
      (v_free[1] + p_end) at time zone v_tz,
      v_location, v_booking.id,
      ((v_free[1] + p_start) at time zone v_tz) - make_interval(hours => p_deadline_hours)
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

    insert into public.events
      (team_id, type, series_id, starts_at, ends_at, location, booking_id, response_deadline)
    select p_team_id, 'training', v_series.id,
      (d + p_start) at time zone v_tz,
      (d + p_end) at time zone v_tz,
      v_location, v_booking.id,
      ((d + p_start) at time zone v_tz) - make_interval(hours => p_deadline_hours)
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

revoke execute on function public.book_pitch from anon, public;
grant execute on function public.book_pitch to authenticated;
