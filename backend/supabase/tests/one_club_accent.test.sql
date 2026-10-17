-- F6: one club per admin, accent color per account.
begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f1', 'vera@example.test', '{"display_name": "Vera"}'),
  ('00000000-0000-0000-0000-0000000000f2', 'otto@example.test', '{"display_name": "Otto"}');

create function pg_temp.act_as(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;

-- Vera founds a club and cannot found a second one.
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f1');
select lives_ok($$ select public.create_club('SV Eins') $$, 'first club works');
select throws_ok(
  $$ select public.create_club('SV Zwei') $$,
  'P0001', 'already manages a club', 'a second club is refused'
);

-- Otto founds his own club; Vera joins it as a member.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f2');
select lives_ok($$ select public.create_club('FC Otto') $$, 'another user founds a club');
reset role;
insert into public.club_members (club_id, user_id, role)
select id, '00000000-0000-0000-0000-0000000000f1', 'member' from public.clubs where name = 'FC Otto';

-- Otto cannot make Vera an admin of his club: she already runs one.
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f2');
select throws_ok(
  $$ select public.set_club_member_role(
       (select id from public.clubs where name = 'FC Otto'),
       '00000000-0000-0000-0000-0000000000f1', 'admin') $$,
  'P0001', 'already manages another club', 'admin of a second club is refused'
);

-- Accent color: own profile, hex or 'default', nothing else.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f1');
select lives_ok(
  $$ update public.profiles set accent_color = '#1d4ed8'
     where id = '00000000-0000-0000-0000-0000000000f1' $$,
  'own accent color can be set'
);
select lives_ok(
  $$ update public.profiles set accent_color = 'default'
     where id = '00000000-0000-0000-0000-0000000000f1' $$,
  'the app default can be chosen'
);
select throws_ok(
  $$ update public.profiles set accent_color = 'red'
     where id = '00000000-0000-0000-0000-0000000000f1' $$,
  '23514', null, 'only hex colors are accepted'
);
update public.profiles set accent_color = '#000000'
where id = '00000000-0000-0000-0000-0000000000f2';
reset role;
select is(
  (select accent_color from public.profiles where id = '00000000-0000-0000-0000-0000000000f2'),
  null,
  'other profiles stay untouched'
);

select * from finish();
rollback;
