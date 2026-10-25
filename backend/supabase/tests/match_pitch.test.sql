-- Home matches on a club pitch: stored pitch, consistency rules, blocking of the pitch for
-- trainings and the club-wide list for the schedule.
begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

insert into auth.users (id, email, raw_user_meta_data) values
  ('a3a3a3a3-0000-0000-0000-000000000001', 'coach.m@example.test', '{"display_name": "Coach M"}'),
  ('b3b3b3b3-0000-0000-0000-000000000002', 'player.m@example.test', '{"display_name": "Player M"}'),
  ('c3c3c3c3-0000-0000-0000-000000000003', 'other.m@example.test', '{"display_name": "Other M"}');

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

-- Another club with its own pitch.
select pg_temp.act_as('c3c3c3c3-0000-0000-0000-000000000003');
insert into ids (key, id) select 'other_club', (public.create_club('FC Fremd')).id;
with p as (insert into public.pitches (club_id, name) select id, 'Fremdplatz' from ids where key = 'other_club' returning id)
insert into ids (key, id) select 'other_pitch', id from p;

-- Club with two teams, a splittable and a whole pitch; the player is in the second team.
select pg_temp.act_as('a3a3a3a3-0000-0000-0000-000000000001');
insert into ids (key, id) select 'club', (public.create_club('SV Heimspiel')).id;
with t as (insert into public.teams (club_id, name) select id, 'Erste' from ids where key = 'club' returning id)
insert into ids (key, id) select 'team', id from t;
with t as (insert into public.teams (club_id, name) select id, 'Zweite' from ids where key = 'club' returning id)
insert into ids (key, id) select 'team2', id from t;
with i as (insert into public.team_invites (team_id, role) select id, 'player' from ids where key = 'team2' returning token)
insert into ids (key, token) select 'invite', token from i;
with p as (insert into public.pitches (club_id, name) select id, 'Rasen' from ids where key = 'club' returning id)
insert into ids (key, id) select 'pitch', id from p;
with p as (insert into public.pitches (club_id, name, splittable) select id, 'Kleinfeld', false from ids where key = 'club' returning id)
insert into ids (key, id) select 'small', id from p;

-- Home match on half A: meeting 17:30, kick-off 18:00, no end → holds the pitch 17:30–20:00.
with e as (
  insert into public.events (team_id, type, starts_at, meet_at, opponent, is_home, pitch_id, pitch_part)
  select (select id from ids where key = 'team'), 'match',
    (d1 + time '18:00') at time zone 'Europe/Berlin', (d1 + time '17:30') at time zone 'Europe/Berlin',
    'FC Gast', true, (select id from ids where key = 'pitch'), 'a'
  from d returning id
)
insert into ids (key, id) select 'match', id from e;
select is(
  (select pitch_part::text from public.events where id = (select id from ids where key = 'match')),
  'a', 'a home match keeps its pitch and half'
);

-- Without a part the whole pitch is meant.
with e as (
  insert into public.events (team_id, type, starts_at, opponent, is_home, pitch_id)
  select (select id from ids where key = 'team'), 'match',
    (d1 + 3 + time '11:00') at time zone 'Europe/Berlin', 'FC Ganz', true, (select id from ids where key = 'pitch')
  from d returning id
)
insert into ids (key, id) select 'whole', id from e;
select is(
  (select pitch_part::text from public.events where id = (select id from ids where key = 'whole')),
  'full', 'without a part the whole pitch is taken'
);

-- An away match has no pitch: it is dropped instead of refused.
update public.events set is_home = false where id = (select id from ids where key = 'whole');
select ok(
  (select pitch_id is null and pitch_part is null from public.events where id = (select id from ids where key = 'whole')),
  'switching a match to away drops its pitch'
);

select throws_ok(
  $$ insert into public.events (team_id, type, starts_at, opponent, is_home, pitch_id)
     select (select id from ids where key = 'team'), 'match', now() + interval '3 days', 'X', true,
       (select id from ids where key = 'other_pitch') $$,
  '42501', null, 'a pitch of another club is refused'
);
select throws_ok(
  $$ insert into public.events (team_id, type, starts_at, opponent, is_home, pitch_id, pitch_part)
     select (select id from ids where key = 'team'), 'match', now() + interval '3 days', 'X', true,
       (select id from ids where key = 'small'), 'b' $$,
  'P0001', 'pitch cannot be split', 'a pitch that cannot be split has no halves'
);
with e as (
  insert into public.events (team_id, type, starts_at, pitch_id)
  select (select id from ids where key = 'team'), 'training', now() + interval '3 days',
    (select id from ids where key = 'pitch')
  returning pitch_id
)
select ok((select pitch_id is null from e), 'only matches keep a pitch');

-- Trainings cannot be booked into the match's time on the same half …
select throws_ok(
  $$ select public.book_pitch((select id from ids where key = 'pitch'), (select id from ids where key = 'team2'),
       'a', '19:00', '20:00', d1, d1) from d $$,
  'P0001', 'time is taken', 'the home match blocks its half for trainings'
);
select throws_ok(
  $$ select public.book_pitch((select id from ids where key = 'pitch'), (select id from ids where key = 'team2'),
       'full', '17:00', '18:00', d1, d1) from d $$,
  'P0001', 'time is taken', 'the whole pitch overlaps the match on half A'
);
-- … but the other half and other times stay free.
select is(
  (public.book_pitch((select id from ids where key = 'pitch'), (select id from ids where key = 'team2'),
     'b', '18:00', '19:30', (select d1 from d), (select d1 from d))) ->> 'booked',
  '1', 'the other half is free'
);

-- The player of the other team sees the match in the schedule, outsiders do not.
select pg_temp.act_as('b3b3b3b3-0000-0000-0000-000000000002');
select public.accept_team_invite((select token from ids where key = 'invite'));
select is(
  (select string_agg(opponent || ' ' || to_char(occupied_from at time zone 'Europe/Berlin', 'HH24:MI')
     || '-' || to_char(occupied_until at time zone 'Europe/Berlin', 'HH24:MI'), ', ')
   from public.club_pitch_matches((select id from ids where key = 'club'), (select d1 from d), (select d1 + 7 from d))),
  'FC Gast 17:30-20:00', 'club members see home matches on club pitches with their occupied time'
);
select pg_temp.act_as('c3c3c3c3-0000-0000-0000-000000000003');
select is(
  (select count(*)::int from public.club_pitch_matches((select id from ids where key = 'club'), (select d1 from d), (select d1 + 7 from d))),
  0, 'outsiders see no matches of the club'
);

-- A cancelled match frees the pitch again.
select pg_temp.act_as('a3a3a3a3-0000-0000-0000-000000000001');
update public.events set is_cancelled = true where id = (select id from ids where key = 'match');
select is(
  (public.book_pitch((select id from ids where key = 'pitch'), (select id from ids where key = 'team'),
     'a', '19:00', '20:00', (select d1 from d), (select d1 from d))) ->> 'booked',
  '1', 'a cancelled match no longer blocks the pitch'
);

select * from finish();
rollback;
