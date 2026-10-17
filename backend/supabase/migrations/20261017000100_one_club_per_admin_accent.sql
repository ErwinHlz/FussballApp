-- Wish list F6: a user manages at most one club, and every account picks its own accent color
-- (default: the color of the club).

-- ---------------------------------------------------------------------------
-- One club per admin
-- ---------------------------------------------------------------------------

-- Older data: whoever administers several clubs keeps the oldest one; in the others the role
-- becomes 'member' as long as another admin remains there.
update public.club_members m
set role = 'member'
where m.role = 'admin'
  and exists (
    select 1 from public.club_members older
    where older.user_id = m.user_id and older.role = 'admin' and older.created_at < m.created_at
  )
  and exists (
    select 1 from public.club_members other
    where other.club_id = m.club_id and other.role = 'admin' and other.user_id <> m.user_id
  );

create unique index club_members_one_admin_club_idx
  on public.club_members (user_id) where role = 'admin';

create or replace function public.create_club(p_name text)
returns public.clubs
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_club public.clubs;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if exists (select 1 from public.club_members where user_id = v_uid and role = 'admin') then
    raise exception 'already manages a club' using errcode = 'P0001', hint = 'already_admin';
  end if;

  insert into public.clubs (name, created_by) values (trim(p_name), v_uid)
  returning * into v_club;

  insert into public.club_members (club_id, user_id, role) values (v_club.id, v_uid, 'admin');

  return v_club;
end;
$$;

create or replace function public.set_club_member_role(
  p_club_id uuid,
  p_user_id uuid,
  p_role public.club_role
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_club_admin(p_club_id) then
    raise exception 'only club admins can change roles' using errcode = '42501';
  end if;

  if p_role = 'member' and (
    select count(*) from public.club_members
    where club_id = p_club_id and role = 'admin' and user_id <> p_user_id
  ) = 0 then
    raise exception 'a club needs at least one admin' using errcode = 'P0001', hint = 'last_admin';
  end if;

  if p_role = 'admin' and exists (
    select 1 from public.club_members
    where user_id = p_user_id and role = 'admin' and club_id <> p_club_id
  ) then
    raise exception 'already manages another club' using errcode = 'P0001', hint = 'already_admin';
  end if;

  update public.club_members set role = p_role
  where club_id = p_club_id and user_id = p_user_id;

  if not found then
    raise exception 'not a club member' using errcode = 'P0002';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Accent color per account
-- ---------------------------------------------------------------------------

-- NULL = the club's color (or the app's default without one), 'default' = always the app's
-- default green, otherwise a hex color.
alter table public.profiles
  add column accent_color text
  check (accent_color is null or accent_color = 'default' or accent_color ~ '^#[0-9a-f]{6}$');

grant update (accent_color) on public.profiles to authenticated;
