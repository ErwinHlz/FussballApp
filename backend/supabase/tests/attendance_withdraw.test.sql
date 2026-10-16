-- Withdrawing an answer (undo of a first decline). Run with `npm run test:db`.
begin;
create extension if not exists pgtap with schema extensions;

select plan(5);

insert into auth.users (id, email, raw_user_meta_data) values
  ('a1a1a1a1-0000-0000-0000-000000000001', 'coach.w@example.test', '{"display_name": "Coach W"}'),
  ('b1b1b1b1-0000-0000-0000-000000000002', 'player.w@example.test', '{"display_name": "Player W"}'),
  ('c1c1c1c1-0000-0000-0000-000000000003', 'player.v@example.test', '{"display_name": "Player V"}');

create function pg_temp.act_as(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;

create temp table ids (key text primary key, id uuid, token text);
grant all on ids to authenticated, anon;

set local role authenticated;

-- Setup: club and team by the coach, two players, an open training and a closed match.
select pg_temp.act_as('a1a1a1a1-0000-0000-0000-000000000001');
insert into ids (key, id) select 'club', (public.create_club('FC Rückzug')).id;
with t as (insert into public.teams (club_id, name) select id, 'U13' from ids where key = 'club' returning id)
insert into ids (key, id) select 'team', id from t;
with p as (insert into public.team_invites (team_id, role) select id, 'player' from ids where key = 'team' returning token)
insert into ids (key, token) select 'invite', token from p;
with e as (
  insert into public.events (team_id, type, starts_at)
  select id, 'training', now() + interval '2 days' from ids where key = 'team' returning id
)
insert into ids (key, id) select 'open', id from e;
with e as (
  insert into public.events (team_id, type, starts_at, opponent, response_deadline)
  select id, 'match', now() + interval '3 days', 'SV Zu', now() + interval '1 day'
  from ids where key = 'team' returning id
)
insert into ids (key, id) select 'closed', id from e;

select pg_temp.act_as('b1b1b1b1-0000-0000-0000-000000000002');
select public.accept_team_invite((select token from ids where key = 'invite'));
insert into ids (key, id) select 'w', id from public.team_members where user_id = 'b1b1b1b1-0000-0000-0000-000000000002';
select public.set_attendance((select id from ids where key = 'open'), (select id from ids where key = 'w'), 'no');
select public.set_attendance((select id from ids where key = 'closed'), (select id from ids where key = 'w'), 'no');

select pg_temp.act_as('c1c1c1c1-0000-0000-0000-000000000003');
select public.accept_team_invite((select token from ids where key = 'invite'));
insert into ids (key, id) select 'v', id from public.team_members where user_id = 'c1c1c1c1-0000-0000-0000-000000000003';
select public.set_attendance((select id from ids where key = 'open'), (select id from ids where key = 'v'), 'yes');

-- The match closes for answers (deadline passed); only the coach may change it now.
reset role;
update public.events set response_deadline = now() - interval '1 minute' where id = (select id from ids where key = 'closed');
set local role authenticated;

-- ---- Player W withdraws ------------------------------------------------------------------
select pg_temp.act_as('b1b1b1b1-0000-0000-0000-000000000002');
delete from public.attendances
where event_id = (select id from ids where key = 'open') and member_id = (select id from ids where key = 'w');
select is(
  (select count(*)::int from public.attendances
   where event_id = (select id from ids where key = 'open') and member_id = (select id from ids where key = 'w')),
  0, 'a player withdraws the own answer while the event is open'
);

delete from public.attendances
where event_id = (select id from ids where key = 'open') and member_id = (select id from ids where key = 'v');
select is(
  (select count(*)::int from public.attendances
   where event_id = (select id from ids where key = 'open') and member_id = (select id from ids where key = 'v')),
  1, 'a player cannot withdraw someone else''s answer'
);

delete from public.attendances
where event_id = (select id from ids where key = 'closed') and member_id = (select id from ids where key = 'w');
select is(
  (select count(*)::int from public.attendances
   where event_id = (select id from ids where key = 'closed') and member_id = (select id from ids where key = 'w')),
  1, 'after the deadline the answer stays'
);

-- Cancelled events are closed too.
select pg_temp.act_as('a1a1a1a1-0000-0000-0000-000000000001');
update public.events set is_cancelled = true where id = (select id from ids where key = 'open');
select pg_temp.act_as('c1c1c1c1-0000-0000-0000-000000000003');
delete from public.attendances
where event_id = (select id from ids where key = 'open') and member_id = (select id from ids where key = 'v');
select is(
  (select count(*)::int from public.attendances
   where event_id = (select id from ids where key = 'open') and member_id = (select id from ids where key = 'v')),
  1, 'answers of cancelled events cannot be withdrawn by players'
);

-- The coach still can (existing coach policy).
select pg_temp.act_as('a1a1a1a1-0000-0000-0000-000000000001');
delete from public.attendances
where event_id = (select id from ids where key = 'closed') and member_id = (select id from ids where key = 'w');
select is(
  (select count(*)::int from public.attendances where event_id = (select id from ids where key = 'closed')),
  0, 'coaches can still remove answers after the deadline'
);

select * from finish();
rollback;
