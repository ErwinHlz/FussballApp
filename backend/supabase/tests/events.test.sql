-- Events, attendance and match squad checks (Phase 4). Run with `npm run test:db`.
begin;
create extension if not exists pgtap with schema extensions;

select plan(26);

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'admin.a@example.test', '{"display_name": "Admin A"}'),
  ('cccccccc-0000-0000-0000-000000000003', 'coach.c@example.test', '{"display_name": "Coach C"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'player.p@example.test', '{"display_name": "Player P"}'),
  ('eeeeeeee-0000-0000-0000-000000000005', 'player.q@example.test', '{"display_name": "Player Q"}'),
  ('dddddddd-0000-0000-0000-000000000004', 'outsider.x@example.test', '{"display_name": "Outsider X"}');

create function pg_temp.act_as(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;

create temp table ids (key text primary key, id uuid, token text);
grant all on ids to authenticated, anon;

set local role authenticated;

-- Setup: club, team, coach, two players, one manual injured player.
select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');
insert into ids (key, id) select 'club', (public.create_club('FC Termine')).id;
with t as (insert into public.teams (club_id, name) select id, 'U15' from ids where key = 'club' returning id)
insert into ids (key, id) select 'team', id from t;
with c as (insert into public.team_invites (team_id, role) select id, 'coach' from ids where key = 'team' returning token)
insert into ids (key, token) select 'coach_invite', token from c;
with p as (insert into public.team_invites (team_id, role) select id, 'player' from ids where key = 'team' returning token)
insert into ids (key, token) select 'player_invite', token from p;

select pg_temp.act_as('cccccccc-0000-0000-0000-000000000003');
select public.accept_team_invite((select token from ids where key = 'coach_invite'));
with m as (
  insert into public.team_members (team_id, display_name, status)
  select id, 'Injured Ivo', 'injured' from ids where key = 'team' returning id
)
insert into ids (key, id) select 'ivo', id from m;

select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000002');
select public.accept_team_invite((select token from ids where key = 'player_invite'));
insert into ids (key, id) select 'p', id from public.team_members where user_id = 'bbbbbbbb-0000-0000-0000-000000000002';

select pg_temp.act_as('eeeeeeee-0000-0000-0000-000000000005');
select public.accept_team_invite((select token from ids where key = 'player_invite'));
insert into ids (key, id) select 'q', id from public.team_members where user_id = 'eeeeeeee-0000-0000-0000-000000000005';

-- ---- Coach creates events ---------------------------------------------------------------
select pg_temp.act_as('cccccccc-0000-0000-0000-000000000003');
with e as (
  insert into public.events (team_id, type, starts_at, ends_at, location)
  select id, 'training', now() + interval '2 days', now() + interval '2 days 90 minutes', 'Platz 1'
  from ids where key = 'team' returning id
)
insert into ids (key, id) select 'training', id from e;
select isnt((select id from ids where key = 'training'), null, 'coach creates a training');

with e as (
  insert into public.events (team_id, type, starts_at, meet_at, opponent, is_home, competition, response_deadline)
  select id, 'match', now() + interval '5 days', now() + interval '5 days' - interval '1 hour',
    'SV Gegner', true, 'league', now() + interval '4 days'
  from ids where key = 'team' returning id
)
insert into ids (key, id) select 'match', id from e;
select isnt((select id from ids where key = 'match'), null, 'coach creates a match');

select throws_ok(
  $$ insert into public.events (team_id, type, starts_at) select id, 'match', now() from ids where key = 'team' $$,
  '23514', null, 'a match needs an opponent'
);

select is(
  (select status::text || '/' || reason || '/' || coalesce(updated_by::text, 'system')
   from public.attendances
   where event_id = (select id from ids where key = 'training') and member_id = (select id from ids where key = 'ivo')),
  'no/injured/system',
  'injured players are pre-filled as "no (injured)" by the system'
);

-- Series: 3 Tuesdays, deadline 24h before.
select is(
  (public.create_training_series(
    (select id from ids where key = 'team'), 2, '19:00', 90, 'Halle', '2030-01-01', '2030-01-21',
    array['2030-01-01 18:00+00', '2030-01-08 18:00+00', '2030-01-15 18:00+00']::timestamptz[], 24
  )).weekday,
  2,
  'coach creates a training series'
);
select is(
  (select count(*)::int from public.events where series_id is not null and response_deadline = starts_at - interval '24 hours' and ends_at = starts_at + interval '90 minutes'),
  3,
  'series creates one event per date with deadline and end time'
);

-- Coach answers for the manual player (no account). Upsert like the app: Ivo already has
-- the pre-filled "injured" answer.
insert into public.attendances (event_id, member_id, status)
select (select id from ids where key = 'match'), (select id from ids where key = 'ivo'), 'maybe'
on conflict (event_id, member_id) do update set status = excluded.status, reason = null, reason_note = null;
select is(
  (select status::text from public.attendances where event_id = (select id from ids where key = 'match') and member_id = (select id from ids where key = 'ivo')),
  'maybe',
  'coach answers for players without account'
);

-- ---- Player answers ----------------------------------------------------------------------
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000002');
select is((select count(*)::int from public.events), 5, 'player sees all team events');
select throws_ok(
  $$ insert into public.events (team_id, type, starts_at) select id, 'training', now() from ids where key = 'team' $$,
  '42501', null, 'player cannot create events'
);

select lives_ok(
  $$ insert into public.attendances (event_id, member_id, status) select (select id from ids where key = 'training'), (select id from ids where key = 'p'), 'yes' $$,
  'player answers yes'
);
select is(
  (select updated_by from public.attendances where event_id = (select id from ids where key = 'training') and member_id = (select id from ids where key = 'p')),
  'bbbbbbbb-0000-0000-0000-000000000002'::uuid,
  'answer records who changed it'
);
update public.attendances set status = 'no', reason = 'work', reason_note = 'Spätschicht'
where event_id = (select id from ids where key = 'training') and member_id = (select id from ids where key = 'p');
select is(
  (select status::text || '/' || reason from public.attendances where event_id = (select id from ids where key = 'training') and member_id = (select id from ids where key = 'p')),
  'no/work',
  'player changes answer to no with reason'
);
select throws_ok(
  $$ insert into public.attendances (event_id, member_id, status) select (select id from ids where key = 'training'), (select id from ids where key = 'q'), 'yes' $$,
  '42501', null, 'player cannot answer for someone else'
);
select throws_ok(
  $$ insert into public.attendances (event_id, member_id, status, reason) select (select id from ids where key = 'training'), (select id from ids where key = 'q'), 'yes', 'sick' $$,
  null, null, 'a reason is only allowed for "no"'
);

-- Deadline passed / cancelled.
select pg_temp.act_as('cccccccc-0000-0000-0000-000000000003');
update public.events set response_deadline = now() - interval '1 minute' where id = (select id from ids where key = 'match');
with e as (
  insert into public.events (team_id, type, starts_at)
  select id, 'training', now() + interval '3 days' from ids where key = 'team' returning id
)
insert into ids (key, id) select 'cancelled', id from e;
update public.events set is_cancelled = true, cancel_reason = 'Platz gesperrt' where id = (select id from ids where key = 'cancelled');

select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000002');
select throws_ok(
  $$ insert into public.attendances (event_id, member_id, status) select (select id from ids where key = 'match'), (select id from ids where key = 'p'), 'yes' $$,
  '42501', null, 'player cannot answer after the deadline'
);
update public.attendances set status = 'yes', reason = null, reason_note = null
where event_id = (select id from ids where key = 'training') and member_id = (select id from ids where key = 'p');
select throws_ok(
  $$ insert into public.attendances (event_id, member_id, status) select (select id from ids where key = 'cancelled'), (select id from ids where key = 'p'), 'yes' $$,
  '42501', null, 'player cannot answer for cancelled events'
);

select pg_temp.act_as('cccccccc-0000-0000-0000-000000000003');
select lives_ok(
  $$ insert into public.attendances (event_id, member_id, status) select (select id from ids where key = 'match'), (select id from ids where key = 'p'), 'yes' $$,
  'coach can still change answers after the deadline'
);

-- ---- Match squad -------------------------------------------------------------------------
select lives_ok(
  $$ select public.set_match_squad((select id from ids where key = 'match'),
       jsonb_build_array(jsonb_build_object('member_id', (select id from ids where key = 'p'), 'role', 'starter'))) $$,
  'coach nominates the match squad'
);
select throws_ok(
  $$ select public.set_match_squad((select id from ids where key = 'training'), '[]'::jsonb) $$,
  'P0001', null, 'only matches have a squad'
);

select pg_temp.act_as('eeeeeeee-0000-0000-0000-000000000005');
select is(
  (select role::text from public.match_squad where event_id = (select id from ids where key = 'match')),
  'starter',
  'players see the nomination'
);
select throws_ok(
  $$ select public.set_match_squad((select id from ids where key = 'match'), jsonb_build_array(jsonb_build_object('member_id', (select id from ids where key = 'q'), 'role', 'starter'))) $$,
  '42501', null, 'players cannot nominate'
);

-- ---- Outsider ----------------------------------------------------------------------------
select pg_temp.act_as('dddddddd-0000-0000-0000-000000000004');
select is(
  (select count(*)::int from public.events) + (select count(*)::int from public.attendances),
  0,
  'outsider sees no events or answers'
);

-- ---- Linking keeps answers -----------------------------------------------------------------
-- Q's account entry is linked into the manual entry "Ivo": Q's own answer must survive.
select pg_temp.act_as('eeeeeeee-0000-0000-0000-000000000005');
insert into public.attendances (event_id, member_id, status)
select (select id from ids where key = 'training'), (select id from ids where key = 'q'), 'yes';

select pg_temp.act_as('cccccccc-0000-0000-0000-000000000003');
select public.link_team_member((select id from ids where key = 'ivo'), (select id from ids where key = 'q'));
select is(
  (select status::text from public.attendances
   where event_id = (select id from ids where key = 'training') and member_id = (select id from ids where key = 'ivo')),
  'yes',
  'linking keeps the account''s own answer over the coach-entered one'
);

-- ---- set_attendance RPC (used by the app) ------------------------------------------------
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000002');
select is(
  (public.set_attendance((select id from ids where key = 'training'), (select id from ids where key = 'p'), 'no', 'sick', '  Grippe ')).reason_note,
  'Grippe',
  'set_attendance stores reason and trimmed note'
);
select throws_ok(
  $$ select public.set_attendance((select id from ids where key = 'match'), (select id from ids where key = 'p'), 'no') $$,
  '42501', null, 'set_attendance respects the deadline for players'
);
select is(
  (public.set_attendance((select id from ids where key = 'training'), (select id from ids where key = 'p'), 'yes', 'sick', 'x')).reason,
  null,
  'set_attendance clears the reason for yes'
);

select * from finish();
rollback;
