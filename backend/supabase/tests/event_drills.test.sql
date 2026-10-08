-- Training content checks (Phase 6). Run with `npm run test:db`.
begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

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
insert into ids (key, id) select 'club', (public.create_club('FC Plan')).id;
with t as (insert into public.teams (club_id, name) select id, 'U14' from ids where key = 'club' returning id)
insert into ids (key, id) select 'team', id from t;
with p as (insert into public.team_invites (team_id, role) select id, 'player' from ids where key = 'team' returning token)
insert into ids (key, token) select 'player_invite', token from p;
with e as (
  insert into public.events (team_id, type, starts_at, ends_at)
  select id, 'training', now() + interval '1 day', now() + interval '1 day 90 minutes' from ids where key = 'team'
  returning id
)
insert into ids (key, id) select 'training', id from e;
with e as (
  insert into public.events (team_id, type, starts_at)
  select id, 'training', now() + interval '8 days' from ids where key = 'team' returning id
)
insert into ids (key, id) select 'training2', id from e;
with e as (
  insert into public.events (team_id, type, starts_at, opponent)
  select id, 'match', now() + interval '3 days', 'Gegner' from ids where key = 'team' returning id
)
insert into ids (key, id) select 'match', id from e;

-- Coach builds the plan.
with d as (
  insert into public.event_drills (event_id, drill_id, position, duration_min)
  values
    ((select id from ids where key = 'training'), '0d000000-0000-4000-8000-000000000005', 1, 10),
    ((select id from ids where key = 'training'), '0d000000-0000-4000-8000-000000000001', 2, 20),
    ((select id from ids where key = 'training'), '0d000000-0000-4000-8000-000000000004', 3, null)
  returning id, drill_id
)
insert into ids (key, id) select 'ed_' || right(drill_id::text, 2), id from d;
select is(
  (select count(*)::int from public.event_drills where event_id = (select id from ids where key = 'training')),
  3,
  'coach adds drills to a training'
);
select throws_ok(
  $$ insert into public.event_drills (event_id, drill_id) values ((select id from ids where key = 'match'), '0d000000-0000-4000-8000-000000000001') $$,
  '42501', null, 'matches have no training plan'
);

select public.reorder_event_drills(
  (select id from ids where key = 'training'),
  array[(select id from ids where key = 'ed_04'), (select id from ids where key = 'ed_05'), (select id from ids where key = 'ed_01')]
);
select is(
  (select array_agg(right(drill_id::text, 2) order by position) from public.event_drills where event_id = (select id from ids where key = 'training')),
  array['04', '05', '01'],
  'coach reorders the plan'
);

select is(
  public.copy_event_plan((select id from ids where key = 'training'), (select id from ids where key = 'training2')),
  3,
  'coach copies a plan to another training'
);

with d as (
  insert into public.drills (team_id, title, category) select id, 'Eigene', 'game' from ids where key = 'team' returning id
)
insert into ids (key, id) select 'own_drill', id from d;
insert into public.event_drills (event_id, drill_id, position)
values ((select id from ids where key = 'training2'), (select id from ids where key = 'own_drill'), 99);
select throws_ok(
  $$ delete from public.drills where id = (select id from ids where key = 'own_drill') $$,
  '23503', null, 'drills used in plans cannot be deleted'
);

-- Player: draft invisible, published visible, no writes.
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000002');
select public.accept_team_invite((select token from ids where key = 'player_invite'));
insert into ids (key, id) select 'p', id from public.team_members where user_id = 'bbbbbbbb-0000-0000-0000-000000000002';
select is((select count(*)::int from public.event_drills), 0, 'players do not see draft plans');

select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');
update public.events set plan_status = 'published' where id = (select id from ids where key = 'training');
select isnt(
  (select plan_published_at from public.events where id = (select id from ids where key = 'training')),
  null,
  'publishing sets plan_published_at'
);

select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000002');
select is((select count(*)::int from public.event_drills), 3, 'players see the published plan only');
select throws_ok(
  $$ insert into public.event_drills (event_id, drill_id) values ((select id from ids where key = 'training'), '0d000000-0000-4000-8000-000000000002') $$,
  '42501', null, 'players cannot change plans'
);
select public.reorder_event_drills((select id from ids where key = 'training'), array[(select id from ids where key = 'ed_01')]);
select is(
  (select position from public.event_drills where id = (select id from ids where key = 'ed_01')),
  3,
  'players cannot reorder plans'
);

-- Late decline after publishing is detectable.
select public.set_attendance((select id from ids where key = 'training'), (select id from ids where key = 'p'), 'no', 'sick');
select ok(
  (select a.updated_at >= e.plan_published_at
   from public.attendances a join public.events e on e.id = a.event_id
   where a.member_id = (select id from ids where key = 'p') and e.id = (select id from ids where key = 'training')),
  'a decline after publishing is newer than plan_published_at'
);

select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');
update public.events set plan_status = 'draft' where id = (select id from ids where key = 'training');
select is(
  (select plan_published_at from public.events where id = (select id from ids where key = 'training')),
  null,
  'back to draft clears plan_published_at'
);

-- Outsider sees nothing.
select pg_temp.act_as('dddddddd-0000-0000-0000-000000000004');
select is((select count(*)::int from public.event_drills), 0, 'outsider sees no plans');
select is(
  public.copy_event_plan((select id from ids where key = 'training'), (select id from ids where key = 'training2')),
  0,
  'outsider copies nothing (source invisible, insert blocked)'
);

select * from finish();
rollback;
