-- Club branding: logo uploads and accent color.
-- Inserts into storage.objects directly to exercise the RLS policies (no file content needed).
begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'admin@example.test', '{"display_name": "Admin"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'coach@example.test', '{"display_name": "Coach"}');

create function pg_temp.act_as(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;

create temp table ids (key text primary key, id uuid, token text);
grant all on ids to authenticated, anon;

set local role authenticated;
select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');
insert into ids (key, id) select 'club', (public.create_club('FC Farbe')).id;
with t as (insert into public.teams (club_id, name) select id, 'U17' from ids where key = 'club' returning id)
insert into ids (key, id) select 'team', id from t;
with i as (insert into public.team_invites (team_id, role) select id, 'coach' from ids where key = 'team' returning token)
insert into ids (key, token) select 'invite', token from i;

select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id)
     values ('club-logos', (select id from ids where key = 'club')::text || '/logo.webp', auth.uid()::text) $$,
  'admins upload the club logo'
);
select lives_ok(
  $$ select public.set_club_branding((select id from ids where key = 'club'),
       (select id from ids where key = 'club')::text || '/logo.webp', '#C8102E') $$,
  'admins set logo and color'
);
select is(
  (select club_accent_color from public.my_teams() limit 1), '#c8102e',
  'my_teams returns the (normalized) club color'
);
select throws_ok(
  $$ select public.set_club_branding((select id from ids where key = 'club'), null, 'red') $$,
  '23514', null, 'colors must be hex values'
);
select throws_ok(
  $$ select public.set_club_branding((select id from ids where key = 'club'),
       gen_random_uuid()::text || '/logo.webp', null) $$,
  '23514', null, 'the logo must be in the club folder'
);

-- A coach of the team is no club admin.
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000002');
select public.accept_team_invite((select token from ids where key = 'invite'));
select throws_ok(
  $$ select public.set_club_branding((select id from ids where key = 'club'), null, null) $$,
  '42501', null, 'coaches cannot change the branding'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id)
     values ('club-logos', (select id from ids where key = 'club')::text || '/other.webp', auth.uid()::text) $$,
  '42501', null, 'coaches cannot upload logos'
);
select is(
  (select club_logo_path from public.my_teams() limit 1),
  (select id from ids where key = 'club')::text || '/logo.webp',
  'members get the logo path for the header'
);

reset role;
select is(
  (select public from storage.buckets where id = 'club-logos'), true,
  'logos are served publicly'
);

select * from finish();
rollback;
