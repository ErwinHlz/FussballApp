-- Video storage checks (Phase 10). Run with `npm run test:db`.
-- Inserts into storage.objects directly to exercise the RLS policies (no file content needed).
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

select is(
  (select file_size_limit::bigint from storage.buckets where id = 'drill-videos'),
  52428800::bigint,
  'bucket limits uploads to 50 MB'
);
select ok(
  (select not public and allowed_mime_types @> array['video/mp4'] from storage.buckets where id = 'drill-videos'),
  'bucket is private and accepts mp4'
);

set local role authenticated;

select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');
insert into ids (key, id) select 'club', (public.create_club('FC Video')).id;
with t as (insert into public.teams (club_id, name) select id, 'U10' from ids where key = 'club' returning id)
insert into ids (key, id) select 'team', id from t;
with p as (insert into public.team_invites (team_id, role) select id, 'player' from ids where key = 'team' returning token)
insert into ids (key, token) select 'player_invite', token from p;
with d as (insert into public.drills (team_id, title, category) select id, 'Video-Übung', 'game' from ids where key = 'team' returning id)
insert into ids (key, id) select 'drill', id from d;
insert into ids (key, token)
select 'path', (select id from ids where key = 'team')::text || '/' || (select id from ids where key = 'drill')::text || '/clip.mp4';

select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id) values ('drill-videos', (select token from ids where key = 'path'), auth.uid()::text) $$,
  'coach uploads into the folder of an own drill'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id) values ('drill-videos', (select id from ids where key = 'team')::text || '/0d000000-0000-4000-8000-000000000001/x.mp4', auth.uid()::text) $$,
  '42501', null, 'coach cannot upload into a folder of a foreign drill'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id) values ('drill-videos', 'random/x.mp4', auth.uid()::text) $$,
  '42501', null, 'paths must follow team/drill/file'
);

select lives_ok(
  $$ update public.drills set video_path = (select token from ids where key = 'path') where id = (select id from ids where key = 'drill') $$,
  'coach links the uploaded video to the drill'
);
select throws_ok(
  $$ update public.drills set video_path = 'other-team/other-drill/x.mp4' where id = (select id from ids where key = 'drill') $$,
  '23514', null, 'video_path must point into the drill''s own folder'
);

-- Player reads, cannot write.
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000002');
select public.accept_team_invite((select token from ids where key = 'player_invite'));
select is(
  (select count(*)::int from storage.objects where bucket_id = 'drill-videos'),
  1,
  'team members can read the video'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id) values ('drill-videos', (select id from ids where key = 'team')::text || '/' || (select id from ids where key = 'drill')::text || '/p.mp4', auth.uid()::text) $$,
  '42501', null, 'players cannot upload'
);

-- Outsider sees nothing.
select pg_temp.act_as('dddddddd-0000-0000-0000-000000000004');
select is(
  (select count(*)::int from storage.objects where bucket_id = 'drill-videos'),
  0,
  'outsiders cannot see team videos'
);

-- Deleting is only possible via the Storage API (covered by the end-to-end check).

select * from finish();
rollback;
