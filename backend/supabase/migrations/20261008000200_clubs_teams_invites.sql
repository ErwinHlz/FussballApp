-- Phase 2: clubs, teams, memberships and invite links.
--
-- Structure: club -> teams -> team_members.
-- Any user can create a club and becomes its admin. Admins create teams and invite a coach
-- per team via a coach invite link. Coaches (and admins) invite players via player invite links.

create type public.club_role as enum ('admin', 'member');
create type public.team_role as enum ('coach', 'player');
create type public.member_status as enum ('active', 'injured', 'inactive');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 80),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.club_members (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.club_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (club_id, user_id)
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  season text check (char_length(season) <= 20),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  -- NULL = player without an account, maintained by the coach (Phase 3).
  user_id uuid references public.profiles (id) on delete set null,
  role public.team_role not null default 'player',
  display_name text not null check (char_length(trim(display_name)) between 1 and 60),
  shirt_number int check (shirt_number between 0 and 99),
  positions text[] not null default '{}',
  status public.member_status not null default 'active',
  created_at timestamptz not null default now()
);

create unique index team_members_team_user_key
  on public.team_members (team_id, user_id)
  where user_id is not null;

create table public.team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  -- 256 random bits, URL safe.
  token text not null unique
    default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  role public.team_role not null,
  expires_at timestamptz not null default now() + interval '14 days',
  created_by uuid not null default auth.uid() references public.profiles (id),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index club_members_user_idx on public.club_members (user_id);
create index teams_club_idx on public.teams (club_id);
create index team_members_user_idx on public.team_members (user_id);
create index team_invites_team_idx on public.team_invites (team_id);

-- ---------------------------------------------------------------------------
-- Helper functions (security definer to avoid RLS recursion)
-- ---------------------------------------------------------------------------

create function public.is_club_member(p_club_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.club_members
    where club_id = p_club_id and user_id = (select auth.uid())
  );
$$;

create function public.is_club_admin(p_club_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.club_members
    where club_id = p_club_id and user_id = (select auth.uid()) and role = 'admin'
  );
$$;

-- True for members of the team and for admins of the team's club.
create function public.is_team_member(p_team_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id = (select auth.uid())
  ) or exists (
    select 1 from public.teams t
    join public.club_members cm on cm.club_id = t.club_id
    where t.id = p_team_id and cm.user_id = (select auth.uid()) and cm.role = 'admin'
  );
$$;

-- True for coaches of the team and for admins of the team's club.
create function public.is_team_coach(p_team_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id = (select auth.uid()) and role = 'coach'
  ) or exists (
    select 1 from public.teams t
    join public.club_members cm on cm.club_id = t.club_id
    where t.id = p_team_id and cm.user_id = (select auth.uid()) and cm.role = 'admin'
  );
$$;

create function public.team_club_id(p_team_id uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select club_id from public.teams where id = p_team_id;
$$;

-- True if the current user shares a club with the given user (to show names).
create function public.shares_club_with(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.club_members me
    join public.club_members other on other.club_id = me.club_id
    where me.user_id = (select auth.uid()) and other.user_id = p_user_id
  );
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.clubs enable row level security;
alter table public.club_members enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.team_invites enable row level security;

-- Clubs: created via create_club(); members read, admins rename.
create policy "clubs: members read" on public.clubs
  for select to authenticated using (public.is_club_member(id));
create policy "clubs: admins update" on public.clubs
  for update to authenticated
  using (public.is_club_admin(id)) with check (public.is_club_admin(id));

-- Club members: managed via accept_team_invite() / set_club_member_role().
create policy "club_members: members read" on public.club_members
  for select to authenticated using (public.is_club_member(club_id));

-- Teams
-- is_club_admin(club_id) is checked directly so `insert ... returning` works: helper functions
-- run on the statement snapshot and do not see the row being inserted.
create policy "teams: members read" on public.teams
  for select to authenticated using (public.is_club_admin(club_id) or public.is_team_member(id));
create policy "teams: admins create" on public.teams
  for insert to authenticated
  with check (public.is_club_admin(club_id) and created_by = (select auth.uid()));
create policy "teams: coaches update" on public.teams
  for update to authenticated
  using (public.is_team_coach(id)) with check (public.is_team_coach(id));
create policy "teams: admins delete" on public.teams
  for delete to authenticated using (public.is_club_admin(club_id));

-- Team members: everyone in the team reads the squad, coaches manage it.
create policy "team_members: members read" on public.team_members
  for select to authenticated using (public.is_team_member(team_id));
create policy "team_members: coaches insert" on public.team_members
  for insert to authenticated with check (public.is_team_coach(team_id));
create policy "team_members: coaches update" on public.team_members
  for update to authenticated
  using (public.is_team_coach(team_id)) with check (public.is_team_coach(team_id));
create policy "team_members: coaches delete" on public.team_members
  for delete to authenticated using (public.is_team_coach(team_id));

-- Invites: player invites by coaches/admins, coach invites by club admins only.
create policy "team_invites: coaches read" on public.team_invites
  for select to authenticated using (public.is_team_coach(team_id));
create policy "team_invites: create" on public.team_invites
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      (role = 'player' and public.is_team_coach(team_id))
      or (role = 'coach' and public.is_club_admin(public.team_club_id(team_id)))
    )
  );
create policy "team_invites: revoke" on public.team_invites
  for update to authenticated
  using (
    (role = 'player' and public.is_team_coach(team_id))
    or (role = 'coach' and public.is_club_admin(public.team_club_id(team_id)))
  )
  with check (revoked_at is not null);

