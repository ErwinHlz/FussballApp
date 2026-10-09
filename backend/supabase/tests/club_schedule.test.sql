-- Club schedule: pitches, weekly slots, bookings and the trainings they create.
begin;
create extension if not exists pgtap with schema extensions;

select plan(25);

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

-- The slot is on tomorrow's weekday, 17:00–18:30, for eight weeks.
create temp table d as select (current_date + 1) as d1, (current_date + 8) as d2, (current_date + 15) as d3;
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
with s as (
  insert into public.pitch_slots (club_id, pitch_id, weekday, start_time, end_time, valid_from, valid_until)
  select (select id from ids where key = 'club'), (select id from ids where key = 'pitch'),
    extract(dow from d1)::int, '17:00', '18:30', current_date, current_date + 55
  from d
  returning id
)
insert into ids (key, id) select 'slot', id from s;

select throws_ok(
  $$ insert into public.pitch_slots (club_id, pitch_id, weekday, start_time, end_time, valid_from, valid_until)
     select (select id from ids where key = 'club'), (select id from ids where key = 'pitch'),
       extract(dow from d1)::int, '18:00', '19:00', current_date, current_date + 10 from d $$,
  'P0001', null, 'overlapping slots on the same pitch are refused'
);

select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000002');
select public.accept_team_invite((select token from ids where key = 'inviteA'));
select pg_temp.act_as('cccccccc-0000-0000-0000-000000000003');
select public.accept_team_invite((select token from ids where key = 'inviteB'));
select pg_temp.act_as('dddddddd-0000-0000-0000-000000000004');
select public.accept_team_invite((select token from ids where key = 'inviteP'));

-- Reading and managing
select is((select count(*)::int from public.pitch_slots), 1, 'players read the club schedule');
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

-- Coach A books half A every week.
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000002');
select is(
  (public.book_slot((select id from ids where key = 'slot'), (select id from ids where key = 'teamA'), 'a', current_date)) ->> 'booked',
  '8', 'a weekly booking covers the rest of the season'
);
insert into ids (key, id) select 'bookingA', id from public.slot_bookings where team_id = (select id from ids where key = 'teamA');
select is(
  (select count(*)::int from public.events where booking_id = (select id from ids where key = 'bookingA')),
  8, 'the booking creates the trainings'
);
select is(
  (select to_char(starts_at at time zone 'Europe/Berlin', 'HH24:MI') || ' ' || location from public.events
   where booking_id = (select id from ids where key = 'bookingA') order by starts_at limit 1),
  '17:00 Kunstrasen · A', 'trainings start at the local slot time on the booked half'
);
reset role;
select is(
  (select count(*)::int from public.notification_outbox
   where kind = 'series_created' and event_id in (select id from public.events where booking_id = (select id from ids where key = 'bookingA'))),
  1, 'the team gets one notification for the series'
);
set local role authenticated;
select throws_ok(
  $$ select public.book_slot((select id from ids where key = 'slot'), (select id from ids where key = 'teamB'), 'b', current_date) $$,
  '42501', null, 'coaches cannot book for other teams'
);

-- Coach B: the full pitch is taken, half B is free.
select pg_temp.act_as('cccccccc-0000-0000-0000-000000000003');
select throws_ok(
  $$ select public.book_slot((select id from ids where key = 'slot'), (select id from ids where key = 'teamB'), 'full', current_date) $$,
  'P0001', null, 'the full pitch cannot be booked while a half is taken'
);
select is(
  (public.book_slot((select id from ids where key = 'slot'), (select id from ids where key = 'teamB'), 'b', (select d1 from d), (select d1 from d))) ->> 'booked',
  '1', 'the other half can be booked for one date'
);
select is(
  (select count(*)::int from public.events e join public.slot_bookings b on b.id = e.booking_id
   where b.team_id = (select id from ids where key = 'teamB') and e.series_id is null),
  1, 'a single date creates a single training'
);

-- Players cannot book or release.
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
  (public.book_slot((select id from ids where key = 'slot'), (select id from ids where key = 'teamB'), 'a', (select d2 from d), (select d2 from d))) ->> 'booked',
  '1', 'another team books the released half'
);
-- A weekly booking of half A now skips the dates still held by team A.
select throws_ok(
  $$ select public.book_slot((select id from ids where key = 'slot'), (select id from ids where key = 'teamB'), 'a', (select d3 from d)) $$,
  'P0001', null, 'a weekly booking fails when every date is taken'
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

-- Deleting the slot cancels all upcoming trainings.
select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');
delete from public.pitch_slots where id = (select id from ids where key = 'slot');
select is(
  (select count(*)::int from public.events e
   where e.team_id in (select id from ids where key in ('teamA', 'teamB')) and not e.is_cancelled),
  0, 'deleting the slot cancels the trainings'
);
select is(
  (select count(*)::int from public.events e where e.team_id in (select id from ids where key in ('teamA', 'teamB'))),
  10, 'cancelled trainings stay visible to the team'
);

-- Deleting the whole club (e.g. account deletion) works with bookings in place.
reset role;
insert into public.pitch_slots (club_id, pitch_id, weekday, start_time, end_time, valid_from, valid_until)
select (select id from ids where key = 'club'), (select id from ids where key = 'pitch'),
  extract(dow from d1)::int, '17:00', '18:30', current_date, current_date + 20 from d;
set local role authenticated;
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000002');
select public.book_slot(
  (select id from public.pitch_slots limit 1), (select id from ids where key = 'teamA'), 'full', current_date
);
reset role;
select lives_ok(
  $$ delete from public.clubs where id = (select id from ids where key = 'club') $$,
  'a club with bookings can be deleted'
);

select * from finish();
rollback;
