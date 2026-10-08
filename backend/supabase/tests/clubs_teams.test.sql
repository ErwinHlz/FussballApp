-- RLS and RPC checks for clubs, teams, team members and invites. Run with `npm run test:db`.
begin;
create extension if not exists pgtap with schema extensions;

select plan(24);

-- Fake users (no real personal data):
--   A = club admin, C = coach (via coach invite), P = player (via player invite), X = outsider
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

-- ---- Admin A creates club and team ---------------------------------------------------------
select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');

insert into ids (key, id) select 'club', (public.create_club('FC Testverein')).id;
select is(
  (select role::text from public.club_members where club_id = (select id from ids where key = 'club')),
  'admin',
  'creator becomes club admin'
);

-- With RETURNING, like the app does (insert ... select()).
with created as (
  insert into public.teams (club_id, name, season)
  select id, 'U17', '2026/27' from ids where key = 'club'
  returning id
)
insert into ids (key, id) select 'team', id from created;
select is((select count(*)::int from public.teams), 1, 'admin sees the new team');

insert into public.team_invites (team_id, role)
select id, 'coach' from ids where key = 'team';
insert into ids (key, token) select 'coach_invite', token from public.team_invites where role = 'coach';
select ok((select token from ids where key = 'coach_invite') ~ '^[0-9a-f]{64}$', 'invite token is 64 hex chars');

-- ---- Outsider X sees nothing and cannot create teams/invites ---------------------------------
select pg_temp.act_as('dddddddd-0000-0000-0000-000000000004');
select is((select count(*)::int from public.clubs), 0, 'outsider sees no clubs');
select is((select count(*)::int from public.teams), 0, 'outsider sees no teams');
select is((select count(*)::int from public.team_invites), 0, 'outsider sees no invites');
select throws_ok(
  $$ insert into public.teams (club_id, name) select id, 'Hijack' from ids where key = 'club' $$,
  '42501', null, 'outsider cannot create a team in a foreign club'
);
select throws_ok(
  $$ insert into public.team_invites (team_id, role) select id, 'player' from ids where key = 'team' $$,
  '42501', null, 'outsider cannot create invites'
);

-- ---- Invite preview works for everyone (incl. anon) ---------------------------------------
reset role;
set local role anon;
select is(
  (select status || '/' || role::text || '/' || team_name from public.get_team_invite((select token from ids where key = 'coach_invite'))),
  'valid/coach/U17',
  'anon can preview a valid invite'
);
select is((select count(*)::int from public.get_team_invite('nope')), 0, 'unknown token returns nothing');
select throws_ok(
  $$ select public.accept_team_invite((select token from ids where key = 'coach_invite')) $$,
  '42501', null, 'anon cannot accept invites'
);
reset role;
set local role authenticated;

-- ---- Coach C joins via coach invite ------------------------------------------------------------
select pg_temp.act_as('cccccccc-0000-0000-0000-000000000003');
select is(
  public.accept_team_invite((select token from ids where key = 'coach_invite')),
  (select id from ids where key = 'team'),
  'accept returns the team id'
);
select is(
  (select role::text || '/' || display_name from public.team_members where user_id = 'cccccccc-0000-0000-0000-000000000003'),
  'coach/Coach C',
  'coach invite makes C coach with profile name'
);
select is(
  (select role::text from public.club_members where user_id = 'cccccccc-0000-0000-0000-000000000003'),
  'member',
  'coach becomes club member (not admin)'
);
select throws_ok(
  $$ insert into public.team_invites (team_id, role) select id, 'coach' from ids where key = 'team' $$,
  '42501', null, 'coach cannot create coach invites'
);
insert into public.team_invites (team_id, role) select id, 'player' from ids where key = 'team';
insert into ids (key, token) select 'player_invite', token from public.team_invites where role = 'player';
select isnt((select token from ids where key = 'player_invite'), null, 'coach can create player invites');

-- ---- Player P joins via player invite ----------------------------------------------------------
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000002');
select lives_ok(
  $$ select public.accept_team_invite((select token from ids where key = 'player_invite')) $$,
  'player accepts player invite'
);
select lives_ok(
  $$ select public.accept_team_invite((select token from ids where key = 'player_invite')) $$,
  'accepting twice is harmless'
);
select is((select count(*)::int from public.team_members), 2, 'player sees the squad (coach + player)');
select is((select count(*)::int from public.team_invites), 0, 'player cannot read invites');
select throws_ok(
  $$ insert into public.team_invites (team_id, role) select id, 'player' from ids where key = 'team' $$,
  '42501', null, 'player cannot create invites'
);
update public.team_members set display_name = 'Renamed' where user_id = 'cccccccc-0000-0000-0000-000000000003';
select is(
  (select display_name from public.team_members where user_id = 'cccccccc-0000-0000-0000-000000000003'),
  'Coach C',
  'player cannot edit squad entries'
);

-- ---- Revoked invites cannot be used; last admin cannot be demoted -------------------------
select pg_temp.act_as('cccccccc-0000-0000-0000-000000000003');
update public.team_invites set revoked_at = now() where role = 'player';

select pg_temp.act_as('dddddddd-0000-0000-0000-000000000004');
select throws_ok(
  $$ select public.accept_team_invite((select token from ids where key = 'player_invite')) $$,
  'P0001', null, 'revoked invite cannot be accepted'
);

select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');
select throws_ok(
  $$ select public.set_club_member_role((select id from ids where key = 'club'), 'aaaaaaaa-0000-0000-0000-000000000001', 'member') $$,
  'P0001', null, 'last admin cannot be demoted'
);

select * from finish();
rollback;
