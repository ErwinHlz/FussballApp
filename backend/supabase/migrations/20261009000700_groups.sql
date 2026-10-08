-- Phase 7: groups per drill of a training (bib colors) and player assignments.

create table public.drill_groups (
  id uuid primary key default gen_random_uuid(),
  event_drill_id uuid not null references public.event_drills (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 30),
  -- Bib color key, rendered via design tokens (--bib-<color>).
  color text not null check (color in ('red', 'blue', 'yellow', 'green', 'orange', 'white')),
  created_at timestamptz not null default now()
);

create table public.group_assignments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.drill_groups (id) on delete cascade,
  member_id uuid not null references public.team_members (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (group_id, member_id)
);

create index drill_groups_event_drill_idx on public.drill_groups (event_drill_id);
create index group_assignments_member_idx on public.group_assignments (member_id);

-- ---------------------------------------------------------------------------
-- Helpers and RLS (same visibility as the plan: coaches always, players once published)
-- ---------------------------------------------------------------------------

create function public.event_drill_event_id(p_event_drill_id uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select event_id from public.event_drills where id = p_event_drill_id;
$$;

create function public.drill_group_event_id(p_group_id uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select ed.event_id
  from public.drill_groups g
  join public.event_drills ed on ed.id = g.event_drill_id
  where g.id = p_group_id;
$$;

alter table public.drill_groups enable row level security;
alter table public.group_assignments enable row level security;

create policy "drill_groups: coaches read" on public.drill_groups
  for select to authenticated
  using (public.is_team_coach(public.event_team_id(public.event_drill_event_id(event_drill_id))));
create policy "drill_groups: members read published" on public.drill_groups
  for select to authenticated
  using (
    public.event_plan_published(public.event_drill_event_id(event_drill_id))
    and public.is_team_member(public.event_team_id(public.event_drill_event_id(event_drill_id)))
  );
create policy "drill_groups: coaches write" on public.drill_groups
  for all to authenticated
  using (public.is_team_coach(public.event_team_id(public.event_drill_event_id(event_drill_id))))
  with check (public.is_team_coach(public.event_team_id(public.event_drill_event_id(event_drill_id))));

create policy "group_assignments: coaches read" on public.group_assignments
  for select to authenticated
  using (public.is_team_coach(public.event_team_id(public.drill_group_event_id(group_id))));
create policy "group_assignments: members read published" on public.group_assignments
  for select to authenticated
  using (
    public.event_plan_published(public.drill_group_event_id(group_id))
    and public.is_team_member(public.event_team_id(public.drill_group_event_id(group_id)))
  );
create policy "group_assignments: coaches write" on public.group_assignments
  for all to authenticated
  using (public.is_team_coach(public.event_team_id(public.drill_group_event_id(group_id))))
  with check (public.is_team_coach(public.event_team_id(public.drill_group_event_id(group_id))));

revoke all on public.drill_groups, public.group_assignments from anon;

revoke execute on function public.event_drill_event_id, public.drill_group_event_id from anon, public;
grant execute on function public.event_drill_event_id, public.drill_group_event_id to authenticated;

-- ---------------------------------------------------------------------------
-- Save all groups of one drill at once.
-- p_groups: [{ "name": "Rot", "color": "red", "member_ids": ["…", "…"] }, …]
-- Runs as the caller (RLS decides). A player may only be in one group per drill, and only
-- members of the event's team can be assigned.
-- ---------------------------------------------------------------------------

create function public.set_drill_groups(p_event_drill_id uuid, p_groups jsonb)
returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  v_team_id uuid := public.event_team_id(public.event_drill_event_id(p_event_drill_id));
  v_group jsonb;
  v_group_id uuid;
  v_all_members uuid[];
begin
  if v_team_id is null or not public.is_team_coach(v_team_id) then
    raise exception 'only coaches can set groups' using errcode = '42501';
  end if;
  if jsonb_array_length(coalesce(p_groups, '[]'::jsonb)) > 12 then
    raise exception 'too many groups' using errcode = 'P0001', hint = 'too_many_groups';
  end if;

  select coalesce(array_agg(m::uuid), '{}') into v_all_members
  from jsonb_array_elements(coalesce(p_groups, '[]'::jsonb)) g,
       jsonb_array_elements_text(coalesce(g -> 'member_ids', '[]'::jsonb)) m;

  if cardinality(v_all_members) <> (select count(distinct x) from unnest(v_all_members) x) then
    raise exception 'player in more than one group' using errcode = 'P0001', hint = 'duplicate_member';
  end if;
  if exists (
    select 1 from unnest(v_all_members) x
    where not exists (select 1 from public.team_members where id = x and team_id = v_team_id)
  ) then
    raise exception 'member not in team' using errcode = 'P0001', hint = 'foreign_member';
  end if;

  delete from public.drill_groups where event_drill_id = p_event_drill_id;

  for v_group in select * from jsonb_array_elements(coalesce(p_groups, '[]'::jsonb)) loop
    insert into public.drill_groups (event_drill_id, name, color)
    values (p_event_drill_id, trim(v_group ->> 'name'), v_group ->> 'color')
    returning id into v_group_id;

    insert into public.group_assignments (group_id, member_id)
    select v_group_id, m::uuid
    from jsonb_array_elements_text(coalesce(v_group -> 'member_ids', '[]'::jsonb)) m;
  end loop;
end;
$$;

revoke execute on function public.set_drill_groups from anon, public;
grant execute on function public.set_drill_groups to authenticated;

-- ---------------------------------------------------------------------------
-- Linking a manual player keeps group assignments too (see Phase 3 / 4).
-- ---------------------------------------------------------------------------

create or replace function public.link_team_member(p_manual_member_id uuid, p_account_member_id uuid)
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

  -- Answers: the account's own answers win.
  delete from public.attendances a
  where a.member_id = v_manual.id
    and exists (select 1 from public.attendances b where b.member_id = v_account.id and b.event_id = a.event_id);
  update public.attendances set member_id = v_manual.id where member_id = v_account.id;

  -- Nominations and group assignments: the manual entry's (coach-made) choices win.
  delete from public.match_squad a
  where a.member_id = v_account.id
    and exists (select 1 from public.match_squad b where b.member_id = v_manual.id and b.event_id = a.event_id);
  update public.match_squad set member_id = v_manual.id where member_id = v_account.id;

  delete from public.group_assignments a
  using public.drill_groups g
  where a.group_id = g.id
    and a.member_id = v_account.id
    and exists (
      select 1 from public.group_assignments b
      join public.drill_groups bg on bg.id = b.group_id
      where b.member_id = v_manual.id and bg.event_drill_id = g.event_drill_id
    );
  update public.group_assignments set member_id = v_manual.id where member_id = v_account.id;

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

alter publication supabase_realtime add table public.drill_groups, public.group_assignments;
