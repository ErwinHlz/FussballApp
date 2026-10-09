-- GDPR checks: export and account deletion. Run with `npm run test:db`.
begin;
create extension if not exists pgtap with schema extensions;

select plan(11);

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'admin.a@example.test', '{"display_name": "Admin A"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'player.p@example.test', '{"display_name": "Player P"}'),
  ('cccccccc-0000-0000-0000-000000000003', 'solo.s@example.test', '{"display_name": "Solo S"}');

create function pg_temp.act_as(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;

create temp table ids (key text primary key, id uuid, token text);
grant all on ids to authenticated, anon;

set local role authenticated;

-- Admin A runs a club with a team; player P joins and answers.
select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');
insert into ids (key, id) select 'club', (public.create_club('FC Daten')).id;
with t as (insert into public.teams (club_id, name) select id, 'U20' from ids where key = 'club' returning id)
insert into ids (key, id) select 'team', id from t;
with p as (insert into public.team_invites (team_id, role) select id, 'player' from ids where key = 'team' returning token)
insert into ids (key, token) select 'invite', token from p;
with e as (insert into public.events (team_id, type, starts_at) select id, 'training', now() + interval '2 days' from ids where key = 'team' returning id)
insert into ids (key, id) select 'event', id from e;
with d as (insert into public.drills (team_id, title, category) select id, 'Eigene Übung', 'game' from ids where key = 'team' returning id)
insert into ids (key, id) select 'drill', id from d;
insert into public.event_drills (event_id, drill_id) select (select id from ids where key = 'event'), (select id from ids where key = 'drill');

select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000002');
select public.accept_team_invite((select token from ids where key = 'invite'));
insert into ids (key, id) select 'p', id from public.team_members where user_id = 'bbbbbbbb-0000-0000-0000-000000000002';
select public.set_attendance((select id from ids where key = 'event'), (select id from ids where key = 'p'), 'yes');
select public.save_push_subscription('https://push.example.test/p', 'k', 'a');

-- Export contains the own data.
select is(public.export_my_data() #>> '{account,email}', 'player.p@example.test', 'export contains the account');
select is(jsonb_array_length(public.export_my_data() -> 'answers'), 1, 'export contains the answers');
select is(public.export_my_data() #>> '{teams,0,team}', 'U20', 'export contains the team membership');
select is(jsonb_array_length(public.export_my_data() -> 'notification_devices'), 1, 'export contains the devices');

-- Player deletes the account.
select lives_ok($$ select public.delete_my_account() $$, 'a player deletes the account');

reset role;
select is((select count(*)::int from auth.users where id = 'bbbbbbbb-0000-0000-0000-000000000002'), 0, 'the auth user is gone');
select is(
  (select count(*)::int from public.team_members where id = (select id from ids where key = 'p'))
  + (select count(*)::int from public.attendances where member_id = (select id from ids where key = 'p'))
  + (select count(*)::int from public.push_subscriptions where endpoint = 'https://push.example.test/p'),
  0,
  'squad entry, answers and devices are deleted'
);

-- The only admin of a club with members cannot delete the account (club would be orphaned).
set local role authenticated;
select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');
with m as (insert into public.team_members (team_id, display_name) select id, 'Manual' from ids where key = 'team' returning id)
insert into ids (key, id) select 'manual', id from m;
reset role;
insert into public.club_members (club_id, user_id, role)
select (select id from ids where key = 'club'), 'cccccccc-0000-0000-0000-000000000003', 'member';
set local role authenticated;
select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');
select throws_ok($$ select public.delete_my_account() $$, 'P0001', null, 'the last admin of a used club is refused');

-- Once the other member leaves, the admin can delete and the unused club goes with it.
reset role;
delete from public.club_members where user_id = 'cccccccc-0000-0000-0000-000000000003';
set local role authenticated;
select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');
select lives_ok($$ select public.delete_my_account() $$, 'the admin of an unused club deletes the account');
reset role;
select is((select count(*)::int from public.clubs where id = (select id from ids where key = 'club')), 0, 'the unused club is deleted with all content');
select is((select count(*)::int from public.drills where id = (select id from ids where key = 'drill')), 0, 'drills used in plans do not block deleting the club');

select * from finish();
rollback;
