-- Drill library checks (Phase 5). Run with `npm run test:db`.
begin;
create extension if not exists pgtap with schema extensions;

select plan(15);

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

-- Admin A = coach rights in team; player P joins.
select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');
insert into ids (key, id) select 'club', (public.create_club('FC Übung')).id;
with t as (insert into public.teams (club_id, name) select id, 'U11' from ids where key = 'club' returning id)
insert into ids (key, id) select 'team', id from t;
with p as (insert into public.team_invites (team_id, role) select id, 'player' from ids where key = 'team' returning token)
insert into ids (key, token) select 'player_invite', token from p;

select ok((select count(*) from public.drills where team_id is null) >= 10, 'public library has standard drills');

with d as (
  insert into public.drills (team_id, title, category, duration_min, equipment, video_url)
  select id, 'Eigene Übung', 'passing', 12, array['Bälle'], 'https://youtu.be/dQw4w9WgXcQ'
  from ids where key = 'team' returning id
)
insert into ids (key, id) select 'own', id from d;
select isnt((select id from ids where key = 'own'), null, 'coach creates a team drill');

select throws_ok(
  $$ insert into public.drills (team_id, title, category, video_url) select id, 'Bad link', 'game', 'https://evil.example/x' from ids where key = 'team' $$,
  '23514', null, 'only YouTube links are allowed'
);
select throws_ok(
  $$ insert into public.drills (team_id, title, category) values (null, 'Fake public', 'game') $$,
  '42501', null, 'coaches cannot add to the public library'
);

update public.drills set title = 'Hacked' where id = '0d000000-0000-4000-8000-000000000001';
select is(
  (select title from public.drills where id = '0d000000-0000-4000-8000-000000000001'),
  'Rondo 4 gegen 2',
  'public drills cannot be edited'
);

select is(
  (public.copy_drill('0d000000-0000-4000-8000-000000000001', (select id from ids where key = 'team'))).copied_from,
  '0d000000-0000-4000-8000-000000000001'::uuid,
  'coach copies a public drill into the team'
);
update public.drills set title = 'Rondo 5 gegen 2'
where team_id = (select id from ids where key = 'team') and copied_from = '0d000000-0000-4000-8000-000000000001';
select is(
  (select title from public.drills where team_id = (select id from ids where key = 'team') and copied_from is not null),
  'Rondo 5 gegen 2',
  'the copy can be adapted'
);

-- Player: reads library and team drills, cannot write.
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000002');
select public.accept_team_invite((select token from ids where key = 'player_invite'));
select is(
  (select count(*)::int from public.drills where team_id = (select id from ids where key = 'team')),
  2,
  'player reads team drills'
);
select throws_ok(
  $$ insert into public.drills (team_id, title, category) select id, 'Player drill', 'game' from ids where key = 'team' $$,
  '42501', null, 'player cannot create drills'
);
select throws_ok(
  $$ select public.copy_drill('0d000000-0000-4000-8000-000000000002', (select id from ids where key = 'team')) $$,
  '42501', null, 'player cannot copy drills into the team'
);

-- Outsider: library yes, foreign team drills no.
select pg_temp.act_as('dddddddd-0000-0000-0000-000000000004');
select ok((select count(*) from public.drills where team_id is null) >= 10, 'everyone reads the public library');
select is(
  (select count(*)::int from public.drills where team_id is not null),
  0,
  'outsider cannot see foreign team drills'
);

-- ---- Animations (Phase 9) ---------------------------------------------------------------
select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');
select ok(
  (select animation ->> 'version' = '1' from public.drills where id = '0d000000-0000-4000-8000-000000000001'),
  'the public Rondo has a demo animation'
);
select lives_ok(
  $$ update public.drills set animation = '{"version":1,"field":"half","durationMs":6000,"objects":[],"keyframes":[{"t":0,"positions":{}}],"annotations":[]}'::jsonb
     where id = (select id from ids where key = 'own') $$,
  'coach saves an animation for a team drill'
);
select throws_ok(
  $$ update public.drills set animation = '{"version":2,"field":"half","objects":[],"keyframes":[]}'::jsonb
     where id = (select id from ids where key = 'own') $$,
  '23514', null, 'malformed animations are rejected by the database'
);

select * from finish();
rollback;
