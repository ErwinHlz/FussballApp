-- Web push outbox and recipient checks. Run with `npm run test:db`.
begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'coach.a@example.test', '{"display_name": "Coach A"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'player.p@example.test', '{"display_name": "Player P"}'),
  ('eeeeeeee-0000-0000-0000-000000000005', 'player.q@example.test', '{"display_name": "Player Q"}'),
  ('dddddddd-0000-0000-0000-000000000004', 'outsider.x@example.test', '{"display_name": "Outsider X"}');

create function pg_temp.act_as(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;

create temp table ids (key text primary key, id uuid, token text);
grant all on ids to authenticated, anon, service_role;

-- Start with an empty outbox for this test.
update public.notification_outbox set processed_at = now() where processed_at is null;

set local role authenticated;

select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');
insert into ids (key, id) select 'club', (public.create_club('FC Push')).id;
with t as (insert into public.teams (club_id, name) select id, 'U19' from ids where key = 'club' returning id)
insert into ids (key, id) select 'team', id from t;
with c as (insert into public.team_invites (team_id, role) select id, 'coach' from ids where key = 'team' returning token)
insert into ids (key, token) select 'coach_invite', token from c;
select public.accept_team_invite((select token from ids where key = 'coach_invite'));
with p as (insert into public.team_invites (team_id, role) select id, 'player' from ids where key = 'team' returning token)
insert into ids (key, token) select 'player_invite', token from p;

-- Devices.
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000002');
select public.accept_team_invite((select token from ids where key = 'player_invite'));
select public.save_push_subscription('https://push.example.test/p1', 'key-p', 'auth-p', 'de', 'Test');
insert into ids (key, id) select 'p', id from public.team_members where user_id = 'bbbbbbbb-0000-0000-0000-000000000002';

select pg_temp.act_as('eeeeeeee-0000-0000-0000-000000000005');
select public.accept_team_invite((select token from ids where key = 'player_invite'));
select public.save_push_subscription('https://push.example.test/q1', 'key-q', 'auth-q', 'en');
insert into ids (key, id) select 'q', id from public.team_members where user_id = 'eeeeeeee-0000-0000-0000-000000000005';

select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');
select public.save_push_subscription('https://push.example.test/a1', 'key-a', 'auth-a');

select is((select count(*)::int from public.push_subscriptions), 1, 'users only see their own devices');
select throws_ok(
  $$ insert into public.push_subscriptions (endpoint, p256dh, auth) values ('https://x', 'k', 'a') $$,
  '42501', null, 'devices are registered only via the RPC'
);
select throws_ok(
  $$ select count(*) from public.notification_outbox $$,
  '42501', null, 'clients cannot read the outbox'
);
select throws_ok(
  $$ select * from public.claim_push_messages(10) $$,
  '42501', null, 'clients cannot claim messages'
);

-- Coach creates a match, a training series (3 dates) and publishes a plan.
with e as (
  insert into public.events (team_id, type, starts_at, opponent, response_deadline)
  select id, 'match', now() + interval '2 days', 'FC Gegner', now() + interval '20 hours' from ids where key = 'team'
  returning id
)
insert into ids (key, id) select 'match', id from e;
select public.create_training_series(
  (select id from ids where key = 'team'), 2, '19:00', 90, 'Platz', current_date, current_date + 30,
  array[now() + interval '3 days', now() + interval '10 days', now() + interval '17 days'], null
);
with e as (
  insert into public.events (team_id, type, starts_at) select id, 'training', now() + interval '1 day' from ids where key = 'team'
  returning id
)
insert into ids (key, id) select 'training', id from e;
update public.events set plan_status = 'published' where id = (select id from ids where key = 'training');
select public.set_match_squad((select id from ids where key = 'match'),
  jsonb_build_array(jsonb_build_object('member_id', (select id from ids where key = 'p'), 'role', 'starter')));
-- Saving again with an additional player notifies only the new one.
select public.set_match_squad((select id from ids where key = 'match'), jsonb_build_array(
  jsonb_build_object('member_id', (select id from ids where key = 'p'), 'role', 'starter'),
  jsonb_build_object('member_id', (select id from ids where key = 'q'), 'role', 'bench')));

-- Player P answers the match, Q does not.
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000002');
select public.set_attendance((select id from ids where key = 'match'), (select id from ids where key = 'p'), 'yes');

-- The dispatcher (service role) enqueues reminders and claims everything.
reset role;
select is(private.enqueue_reminders(), 1, 'a reminder is enqueued for the match (deadline in < 24 h)');
select is(private.enqueue_reminders(), 0, 'reminders are enqueued only once');

set local role service_role;
create temp table claimed as select * from public.claim_push_messages(100);

select is(
  (select array_agg(kind order by kind) from (select distinct kind from claimed) k),
  array['event_created', 'nomination', 'plan_published', 'reminder', 'series_created'],
  'all kinds are delivered'
);
select is(
  (select count(*)::int from claimed where kind = 'series_created'),
  2,
  'a series creates one message per recipient, not one per date'
);
select is(
  (select array_agg(endpoint order by endpoint) from claimed
   where kind = 'event_created' and event_id = (select id from ids where key = 'match')),
  array['https://push.example.test/p1', 'https://push.example.test/q1'],
  'the coach who created the event is not notified'
);
select is(
  (select count(*)::int from claimed where kind = 'plan_published' and endpoint like '%/a1'),
  0,
  'published plans go to players only'
);
select is(
  (select array_agg(endpoint order by endpoint) from claimed where kind = 'nomination'),
  array['https://push.example.test/p1', 'https://push.example.test/q1'],
  'each newly nominated player is notified once'
);
select is(
  (select array_agg(endpoint order by endpoint) from claimed where kind = 'reminder'),
  array['https://push.example.test/a1', 'https://push.example.test/q1'],
  'reminders go to members without an answer'
);
select is(
  (select distinct locale from claimed where endpoint like '%/q1'),
  'en',
  'the device language is passed on'
);
select is((select count(*)::int from public.claim_push_messages(100)), 0, 'claimed messages are not sent twice');

-- Cancelling notifies the team; a test push reaches only the own devices.
reset role;
set local role authenticated;
select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');
update public.events set is_cancelled = true where id = (select id from ids where key = 'training');
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000002');
select public.request_test_push();

set local role service_role;
select is(
  (select array_agg(kind || ':' || right(endpoint, 2) order by kind, endpoint) from public.claim_push_messages(100)),
  array['event_cancelled:p1', 'event_cancelled:q1', 'test:p1'],
  'cancellation goes to the team, the test push to the own device'
);

reset role;
set local role authenticated;
select pg_temp.act_as('dddddddd-0000-0000-0000-000000000004');
select throws_ok(
  $$ select public.enqueue_nomination((select id from ids where key = 'match'), array[(select id from ids where key = 'p')]) $$,
  '42501', null, 'outsiders cannot send nominations'
);

select * from finish();
rollback;
