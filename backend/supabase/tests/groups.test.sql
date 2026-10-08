-- Group assignment checks (Phase 7). Run with `npm run test:db`.
begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'admin.a@example.test', '{"display_name": "Admin A"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'player.p@example.test', '{"display_name": "Player P"}'),
  ('dddddddd-0000-0000-0000-000000000004', 'outsider.x@example.test', '{"display_name": "Outsider X"}');

create function pg_temp.act_as(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;

create temp table ids (key text primary key, id uuid, token text);
grant all on ids to authenticated, anon;

set local role authenticated;

select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');
insert into ids (key, id) select 'club', (public.create_club('FC Gruppe')).id;
with t as (insert into public.teams (club_id, name) select id, 'U12' from ids where key = 'club' returning id)
insert into ids (key, id) select 'team', id from t;
with t as (insert into public.teams (club_id, name) select id, 'U13' from ids where key = 'club' returning id)
insert into ids (key, id) select 'other_team', id from t;
with p as (insert into public.team_invites (team_id, role) select id, 'player' from ids where key = 'team' returning token)
insert into ids (key, token) select 'player_invite', token from p;
with m as (insert into public.team_members (team_id, display_name) select id, 'Anna' from ids where key = 'team' returning id)
insert into ids (key, id) select 'anna', id from m;
with m as (insert into public.team_members (team_id, display_name) select id, 'Ben' from ids where key = 'team' returning id)
insert into ids (key, id) select 'ben', id from m;
with m as (insert into public.team_members (team_id, display_name) select id, 'Foreign' from ids where key = 'other_team' returning id)
insert into ids (key, id) select 'foreign', id from m;
with e as (
  insert into public.events (team_id, type, starts_at) select id, 'training', now() + interval '1 day' from ids where key = 'team' returning id
)
insert into ids (key, id) select 'training', id from e;
with d as (
  insert into public.event_drills (event_id, drill_id, position)
  values ((select id from ids where key = 'training'), '0d000000-0000-4000-8000-000000000001', 1)
  returning id
)
insert into ids (key, id) select 'ed', id from d;

-- Coach saves two groups.
select lives_ok(
  $$ select public.set_drill_groups((select id from ids where key = 'ed'), jsonb_build_array(
       jsonb_build_object('name', 'Rot', 'color', 'red', 'member_ids', jsonb_build_array((select id from ids where key = 'anna'))),
       jsonb_build_object('name', 'Blau', 'color', 'blue', 'member_ids', jsonb_build_array((select id from ids where key = 'ben')))
     )) $$,
  'coach saves groups'
);
select is((select count(*)::int from public.drill_groups), 2, 'two groups exist');
select is(
  (select g.color from public.group_assignments a join public.drill_groups g on g.id = a.group_id where a.member_id = (select id from ids where key = 'ben')),
  'blue',
  'Ben is in the blue group'
);

select throws_ok(
  $$ select public.set_drill_groups((select id from ids where key = 'ed'), jsonb_build_array(
       jsonb_build_object('name', 'Rot', 'color', 'red', 'member_ids', jsonb_build_array((select id from ids where key = 'anna'))),
       jsonb_build_object('name', 'Blau', 'color', 'blue', 'member_ids', jsonb_build_array((select id from ids where key = 'anna')))
     )) $$,
  'P0001', null, 'a player cannot be in two groups of the same drill'
);
select throws_ok(
  $$ select public.set_drill_groups((select id from ids where key = 'ed'), jsonb_build_array(
       jsonb_build_object('name', 'Rot', 'color', 'red', 'member_ids', jsonb_build_array((select id from ids where key = 'foreign')))
     )) $$,
  'P0001', null, 'only members of the team can be assigned'
);
select throws_ok(
  $$ select public.set_drill_groups((select id from ids where key = 'ed'), jsonb_build_array(
       jsonb_build_object('name', 'Lila', 'color', 'purple', 'member_ids', '[]'::jsonb)
     )) $$,
  '23514', null, 'only bib colors are allowed'
);
select is((select count(*)::int from public.drill_groups), 2, 'failed saves keep the previous groups');

-- Player: hidden while draft, visible once published, cannot write.
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000002');
select public.accept_team_invite((select token from ids where key = 'player_invite'));
select is((select count(*)::int from public.drill_groups), 0, 'players do not see groups of a draft plan');

select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');
update public.events set plan_status = 'published' where id = (select id from ids where key = 'training');

select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000002');
select is(
  (select count(*)::int from public.group_assignments),
  2,
  'players see group assignments of a published plan'
);
select throws_ok(
  $$ select public.set_drill_groups((select id from ids where key = 'ed'), '[]'::jsonb) $$,
  '42501', null, 'players cannot change groups'
);

-- Outsider sees nothing.
select pg_temp.act_as('dddddddd-0000-0000-0000-000000000004');
select is(
  (select count(*)::int from public.drill_groups) + (select count(*)::int from public.group_assignments),
  0,
  'outsider sees no groups'
);

-- Linking keeps the group assignment of the manual entry.
select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');
select public.link_team_member(
  (select id from ids where key = 'anna'),
  (select id from public.team_members where user_id = 'bbbbbbbb-0000-0000-0000-000000000002')
);
select is(
  (select count(*)::int from public.group_assignments where member_id = (select id from ids where key = 'anna')),
  1,
  'linking keeps group assignments'
);

select * from finish();
rollback;
