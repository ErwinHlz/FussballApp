-- Standalone tactics boards and the extended animation format.
begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'coach@example.test', '{"display_name": "Coach"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'player@example.test', '{"display_name": "Player"}');

create function pg_temp.act_as(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;

create temp table ids (key text primary key, id uuid, token text);
grant all on ids to authenticated, anon;

create temp table anim as select jsonb_build_object(
  'version', 1, 'field', 'half', 'durationMs', 3000,
  'objects', jsonb_build_array(
    jsonb_build_object('id', 'p1', 'type', 'player', 'color', '#ef4444', 'label', '7', 'name', 'Lena'),
    jsonb_build_object('id', 'b1', 'type', 'ball'),
    jsonb_build_object('id', 'z1', 'type', 'zone', 'shape', 'rect', 'w', 20, 'h', 15, 'rotation', 45),
    jsonb_build_object('id', 'l1', 'type', 'ladder')
  ),
  'keyframes', jsonb_build_array(
    jsonb_build_object('t', 0, 'positions', jsonb_build_object('p1', jsonb_build_array(20, 50)),
      'holders', jsonb_build_object('b1', 'p1'))
  ),
  'annotations', jsonb_build_array(
    jsonb_build_object('type', 'arrow', 'from', jsonb_build_array(0, 0), 'to', jsonb_build_array(10, 10), 'style', 'line'))
) as value;
grant select on anim to authenticated;

set local role authenticated;
select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');
insert into ids (key, id) select 'club', (public.create_club('FC Tafel')).id;
with t as (insert into public.teams (club_id, name) select id, 'U17' from ids where key = 'club' returning id)
insert into ids (key, id) select 'team', id from t;
with i as (insert into public.team_invites (team_id, role) select id, 'player' from ids where key = 'team' returning token)
insert into ids (key, token) select 'invite', token from i;

select lives_ok(
  $$ insert into public.tactic_boards (team_id, title, animation)
     select (select id from ids where key = 'team'), 'Ecke kurz', value from anim $$,
  'coaches save boards with the extended format'
);
select lives_ok(
  $$ insert into public.drills (team_id, title, category, animation)
     select (select id from ids where key = 'team'), 'Mit Leiter', 'fitness', value from anim $$,
  'drills accept the extended format'
);
select throws_ok(
  $$ insert into public.tactic_boards (team_id, title, animation)
     select (select id from ids where key = 'team'), 'Kaputt', '{"version": 9}'::jsonb $$,
  '23514', null, 'invalid animations are refused'
);
select throws_ok(
  $$ insert into public.tactic_boards (team_id, title, animation)
     select (select id from ids where key = 'team'), 'Zu viel',
       jsonb_set(value, '{objects}', (select jsonb_agg(jsonb_build_object('id', 'c' || n, 'type', 'cone')) from generate_series(1, 61) n))
     from anim $$,
  '23514', null, 'at most 60 objects'
);
update public.tactic_boards set title = 'Ecke kurz 2' where title = 'Ecke kurz';
select ok(
  (select updated_at >= created_at and title = 'Ecke kurz 2' from public.tactic_boards limit 1),
  'boards can be renamed'
);

-- Players do not see or write boards.
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000002');
select public.accept_team_invite((select token from ids where key = 'invite'));
select is((select count(*)::int from public.tactic_boards), 0, 'players do not see boards');
select throws_ok(
  $$ insert into public.tactic_boards (team_id, title, animation)
     select (select id from ids where key = 'team'), 'Spieler', value from anim $$,
  '42501', null, 'players cannot create boards'
);

reset role;
select is(
  (select count(*)::int from public.drills where animation is not null and not public.is_valid_animation(animation)),
  0, 'existing drill animations are still valid'
);

select * from finish();
rollback;
