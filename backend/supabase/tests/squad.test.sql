-- Squad management checks (Phase 3). Run with `npm run test:db`.
begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'admin.a@example.test', '{"display_name": "Admin A"}'),
  ('cccccccc-0000-0000-0000-000000000003', 'coach.c@example.test', '{"display_name": "Coach C"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'player.p@example.test', '{"display_name": "Player P"}'),
  ('dddddddd-0000-0000-0000-000000000004', 'outsider.x@example.test', '{"display_name": "Outsider X"}');

create function pg_temp.act_as(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;

create temp table ids (key text primary key, id uuid, token text);
grant all on ids to authenticated, anon;

set local role authenticated;

-- Setup: admin creates club + team, coach and player join via invites.
select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');
insert into ids (key, id) select 'club', (public.create_club('FC Kader')).id;
with created as (
  insert into public.teams (club_id, name) select id, 'U19' from ids where key = 'club' returning id
)
insert into ids (key, id) select 'team', id from created;
with c as (insert into public.team_invites (team_id, role) select id, 'coach' from ids where key = 'team' returning token)
insert into ids (key, token) select 'coach_invite', token from c;
with p as (insert into public.team_invites (team_id, role) select id, 'player' from ids where key = 'team' returning token)
insert into ids (key, token) select 'player_invite', token from p;

select pg_temp.act_as('cccccccc-0000-0000-0000-000000000003');
select public.accept_team_invite((select token from ids where key = 'coach_invite'));

-- Coach maintains the squad.
with m as (
  insert into public.team_members (team_id, display_name, shirt_number, positions, status)
  select id, 'Manual Max', 7, array['MF', 'FW'], 'injured' from ids where key = 'team'
  returning id
)
insert into ids (key, id) select 'manual', id from m;
select isnt((select id from ids where key = 'manual'), null, 'coach adds a player without account');

select throws_ok(
  $$ insert into public.team_members (team_id, display_name, shirt_number) select id, 'Dup', 7 from ids where key = 'team' $$,
  '23505', null, 'shirt numbers are unique per team'
);
select throws_ok(
  $$ insert into public.team_members (team_id, display_name, positions) select id, 'Bad', array['XX'] from ids where key = 'team' $$,
  '23514', null, 'only known positions are allowed'
);
select throws_ok(
  $$ insert into public.team_members (team_id, user_id, display_name) select id, 'dddddddd-0000-0000-0000-000000000004', 'Sneaky' from ids where key = 'team' $$,
  '42501', null, 'coach cannot add an arbitrary account to the team'
);
select throws_ok(
  $$ update public.team_members set user_id = 'dddddddd-0000-0000-0000-000000000004' where id = (select id from ids where key = 'manual') $$,
  '42501', null, 'coach cannot set user_id directly'
);

update public.team_members set status = 'active', shirt_number = 10 where id = (select id from ids where key = 'manual');
select is(
  (select status::text || '/' || shirt_number from public.team_members where id = (select id from ids where key = 'manual')),
  'active/10',
  'coach changes status and number'
);

-- Player joins via link and only reads the squad.
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000002');
select public.accept_team_invite((select token from ids where key = 'player_invite'));
insert into ids (key, id)
select 'account', id from public.team_members where user_id = 'bbbbbbbb-0000-0000-0000-000000000002';

select is((select count(*)::int from public.team_members), 3, 'player sees the whole squad');
update public.team_members set shirt_number = 99 where id = (select id from ids where key = 'manual');
select is(
  (select shirt_number from public.team_members where id = (select id from ids where key = 'manual')),
  10,
  'player cannot edit the squad'
);
select throws_ok(
  $$ select public.link_team_member((select id from ids where key = 'manual'), (select id from ids where key = 'account')) $$,
  '42501', null, 'player cannot link members'
);

-- Coach links the manual entry with the player's account.
select pg_temp.act_as('cccccccc-0000-0000-0000-000000000003');
select is(
  (public.link_team_member((select id from ids where key = 'manual'), (select id from ids where key = 'account'))).user_id,
  'bbbbbbbb-0000-0000-0000-000000000002'::uuid,
  'manual entry gets the account'
);
select is((select count(*)::int from public.team_members), 2, 'duplicate entry from joining is removed');
select is(
  (select shirt_number || '/' || array_to_string(positions, ',') from public.team_members where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'),
  '10/MF,FW',
  'squad data of the manual entry is kept'
);

-- Coach promotes the player to co-coach.
update public.team_members set role = 'coach' where user_id = 'bbbbbbbb-0000-0000-0000-000000000002';
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000002');
select ok(public.is_team_coach((select id from ids where key = 'team')), 'promoted player has coach rights');

-- Outsider cannot link anything.
select pg_temp.act_as('dddddddd-0000-0000-0000-000000000004');
select throws_ok(
  $$ select public.link_team_member((select id from ids where key = 'manual'), (select id from ids where key = 'manual')) $$,
  '42501', null, 'outsider cannot link members'
);

select * from finish();
rollback;
