-- Absence checks. Run with `npm run test:db`.
begin;
create extension if not exists pgtap with schema extensions;

select plan(13);

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'admin.a@example.test', '{"display_name": "Admin A"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'player.p@example.test', '{"display_name": "Player P"}'),
  ('eeeeeeee-0000-0000-0000-000000000005', 'player.q@example.test', '{"display_name": "Player Q"}'),
  ('dddddddd-0000-0000-0000-000000000004', 'outsider.x@example.test', '{"display_name": "Outsider X"}');

create function pg_temp.act_as(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;

create temp table ids (key text primary key, id uuid, token text);
grant all on ids to authenticated, anon;

set local role authenticated;

select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');
insert into ids (key, id) select 'club', (public.create_club('FC Urlaub')).id;
with t as (insert into public.teams (club_id, name) select id, 'U16' from ids where key = 'club' returning id)
insert into ids (key, id) select 'team', id from t;
with p as (insert into public.team_invites (team_id, role) select id, 'player' from ids where key = 'team' returning token)
insert into ids (key, token) select 'invite', token from p;
with m as (insert into public.team_members (team_id, display_name) select id, 'Manual Mo' from ids where key = 'team' returning id)
insert into ids (key, id) select 'mo', id from m;

-- Events: two inside the vacation (days 3 and 5), one after (day 20), one inside but past the deadline.
insert into ids (key, id) values ('e3', gen_random_uuid()), ('e5', gen_random_uuid()), ('e20', gen_random_uuid()), ('closed', gen_random_uuid());
insert into public.events (id, team_id, type, starts_at, response_deadline)
select (select id from ids where key = 'e3'), id, 'training', now() + interval '3 days', null from ids where key = 'team';
insert into public.events (id, team_id, type, starts_at, response_deadline)
select (select id from ids where key = 'e5'), id, 'training', now() + interval '5 days', null from ids where key = 'team';
insert into public.events (id, team_id, type, starts_at, response_deadline)
select (select id from ids where key = 'e20'), id, 'training', now() + interval '20 days', null from ids where key = 'team';
insert into public.events (id, team_id, type, starts_at, response_deadline)
select (select id from ids where key = 'closed'), id, 'training', now() + interval '4 days', now() - interval '1 hour' from ids where key = 'team';

select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000002');
select public.accept_team_invite((select token from ids where key = 'invite'));
insert into ids (key, id) select 'p', id from public.team_members where user_id = 'bbbbbbbb-0000-0000-0000-000000000002';
select pg_temp.act_as('eeeeeeee-0000-0000-0000-000000000005');
select public.accept_team_invite((select token from ids where key = 'invite'));
insert into ids (key, id) select 'q', id from public.team_members where user_id = 'eeeeeeee-0000-0000-0000-000000000005';

-- Player P answered "yes" for day 5 before planning the vacation.
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000002');
select public.set_attendance((select id from ids where key = 'e5'), (select id from ids where key = 'p'), 'yes');

select is(
  public.create_absences(array[(select id from ids where key = 'p')], now() + interval '1 day', now() + interval '10 days', 'vacation', 'Mallorca'),
  1,
  'vacation declines open events in the period (own yes kept, closed event skipped)'
);
select is(
  (select status::text || '/' || reason || '/' || reason_note from public.attendances where event_id = (select id from ids where key = 'e3') and member_id = (select id from ids where key = 'p')),
  'no/vacation/Mallorca',
  'the declined answer carries reason and note'
);
select is(
  (select status::text from public.attendances where event_id = (select id from ids where key = 'e5') and member_id = (select id from ids where key = 'p')),
  'yes',
  'an explicit own answer wins'
);
select is(
  (select count(*)::int from public.attendances where event_id = (select id from ids where key = 'closed') and member_id = (select id from ids where key = 'p')),
  0,
  'events past the deadline are not changed by players'
);
select is(
  (select count(*)::int from public.attendances where event_id = (select id from ids where key = 'e20') and member_id = (select id from ids where key = 'p')),
  0,
  'events after the period are not touched'
);

select throws_ok(
  $$ select public.create_absences(array[(select id from ids where key = 'q')], now(), now() + interval '2 days', 'sick') $$,
  '42501', null, 'players cannot enter absences for others'
);
select throws_ok(
  $$ insert into public.absences (member_id, starts_at, ends_at, reason) values ((select id from ids where key = 'p'), now(), now() + interval '1 day', 'sick') $$,
  '42501', null, 'absences are only written via the RPC'
);

-- Coach: enters an absence for a player without account, also past the deadline.
select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');
select is(
  public.create_absences(array[(select id from ids where key = 'mo')], now(), now() + interval '6 days', 'injured'),
  3,
  'coaches enter absences for anyone, including closed events'
);

-- A new event inside the period is declined right away.
insert into ids (key, id) values ('new', gen_random_uuid());
insert into public.events (id, team_id, type, starts_at, opponent)
select (select id from ids where key = 'new'), id, 'match', now() + interval '6 days', 'FC Gegner' from ids where key = 'team';
select is(
  (select status::text || '/' || reason from public.attendances where event_id = (select id from ids where key = 'new') and member_id = (select id from ids where key = 'p')),
  'no/vacation',
  'new events inside an absence are declined automatically'
);

-- Teammates see who is away.
select pg_temp.act_as('eeeeeeee-0000-0000-0000-000000000005');
select is((select count(*)::int from public.absences), 2, 'the team sees absences');

select pg_temp.act_as('dddddddd-0000-0000-0000-000000000004');
select is((select count(*)::int from public.absences), 0, 'outsiders see no absences');

-- Changing the own answer makes it manual; deleting the absence removes only automatic ones.
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000002');
select public.set_attendance((select id from ids where key = 'e3'), (select id from ids where key = 'p'), 'maybe');
select public.delete_absence((select id from public.absences where member_id = (select id from ids where key = 'p')));
select is(
  (select status::text from public.attendances where event_id = (select id from ids where key = 'e3') and member_id = (select id from ids where key = 'p')),
  'maybe',
  'manual answers survive deleting the absence'
);
select is(
  (select count(*)::int from public.attendances where event_id = (select id from ids where key = 'new') and member_id = (select id from ids where key = 'p')),
  0,
  'automatic declines disappear with the absence'
);

select * from finish();
rollback;
