-- RLS checks for public.profiles. Run with `npm run test:db` (supabase test db).
begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

-- Two fake users (no real personal data).
insert into auth.users (id, email, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111111', 'coach.a@example.test', '{"display_name": "Coach A"}'),
  ('22222222-2222-2222-2222-222222222222', 'player.b@example.test', '{}');

select is(
  (select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Coach A',
  'trigger creates profile with display_name from metadata'
);

select is(
  (select display_name from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  'player.b',
  'trigger falls back to the email local part'
);

-- Act as user A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select is(
  (select count(*)::int from public.profiles),
  1,
  'user A only sees their own profile'
);

update public.profiles set display_name = 'Hacked' where id = '22222222-2222-2222-2222-222222222222';

update public.profiles set display_name = 'Coach Alpha' where id = '11111111-1111-1111-1111-111111111111';

select is(
  (select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Coach Alpha',
  'user A can rename themselves'
);

select throws_ok(
  $$ insert into public.profiles (id, display_name) values ('33333333-3333-3333-3333-333333333333', 'X') $$,
  '42501',
  null,
  'clients cannot insert profiles'
);

select throws_ok(
  $$ update public.profiles set id = '33333333-3333-3333-3333-333333333333' where id = '11111111-1111-1111-1111-111111111111' $$,
  '42501',
  null,
  'clients cannot change the profile id'
);

-- Back to superuser to verify user B was not modified.
reset role;
select is(
  (select display_name from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  'player.b',
  'user A cannot rename user B'
);

select * from finish();
rollback;