-- Profiles: also visible to people in the same club (names in member lists).
create policy "profiles: read club mates" on public.profiles
  for select to authenticated using (public.shares_club_with(id));

-- Column-level privileges: clients may only touch editable columns.
revoke insert, update, delete on public.clubs, public.club_members from anon, authenticated;
grant update (name) on public.clubs to authenticated;

revoke update on public.teams from anon, authenticated;
grant update (name, season) on public.teams to authenticated;

revoke update on public.team_members from anon, authenticated;
grant update (user_id, role, display_name, shirt_number, positions, status)
  on public.team_members to authenticated;

revoke insert, update on public.team_invites from anon, authenticated;
grant insert (team_id, role, expires_at, created_by) on public.team_invites to authenticated;
grant update (revoked_at) on public.team_invites to authenticated;

revoke all on public.clubs, public.club_members, public.teams, public.team_members,
  public.team_invites from anon;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Creates a club and makes the caller its admin.
create function public.create_club(p_name text)
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

  insert into public.clubs (name, created_by) values (trim(p_name), v_uid)
  returning * into v_club;

  insert into public.club_members (club_id, user_id, role) values (v_club.id, v_uid, 'admin');

  return v_club;
end;
$$;

-- Public invite preview (works without an account; the token is the secret).
create function public.get_team_invite(p_token text)
returns table (
  club_name text,
  team_name text,
  team_season text,
  role public.team_role,
  expires_at timestamptz,
  status text
)
language sql stable security definer set search_path = ''
as $$
  select
    c.name,
    t.name,
    t.season,
    i.role,
    i.expires_at,
    case
      when i.revoked_at is not null then 'revoked'
      when i.expires_at <= now() then 'expired'
      else 'valid'
    end
  from public.team_invites i
  join public.teams t on t.id = i.team_id
  join public.clubs c on c.id = t.club_id
  where i.token = p_token;
$$;

-- Joins the caller to the invite's team (and club). Returns the team id.
-- Re-using a link is harmless; a coach invite upgrades an existing player to coach.
create function public.accept_team_invite(p_token text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_invite public.team_invites;
  v_club_id uuid;
  v_name text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into v_invite from public.team_invites where token = p_token;
  if not found then
    raise exception 'invite not found' using errcode = 'P0002';
  end if;
  if v_invite.revoked_at is not null or v_invite.expires_at <= now() then
    raise exception 'invite expired' using errcode = 'P0001', hint = 'invite_expired';
  end if;

  select club_id into v_club_id from public.teams where id = v_invite.team_id;

  insert into public.club_members (club_id, user_id, role)
  values (v_club_id, v_uid, 'member')
  on conflict (club_id, user_id) do nothing;

  select coalesce(nullif(trim(display_name), ''), 'Player') into v_name
  from public.profiles where id = v_uid;

  insert into public.team_members (team_id, user_id, role, display_name)
  values (v_invite.team_id, v_uid, v_invite.role, left(v_name, 60))
  on conflict (team_id, user_id) where user_id is not null
  do update set role = case
    when excluded.role = 'coach' then 'coach'::public.team_role
    else public.team_members.role
  end;

  return v_invite.team_id;
end;
$$;

-- Promote/demote club members. The last admin cannot be demoted.
create function public.set_club_member_role(p_club_id uuid, p_user_id uuid, p_role public.club_role)
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

  update public.club_members set role = p_role
  where club_id = p_club_id and user_id = p_user_id;

  if not found then
    raise exception 'not a club member' using errcode = 'P0002';
  end if;
end;
$$;

-- Teams the caller belongs to or administers, with the caller's roles.
create function public.my_teams()
returns table (
  team_id uuid,
  team_name text,
  team_season text,
  club_id uuid,
  club_name text,
  team_role public.team_role,
  is_club_admin boolean
)
language sql stable security invoker set search_path = ''
as $$
  select t.id, t.name, t.season, c.id, c.name, tm.role, coalesce(cm.role = 'admin', false)
  from public.teams t
  join public.clubs c on c.id = t.club_id
  left join public.team_members tm on tm.team_id = t.id and tm.user_id = (select auth.uid())
  left join public.club_members cm on cm.club_id = c.id and cm.user_id = (select auth.uid())
  where tm.id is not null or cm.role = 'admin'
  order by c.name, t.name;
$$;

-- Clubs of the caller with the caller's club role.
create function public.my_clubs()
returns table (club_id uuid, club_name text, role public.club_role)
language sql stable security invoker set search_path = ''
as $$
  select c.id, c.name, cm.role
  from public.club_members cm
  join public.clubs c on c.id = cm.club_id
  where cm.user_id = (select auth.uid())
  order by c.name;
$$;

revoke execute on function public.create_club, public.accept_team_invite,
  public.set_club_member_role, public.my_teams, public.my_clubs from anon, public;
grant execute on function public.create_club, public.accept_team_invite,
  public.set_club_member_role, public.my_teams, public.my_clubs to authenticated;

revoke execute on function public.get_team_invite from public;
grant execute on function public.get_team_invite to anon, authenticated;

revoke execute on function public.is_club_member, public.is_club_admin, public.is_team_member,
  public.is_team_coach, public.team_club_id, public.shares_club_with from anon, public;
grant execute on function public.is_club_member, public.is_club_admin, public.is_team_member,
  public.is_team_coach, public.team_club_id, public.shares_club_with to authenticated;
