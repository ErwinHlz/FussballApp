-- Statistics checks. Run with `npm run test:db`.
begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'admin.a@example.test', '{"display_name": "Admin A"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'player.p@example.test', '{"display_name": "Player P"}'),
  ('dddddddd-0000-0000-0000-000000000004', 'outsider.x@example.test', '{"display_name": "Outsider X"}');

create function pg_temp.act_as(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;

create temp table ids (key text primary key, id uuid, token text);
grant all on ids to authenticated, anon;

-- Setup as superuser so events can lie in the past and members can be backdated.
insert into ids (key, id) values ('team', gen_random_uuid()), ('club', gen_random_uuid());
insert into public.clubs (id, name, created_by) select id, 'FC Statistik', 'aaaaaaaa-0000-0000-0000-000000000001' from ids where key = 'club';
insert into public.club_members (club_id, user_id, role) select id, 'aaaaaaaa-0000-0000-0000-000000000001', 'admin' from ids where key = 'club';
insert into public.club_members (club_id, user_id, role) select id, 'bbbbbbbb-0000-0000-0000-000000000002', 'member' from ids where key = 'club';
insert into public.teams (id, club_id, name, created_by)
select (select id from ids where key = 'team'), (select id from ids where key = 'club'), 'U18', 'aaaaaaaa-0000-0000-0000-000000000001';

insert into public.team_members (id, team_id, user_id, role, display_name, created_at) values
  ('11111111-0000-0000-0000-000000000001', (select id from ids where key = 'team'), 'bbbbbbbb-0000-0000-0000-000000000002', 'player', 'Pia', now() - interval '60 days'),
  ('11111111-0000-0000-0000-000000000002', (select id from ids where key = 'team'), null, 'player', 'Late Lou', now() - interval '5 days');

-- Three past trainings (90 min), one cancelled, one future; one past match.
insert into public.events (id, team_id, type, starts_at, ends_at, is_cancelled, opponent) values
  ('22222222-0000-0000-0000-000000000001', (select id from ids where key = 'team'), 'training', now() - interval '20 days', now() - interval '20 days' + interval '90 minutes', false, null),
  ('22222222-0000-0000-0000-000000000002', (select id from ids where key = 'team'), 'training', now() - interval '10 days', now() - interval '10 days' + interval '90 minutes', false, null),
  ('22222222-0000-0000-0000-000000000003', (select id from ids where key = 'team'), 'training', now() - interval '2 days', now() - interval '2 days' + interval '90 minutes', false, null),
  ('22222222-0000-0000-0000-000000000004', (select id from ids where key = 'team'), 'training', now() - interval '3 days', null, true, null),
  ('22222222-0000-0000-0000-000000000005', (select id from ids where key = 'team'), 'training', now() + interval '2 days', null, false, null),
  ('22222222-0000-0000-0000-000000000006', (select id from ids where key = 'team'), 'match', now() - interval '7 days', null, false, 'Gegner');

insert into public.attendances (event_id, member_id, status, reason) values
  ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'yes', null),
  ('22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001', 'no', 'sick'),
  ('22222222-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000001', 'yes', null),
  ('22222222-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000002', 'yes', null),
  ('22222222-0000-0000-0000-000000000006', '11111111-0000-0000-0000-000000000001', 'yes', null);
insert into public.match_squad (event_id, member_id, role) values
  ('22222222-0000-0000-0000-000000000006', '11111111-0000-0000-0000-000000000001', 'starter');

set local role authenticated;
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000002');

create temp table s as
select * from public.team_member_stats((select id from ids where key = 'team'), now() - interval '1 year', now() + interval '1 year');
grant select on s to authenticated;

select is((select trainings_total from s where display_name = 'Pia'), 3, 'only past, not cancelled trainings count');
select is((select trainings_yes from s where display_name = 'Pia'), 2, 'yes answers are counted');
select is((select training_minutes from s where display_name = 'Pia'), 180, 'training time sums attended trainings');
select is((select decline_reasons from s where display_name = 'Pia'), '{"sick": 1}'::jsonb, 'decline reasons are grouped');
select is(
  (select matches_yes || '/' || starter from s where display_name = 'Pia'),
  '1/1',
  'match answers and nominations are counted'
);
select is(
  (select trainings_total || '/' || trainings_yes from s where display_name = 'Late Lou'),
  '1/1',
  'players are only counted from when they joined'
);

select is(
  (select array_agg(players order by starts_at) from public.team_training_attendance((select id from ids where key = 'team'), now() - interval '1 year', now())),
  array[1, 1, 2],
  'training series counts players present in the team at that time'
);
select is(
  (select array_agg(yes_count order by starts_at) from public.team_training_attendance((select id from ids where key = 'team'), now() - interval '1 year', now())),
  array[1, 0, 2],
  'yes answers per training'
);
select is(
  (select count(*)::int from public.team_member_stats((select id from ids where key = 'team'), now() - interval '15 days', now())
   where display_name = 'Pia' and trainings_total = 2),
  1,
  'the time range is respected'
);

select pg_temp.act_as('dddddddd-0000-0000-0000-000000000004');
select is(
  (select count(*)::int from public.team_member_stats((select id from ids where key = 'team'), now() - interval '1 year', now())),
  0,
  'outsiders get no statistics'
);

select * from finish();
rollback;
