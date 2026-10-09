-- Training templates: own and shared templates, applying them to trainings.
begin;
create extension if not exists pgtap with schema extensions;

select plan(18);

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'admin@example.test', '{"display_name": "Admin"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'coach.a@example.test', '{"display_name": "Coach A"}'),
  ('cccccccc-0000-0000-0000-000000000003', 'coach.b@example.test', '{"display_name": "Coach B"}'),
  ('dddddddd-0000-0000-0000-000000000004', 'player@example.test', '{"display_name": "Player"}'),
  ('eeeeeeee-0000-0000-0000-000000000005', 'other@example.test', '{"display_name": "Other club"}');

create function pg_temp.act_as(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;

create temp table ids (key text primary key, id uuid, token text);
grant all on ids to authenticated, anon;

set local role authenticated;
select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');
insert into ids (key, id) select 'club', (public.create_club('FC Vorlage')).id;
with t as (insert into public.teams (club_id, name) select id, 'U17' from ids where key = 'club' returning id)
insert into ids (key, id) select 'teamA', id from t;
with t as (insert into public.teams (club_id, name) select id, 'U19' from ids where key = 'club' returning id)
insert into ids (key, id) select 'teamB', id from t;
with i as (insert into public.team_invites (team_id, role) select id, 'coach' from ids where key = 'teamA' returning token)
insert into ids (key, token) select 'inviteA', token from i;
with i as (insert into public.team_invites (team_id, role) select id, 'coach' from ids where key = 'teamB' returning token)
insert into ids (key, token) select 'inviteB', token from i;
with i as (insert into public.team_invites (team_id, role) select id, 'player' from ids where key = 'teamB' returning token)
insert into ids (key, token) select 'inviteP', token from i;

select pg_temp.act_as('eeeeeeee-0000-0000-0000-000000000005');
select public.create_club('Anderer Verein');

select pg_temp.act_as('cccccccc-0000-0000-0000-000000000003');
select public.accept_team_invite((select token from ids where key = 'inviteB'));
select pg_temp.act_as('dddddddd-0000-0000-0000-000000000004');
select public.accept_team_invite((select token from ids where key = 'inviteP'));

-- Coach A: own drill with animation, a template with it and a public drill.
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000002');
select public.accept_team_invite((select token from ids where key = 'inviteA'));
with d as (
  insert into public.drills (team_id, title, category, duration_min, animation)
  select id, 'Pressing-Spiel', 'tactics', 20, '{"version": 1}'::jsonb from ids where key = 'teamA'
  returning id
)
insert into ids (key, id) select 'drillA', id from d;
with t as (
  insert into public.training_templates (team_id, title)
  select id, 'Pressing 90' from ids where key = 'teamA' returning id
)
insert into ids (key, id) select 'tpl', id from t;
insert into public.template_drills (template_id, drill_id, position, duration_min)
select (select id from ids where key = 'tpl'), '0d000000-0000-4000-8000-000000000001', 1, 15;
insert into public.template_drills (template_id, drill_id, position, duration_min, coach_notes)
select (select id from ids where key = 'tpl'), (select id from ids where key = 'drillA'), 2, 25, 'Hoch anlaufen';

select is(
  (select drill_count || '/' || total_minutes from public.list_training_templates((select id from ids where key = 'teamA'))),
  '2/40', 'the list shows drills and total minutes'
);

-- Coach B cannot see the template before it is shared, nor add other teams' drills.
select pg_temp.act_as('cccccccc-0000-0000-0000-000000000003');
select is(
  (select count(*)::int from public.list_training_templates((select id from ids where key = 'teamB'))), 0,
  'private templates are not visible to other teams'
);
select is((select count(*)::int from public.template_items((select id from ids where key = 'tpl'))), 0,
  'items of private templates are hidden');
with t as (insert into public.training_templates (team_id, title) select id, 'Eigene' from ids where key = 'teamB' returning id)
insert into ids (key, id) select 'tplB', id from t;
select throws_ok(
  $$ insert into public.template_drills (template_id, drill_id)
     select (select id from ids where key = 'tplB'), (select id from ids where key = 'drillA') $$,
  '42501', null, 'templates cannot use drills of other teams'
);

-- Coach A shares it.
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000002');
update public.training_templates set shared = true where id = (select id from ids where key = 'tpl');

select pg_temp.act_as('cccccccc-0000-0000-0000-000000000003');
select is(
  (select team_name || ':' || is_own from public.list_training_templates((select id from ids where key = 'teamB')) where id = (select id from ids where key = 'tpl')),
  'U17:false', 'shared templates appear for the other coaches of the club'
);
select is(
  (select string_agg(drill_title, ', ' order by item_position) from public.template_items((select id from ids where key = 'tpl'))),
  (select title from public.drills where id = '0d000000-0000-4000-8000-000000000001') || ', Pressing-Spiel',
  'items of shared templates show the drill titles'
);
select is(
  (select count(*)::int from public.training_templates where id = (select id from ids where key = 'tpl')
     and title = 'Pressing 90'), 1, 'shared templates are readable'
);
update public.training_templates set title = 'Gekapert' where id = (select id from ids where key = 'tpl');
select is(
  (select title from public.training_templates where id = (select id from ids where key = 'tpl')),
  'Pressing 90', 'shared templates cannot be changed by other teams'
);

-- Coach B applies it to a training of U19.
with e as (insert into public.events (team_id, type, starts_at) select id, 'training', now() + interval '2 days' from ids where key = 'teamB' returning id)
insert into ids (key, id) select 'eventB', id from e;
select is(
  public.apply_training_template((select id from ids where key = 'tpl'), (select id from ids where key = 'eventB')),
  2, 'applying adds all drills'
);
select is(
  (select count(*)::int from public.drills where team_id = (select id from ids where key = 'teamB')
     and copied_from = (select id from ids where key = 'drillA') and animation is not null),
  1, 'drills of the other team are copied with their animation'
);
select is(
  (select string_agg(coalesce(ed.duration_min::text, '-') || ' ' || coalesce(ed.coach_notes, ''), '|' order by ed.position)
   from public.event_drills ed where ed.event_id = (select id from ids where key = 'eventB')),
  '15 |25 Hoch anlaufen', 'durations and notes are taken over'
);
select ok(
  not exists (
    select 1 from public.event_drills ed join public.drills d on d.id = ed.drill_id
    where ed.event_id = (select id from ids where key = 'eventB')
      and d.team_id is not null and d.team_id <> (select id from ids where key = 'teamB')
  ),
  'the plan only uses public and own drills'
);
select public.apply_training_template((select id from ids where key = 'tpl'), (select id from ids where key = 'eventB'));
select is(
  (select count(*)::int from public.drills where team_id = (select id from ids where key = 'teamB')
     and copied_from = (select id from ids where key = 'drillA')),
  1, 'applying again reuses the earlier copy'
);

-- Save a plan as a template.
insert into ids (key, id)
select 'fromPlan', (public.create_template_from_event((select id from ids where key = 'eventB'), 'Aus dem Plan')).id;
select is(
  (select count(*)::int from public.template_drills where template_id = (select id from ids where key = 'fromPlan')),
  4, 'a plan can be saved as a template'
);

-- Players and other clubs
select pg_temp.act_as('dddddddd-0000-0000-0000-000000000004');
select is((select count(*)::int from public.training_templates), 0, 'players do not see templates');
select throws_ok(
  $$ select public.apply_training_template((select id from ids where key = 'tpl'), (select id from ids where key = 'eventB')) $$,
  '42501', null, 'players cannot apply templates'
);
select pg_temp.act_as('eeeeeeee-0000-0000-0000-000000000005');
select is((select count(*)::int from public.training_templates), 0, 'other clubs do not see shared templates');

-- Deleting a drill removes it from templates.
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000002');
delete from public.event_drills where drill_id = (select id from ids where key = 'drillA');
delete from public.drills where id = (select id from ids where key = 'drillA');
select is(
  (select count(*)::int from public.template_drills where template_id = (select id from ids where key = 'tpl')),
  1, 'deleted drills disappear from templates'
);

select * from finish();
rollback;
