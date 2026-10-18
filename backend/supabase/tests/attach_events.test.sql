-- Entering trainings that were created without the schedule into it afterwards.
begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

insert into auth.users (id, email, raw_user_meta_data) values
  ('a2a2a2a2-0000-0000-0000-000000000001', 'coach.x@example.test', '{"display_name": "Coach X"}'),
  ('b2b2b2b2-0000-0000-0000-000000000002', 'player.x@example.test', '{"display_name": "Player X"}');

create function pg_temp.act_as(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;

create temp table ids (key text primary key, id uuid, token text);
grant all on ids to authenticated, anon;

-- d1: the next weekday (Mon–Fri) from tomorrow on.
create temp table d as
select min(x)::date as d1 from generate_series(current_date + 1, current_date + 7, interval '1 day') x
where extract(dow from x) between 1 and 5;
grant select on d to authenticated;

set local role authenticated;
select pg_temp.act_as('a2a2a2a2-0000-0000-0000-000000000001');
insert into ids (key, id) select 'club', (public.create_club('FC Nachtrag')).id;
with t as (insert into public.teams (club_id, name) select id, 'U15' from ids where key = 'club' returning id)
insert into ids (key, id) select 'team', id from t;
with i as (insert into public.team_invites (team_id, role) select id, 'player' from ids where key = 'team' returning token)
insert into ids (key, token) select 'invite', token from i;
with p as (insert into public.pitches (club_id, name) select id, 'Kunstrasen' from ids where key = 'club' returning id)
insert into ids (key, id) select 'pitch', id from p;

-- A training at 17:00–18:30 local time, created without the schedule.
with e as (
  insert into public.events (team_id, type, starts_at, ends_at, location)
  select (select id from ids where key = 'team'), 'training',
    (d1 + time '17:00') at time zone 'Europe/Berlin', (d1 + time '18:30') at time zone 'Europe/Berlin', 'Sportplatz'
  from d returning id
)
insert into ids (key, id) select 'event', id from e;
-- A late training that cannot be entered (after 20:30).
with e as (
  insert into public.events (team_id, type, starts_at, ends_at)
  select (select id from ids where key = 'team'), 'training',
    (d1 + time '20:00') at time zone 'Europe/Berlin', (d1 + time '21:30') at time zone 'Europe/Berlin'
  from d returning id
)
insert into ids (key, id) select 'late', id from e;

select pg_temp.act_as('b2b2b2b2-0000-0000-0000-000000000002');
select public.accept_team_invite((select token from ids where key = 'invite'));
select throws_ok(
  $$ select public.attach_events_to_pitch((select id from ids where key = 'event'), (select id from ids where key = 'pitch'), 'a') $$,
  '42501', null, 'players cannot enter trainings'
);

select pg_temp.act_as('a2a2a2a2-0000-0000-0000-000000000001');
select is(
  (public.attach_events_to_pitch((select id from ids where key = 'event'), (select id from ids where key = 'pitch'), 'a')) ->> 'booked',
  '1', 'a coach enters the training on half A'
);
select is(
  (select location from public.events where id = (select id from ids where key = 'event')),
  'Kunstrasen · A', 'the training takes the pitch as its place'
);
select is(
  (select to_char(start_time, 'HH24:MI') || '-' || to_char(end_time, 'HH24:MI') || ' ' || part::text
   from public.slot_bookings b join public.events e on e.booking_id = b.id
   where e.id = (select id from ids where key = 'event')),
  '17:00-18:30 a', 'the booking has the times of the training'
);
select throws_ok(
  $$ select public.attach_events_to_pitch((select id from ids where key = 'event'), (select id from ids where key = 'pitch'), 'b') $$,
  'P0001', 'event cannot be entered', 'a training is entered only once'
);
select throws_ok(
  $$ select public.attach_events_to_pitch((select id from ids where key = 'late'), (select id from ids where key = 'pitch'), 'b') $$,
  'P0001', 'outside the bookable times', 'times outside 15:00–20:30 cannot be entered'
);

-- A series of three weekly trainings at 18:30–20:00; the first date is taken on half A.
select public.create_training_series(
  (select id from ids where key = 'team'), extract(dow from d1)::int, '18:30', 90, null,
  d1, d1 + 14,
  array[
    (d1 + time '18:30') at time zone 'Europe/Berlin',
    (d1 + 7 + time '18:30') at time zone 'Europe/Berlin',
    (d1 + 14 + time '18:30') at time zone 'Europe/Berlin'
  ]
) from d;
select public.book_pitch((select id from ids where key = 'pitch'), (select id from ids where key = 'team'),
  'a', '19:00', '19:30', d1, d1) from d;
select is(
  (public.attach_events_to_pitch(
     (select e.id from public.events e join public.event_series s on s.id = e.series_id
      where s.team_id = (select id from ids where key = 'team') order by e.starts_at desc limit 1),
     (select id from ids where key = 'pitch'), 'a', true)) ->> 'booked',
  '2', 'a whole series is entered; a taken date is skipped'
);
select is(
  (select count(*)::int from public.events e join public.event_series s on s.id = e.series_id
   where s.team_id = (select id from ids where key = 'team') and e.booking_id is null),
  1, 'the skipped training stays without a pitch'
);
select is(
  (select count(*)::int from public.slot_booking_exceptions x join public.slot_bookings b on b.id = x.booking_id
   where b.team_id = (select id from ids where key = 'team') and b.start_time = '18:30'),
  0, 'no gaps inside the entered weeks'
);

select * from finish();
rollback;
