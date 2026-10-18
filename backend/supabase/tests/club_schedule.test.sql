-- Club schedule: pitches, bookings of time ranges (Mon–Fri 15:00–20:30, 30-minute steps) and
-- the trainings they create.
begin;
create extension if not exists pgtap with schema extensions;

select plan(28);

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'admin@example.test', '{"display_name": "Admin"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'coach.a@example.test', '{"display_name": "Coach A"}'),
  ('cccccccc-0000-0000-0000-000000000003', 'coach.b@example.test', '{"display_name": "Coach B"}'),
  ('dddddddd-0000-0000-0000-000000000004', 'player@example.test', '{"display_name": "Player"}'),
  ('eeeeeeee-0000-0000-0000-000000000005', 'stranger@example.test', '{"display_name": "Stranger"}');

create function pg_temp.act_as(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;

create temp table ids (key text primary key, id uuid, token text);
grant all on ids to authenticated, anon;

-- d1: the next weekday (Mon–Fri) from tomorrow on; d2, d3 the same weekday one and two weeks
-- later; sat: the next Saturday.
create temp table d as
select d1, d1 + 7 as d2, d1 + 14 as d3, d1 + 49 as d8,
  (select x::date from generate_series(current_date + 1, current_date + 7, interval '1 day') x
   where extract(dow from x) = 6) as sat
from (
  select min(x)::date as d1 from generate_series(current_date + 1, current_date + 7, interval '1 day') x
  where extract(dow from x) between 1 and 5
) s;
grant select on d to authenticated;

set local role authenticated;
select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');
insert into ids (key, id) select 'club', (public.create_club('FC Plan')).id;
with t as (insert into public.teams (club_id, name) select id, 'U17' from ids where key = 'club' returning id)
insert into ids (key, id) select 'teamA', id from t;
with t as (insert into public.teams (club_id, name) select id, 'U19' from ids where key = 'club' returning id)
insert into ids (key, id) select 'teamB', id from t;
with i as (insert into public.team_invites (team_id, role) select id, 'coach' from ids where key = 'teamA' returning token)
insert into ids (key, token) select 'inviteA', token from i;
with i as (insert into public.team_invites (team_id, role) select id, 'coach' from ids where key = 'teamB' returning token)
insert into ids (key, token) select 'inviteB', token from i;
with i as (insert into public.team_invites (team_id, role) select id, 'player' from ids where key = 'teamA' returning token)
insert into ids (key, token) select 'inviteP', token from i;

with p as (insert into public.pitches (club_id, name) select id, 'Kunstrasen' from ids where key = 'club' returning id)
insert into ids (key, id) select 'pitch', id from p;

select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000002');
select public.accept_team_invite((select token from ids where key = 'inviteA'));
select pg_temp.act_as('cccccccc-0000-0000-0000-000000000003');
select public.accept_team_invite((select token from ids where key = 'inviteB'));
select pg_temp.act_as('dddddddd-0000-0000-0000-000000000004');
select public.accept_team_invite((select token from ids where key = 'inviteP'));

-- Reading and managing
select is((select count(*)::int from public.pitches), 1, 'players read the pitches');
select pg_temp.act_as('cccccccc-0000-0000-0000-000000000003');
select is(
  (select array_agg(name order by name) from public.club_team_names((select id from ids where key = 'club'))),
  array['U17', 'U19'], 'coaches see the names of all club teams'
);
select throws_ok(
  $$ insert into public.pitches (club_id, name) select id, 'Halle' from ids where key = 'club' $$,
  '42501', null, 'coaches cannot create pitches'
);
select pg_temp.act_as('eeeeeeee-0000-0000-0000-000000000005');
select is((select count(*)::int from public.pitches), 0, 'strangers do not see the schedule');
select is(
  (select count(*)::int from public.club_team_names((select id from ids where key = 'club'))), 0,
  'strangers do not see team names'
);

-- Only Monday to Friday, 15:00–20:30, in 30-minute steps.
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000002');
select throws_ok(
  $$ select public.book_pitch((select id from ids where key = 'pitch'), (select id from ids where key = 'teamA'),
       'a', '17:00', '18:30', (select sat from d), (select sat from d)) $$,
  'P0001', 'outside the bookable times', 'weekends cannot be booked'
);
select throws_ok(
  $$ select public.book_pitch((select id from ids where key = 'pitch'), (select id from ids where key = 'teamA'),
       'a', '19:30', '21:00', (select d1 from d), (select d1 from d)) $$,
  'P0001', 'outside the bookable times', 'nothing after 20:30'
);
select throws_ok(
  $$ select public.book_pitch((select id from ids where key = 'pitch'), (select id from ids where key = 'teamA'),
       'a', '17:15', '18:30', (select d1 from d), (select d1 from d)) $$,
  'P0001', 'outside the bookable times', 'only full or half hours'
);

-- Coach A books half A every week for eight weeks.
select is(
  (public.book_pitch((select id from ids where key = 'pitch'), (select id from ids where key = 'teamA'),
     'a', '17:00', '18:30', (select d1 from d), (select d8 from d))) ->> 'booked',
  '8', 'a weekly booking covers every week of the range'
);
insert into ids (key, id) select 'bookingA', id from public.slot_bookings where team_id = (select id from ids where key = 'teamA');
select is(
  (select count(*)::int from public.events where booking_id = (select id from ids where key = 'bookingA')),
  8, 'the booking creates the trainings'
);
select is(
  (select to_char(starts_at at time zone 'Europe/Berlin', 'HH24:MI') || '-' ||
     to_char(ends_at at time zone 'Europe/Berlin', 'HH24:MI') || ' ' || location from public.events
   where booking_id = (select id from ids where key = 'bookingA') order by starts_at limit 1),
  '17:00-18:30 Kunstrasen · A', 'trainings take the booked times and half'
);
reset role;
select is(
  (select count(*)::int from public.notification_outbox
   where kind = 'series_created' and event_id in (select id from public.events where booking_id = (select id from ids where key = 'bookingA'))),
  1, 'the team gets one notification for the series'
);
set local role authenticated;
select throws_ok(
  $$ select public.book_pitch((select id from ids where key = 'pitch'), (select id from ids where key = 'teamB'),
       'b', '17:00', '18:00', (select d1 from d), (select d1 from d)) $$,
  '42501', null, 'coaches cannot book for other teams'
);

-- Coach B: the full pitch overlaps half A, half B is free, right after half A is free too.
select pg_temp.act_as('cccccccc-0000-0000-0000-000000000003');
select throws_ok(
  $$ select public.book_pitch((select id from ids where key = 'pitch'), (select id from ids where key = 'teamB'),
       'full', '18:00', '19:00', (select d1 from d), (select d1 from d)) $$,
  'P0001', 'time is taken', 'the full pitch cannot be booked over a taken half'
);
select is(
  (public.book_pitch((select id from ids where key = 'pitch'), (select id from ids where key = 'teamB'),
     'b', '17:00', '18:30', (select d1 from d), (select d1 from d))) ->> 'booked',
  '1', 'the other half can be booked for one date'
);
select is(
  (public.book_pitch((select id from ids where key = 'pitch'), (select id from ids where key = 'teamB'),
     'a', '18:30', '20:00', (select d1 from d), (select d1 from d))) ->> 'booked',
  '1', 'a booking may start where another ends'
);
select is(
  (select count(*)::int from public.events e join public.slot_bookings b on b.id = e.booking_id
   where b.team_id = (select id from ids where key = 'teamB') and e.series_id is null),
  2, 'single dates create single trainings'
);

-- Players cannot release.
select pg_temp.act_as('dddddddd-0000-0000-0000-000000000004');
select throws_ok(
  $$ select public.release_slot_date((select id from ids where key = 'bookingA'), (select d2 from d)) $$,
  '42501', null, 'players cannot release bookings'
);

-- Coach A gives back one date: the training is cancelled, the half is free for others.
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000002');
select lives_ok(
  $$ select public.release_slot_date((select id from ids where key = 'bookingA'), (select d2 from d)) $$,
  'a coach releases one date'
);
select ok(
  (select is_cancelled from public.events where booking_id = (select id from ids where key = 'bookingA')
   and (starts_at at time zone 'Europe/Berlin')::date = (select d2 from d)),
  'the training on the released date is cancelled'
);
select throws_ok(
  $$ select public.release_slot_date((select id from ids where key = 'bookingA'), (select d2 from d)) $$,
  'P0001', null, 'a released date cannot be released twice'
);

select pg_temp.act_as('cccccccc-0000-0000-0000-000000000003');
select is(
  (public.book_pitch((select id from ids where key = 'pitch'), (select id from ids where key = 'teamB'),
     'a', '17:00', '18:00', (select d2 from d), (select d2 from d))) ->> 'booked',
  '1', 'another team books the released half'
);
select throws_ok(
  $$ select public.book_pitch((select id from ids where key = 'pitch'), (select id from ids where key = 'teamB'),
       'a', '17:30', '18:00', (select d3 from d), (select d3 from d)) $$,
  'P0001', 'time is taken', 'a taken date cannot be booked'
);

-- Coach A ends the booking from the third week on.
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000002');
select public.end_slot_booking((select id from ids where key = 'bookingA'), (select d3 from d));
select is(
  (select valid_until from public.slot_bookings where id = (select id from ids where key = 'bookingA')),
  (select d3 - 1 from d), 'ending a booking shortens it'
);
select is(
  (select count(*)::int from public.events where booking_id = (select id from ids where key = 'bookingA') and not is_cancelled),
  1, 'only the first training remains'
);

-- Deleting the pitch cancels all upcoming trainings.
select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');
delete from public.pitches where id = (select id from ids where key = 'pitch');
select is(
  (select count(*)::int from public.events e
   where e.team_id in (select id from ids where key in ('teamA', 'teamB')) and not e.is_cancelled),
  0, 'deleting the pitch cancels the trainings'
);
select is(
  (select count(*)::int from public.events e where e.team_id in (select id from ids where key in ('teamA', 'teamB'))),
  11, 'cancelled trainings stay visible to the team'
);

-- Deleting the whole club (e.g. account deletion) works with bookings in place.
with p as (insert into public.pitches (club_id, name) select id, 'Rasen' from ids where key = 'club' returning id)
insert into ids (key, id) select 'pitch2', id from p;
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000002');
select public.book_pitch(
  (select id from ids where key = 'pitch2'), (select id from ids where key = 'teamA'), 'full',
  '15:00', '16:00', (select d1 from d), (select d3 from d)
);
reset role;
select lives_ok(
  $$ delete from public.clubs where id = (select id from ids where key = 'club') $$,
  'a club with bookings can be deleted'
);

select * from finish();
rollback;
