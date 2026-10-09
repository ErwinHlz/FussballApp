-- Team events (type "event"): title, answers, no plan or squad, push title.
begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

-- Isolate from data left by other runs.
update public.notification_outbox set processed_at = now() where processed_at is null;

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'coach@example.test', '{"display_name": "Coach"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'player@example.test', '{"display_name": "Player"}');

create function pg_temp.act_as(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;

create temp table ids (key text primary key, id uuid, token text);
grant all on ids to authenticated, anon, service_role;

set local role authenticated;
select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');
insert into ids (key, id) select 'club', (public.create_club('FC Feier')).id;
with t as (insert into public.teams (club_id, name) select id, 'U17' from ids where key = 'club' returning id)
insert into ids (key, id) select 'team', id from t;
with i as (insert into public.team_invites (team_id, role) select id, 'player' from ids where key = 'team' returning token)
insert into ids (key, token) select 'invite', token from i;

select throws_ok(
  $$ insert into public.events (team_id, type, starts_at) select id, 'event', now() + interval '3 days' from ids where key = 'team' $$,
  '23514', null, 'events need a title'
);
select throws_ok(
  $$ insert into public.events (team_id, type, title, opponent, starts_at)
     select id, 'event', 'Teamabend', 'FC Gegner', now() + interval '3 days' from ids where key = 'team' $$,
  '23514', null, 'events have no opponent'
);
with e as (
  insert into public.events (team_id, type, title, starts_at, location)
  select id, 'event', 'Teamabend', now() + interval '3 days', 'Vereinsheim' from ids where key = 'team'
  returning id
)
insert into ids (key, id) select 'event', id from e;
select is(
  (select title from public.events where id = (select id from ids where key = 'event')),
  'Teamabend', 'coaches create events with a title'
);
select throws_ok(
  $$ insert into public.events (team_id, type, starts_at) select id, 'match', now() + interval '3 days' from ids where key = 'team' $$,
  '23514', null, 'matches still need an opponent'
);
select throws_ok(
  $$ insert into public.event_drills (event_id, drill_id)
     select (select id from ids where key = 'event'), '0d000000-0000-4000-8000-000000000001' $$,
  '42501', null, 'events have no training plan'
);
select throws_ok(
  $$ select public.set_match_squad((select id from ids where key = 'event'), '[]'::jsonb) $$,
  'P0001', null, 'events have no squad'
);

-- Players answer events like any other date.
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000002');
select public.accept_team_invite((select token from ids where key = 'invite'));
select lives_ok(
  $$ select public.set_attendance((select id from ids where key = 'event'),
       (select id from public.team_members where user_id = auth.uid()), 'yes') $$,
  'players answer events'
);
select public.save_push_subscription('https://push.example.test/p', 'k', 'a');

reset role;
set local role service_role;
select is(
  (select event_title from public.claim_push_messages(100) where kind = 'event_created' limit 1),
  'Teamabend', 'push messages carry the event title'
);

select * from finish();
rollback;
