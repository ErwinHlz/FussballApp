-- Phase 3: squad management.

-- Position groups used for filters and later for balancing groups (Phase 7).
alter table public.team_members
  add constraint team_members_positions_check
  check (positions <@ array['GK', 'DF', 'MF', 'FW']::text[]);

-- A shirt number is used at most once per team.
create unique index team_members_team_shirt_key
  on public.team_members (team_id, shirt_number)
  where shirt_number is not null;

-- Coaches may only add players without an account. Accounts join via invite links and are
-- linked via link_team_member(); otherwise a coach could add arbitrary users to a team.
drop policy "team_members: coaches insert" on public.team_members;
create policy "team_members: coaches insert manual players" on public.team_members
  for insert to authenticated
  with check (public.is_team_coach(team_id) and user_id is null);

revoke insert, update on public.team_members from authenticated;
grant insert (team_id, role, display_name, shirt_number, positions, status)
  on public.team_members to authenticated;
grant update (role, display_name, shirt_number, positions, status)
  on public.team_members to authenticated;

-- Merges a manually maintained player (no account) with the entry created when that person
-- joined via invite link. The manual entry keeps its id and squad data and gets the account;
-- the duplicate entry from joining is removed.
-- NOTE for later phases: rows referencing the removed entry (e.g. attendances) must be moved
-- to the manual entry here before deleting it.
create function public.link_team_member(p_manual_member_id uuid, p_account_member_id uuid)
returns public.team_members
language plpgsql security definer set search_path = ''
as $$
declare
  v_manual public.team_members;
  v_account public.team_members;
  v_result public.team_members;
begin
  select * into v_manual from public.team_members where id = p_manual_member_id for update;
  select * into v_account from public.team_members where id = p_account_member_id for update;

  if v_manual.id is null or v_account.id is null then
    raise exception 'member not found' using errcode = 'P0002';
  end if;
  if not public.is_team_coach(v_manual.team_id) then
    raise exception 'only coaches can link players' using errcode = '42501';
  end if;
  if v_manual.team_id <> v_account.team_id then
    raise exception 'members belong to different teams' using errcode = 'P0001', hint = 'different_teams';
  end if;
  if v_manual.user_id is not null then
    raise exception 'player already has an account' using errcode = 'P0001', hint = 'already_linked';
  end if;
  if v_account.user_id is null then
    raise exception 'target has no account' using errcode = 'P0001', hint = 'no_account';
  end if;

  delete from public.team_members where id = v_account.id;

  update public.team_members
  set
    user_id = v_account.user_id,
    role = case when v_account.role = 'coach' then 'coach'::public.team_role else v_manual.role end
  where id = v_manual.id
  returning * into v_result;

  return v_result;
end;
$$;

revoke execute on function public.link_team_member from anon, public;
grant execute on function public.link_team_member to authenticated;
