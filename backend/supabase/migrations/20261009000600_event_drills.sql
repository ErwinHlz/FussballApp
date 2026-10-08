-- Phase 6: training content (drills of a training event) and plan publishing.

create table public.event_drills (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  -- Restrict: a drill used in a plan cannot be deleted silently.
  drill_id uuid not null references public.drills (id) on delete restrict,
  position int not null default 0,
  duration_min int check (duration_min between 1 and 180),
  coach_notes text check (char_length(coach_notes) <= 1000),
  created_at timestamptz not null default now()
);

create index event_drills_event_idx on public.event_drills (event_id, position);
create index event_drills_drill_idx on public.event_drills (drill_id);

-- When the plan was published (to spot players who decline afterwards).
alter table public.events add column plan_published_at timestamptz;

create function public.events_plan_published_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.plan_status = 'published' and old.plan_status is distinct from 'published' then
    new.plan_published_at := now();
  elsif new.plan_status = 'draft' then
    new.plan_published_at := null;
  end if;
  return new;
end;
$$;

create trigger events_plan_published_at
  before update of plan_status on public.events
  for each row execute function public.events_plan_published_at();

-- ---------------------------------------------------------------------------
-- Helpers and RLS
-- ---------------------------------------------------------------------------

create function public.is_training_event(p_event_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.events where id = p_event_id and type = 'training');
$$;

create function public.event_plan_published(p_event_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.events where id = p_event_id and plan_status = 'published'
  );
$$;

alter table public.event_drills enable row level security;

-- Coaches see drafts; players only published plans of their team.
create policy "event_drills: coaches read" on public.event_drills
  for select to authenticated
  using (public.is_team_coach(public.event_team_id(event_id)));
create policy "event_drills: members read published plans" on public.event_drills
  for select to authenticated
  using (
    public.event_plan_published(event_id)
    and public.is_team_member(public.event_team_id(event_id))
  );
create policy "event_drills: coaches write" on public.event_drills
  for all to authenticated
  using (public.is_team_coach(public.event_team_id(event_id)))
  with check (
    public.is_team_coach(public.event_team_id(event_id))
    and public.is_training_event(event_id)
  );

revoke all on public.event_drills from anon;
revoke insert, update on public.event_drills from authenticated;
grant insert (event_id, drill_id, position, duration_min, coach_notes)
  on public.event_drills to authenticated;
grant update (position, duration_min, coach_notes) on public.event_drills to authenticated;

revoke execute on function public.is_training_event, public.event_plan_published from anon, public;
grant execute on function public.is_training_event, public.event_plan_published to authenticated;

-- ---------------------------------------------------------------------------
-- RPCs (run as the caller, so RLS applies)
-- ---------------------------------------------------------------------------

-- Sets the order of a plan: p_ids in the desired order.
create function public.reorder_event_drills(p_event_id uuid, p_ids uuid[])
returns void
language sql security invoker set search_path = ''
as $$
  update public.event_drills ed
  set position = o.ord
  from unnest(p_ids) with ordinality as o(id, ord)
  where ed.id = o.id and ed.event_id = p_event_id;
$$;

-- Appends the plan of another training of the same team to the target training.
create function public.copy_event_plan(p_source_event_id uuid, p_target_event_id uuid)
returns int
language plpgsql security invoker set search_path = ''
as $$
declare
  v_offset int;
  v_count int;
begin
  if public.event_team_id(p_source_event_id) is distinct from public.event_team_id(p_target_event_id) then
    raise exception 'events belong to different teams' using errcode = 'P0001', hint = 'different_teams';
  end if;

  select coalesce(max(position), 0) into v_offset
  from public.event_drills where event_id = p_target_event_id;

  insert into public.event_drills (event_id, drill_id, position, duration_min, coach_notes)
  select p_target_event_id, drill_id, v_offset + row_number() over (order by position, created_at),
    duration_min, coach_notes
  from public.event_drills
  where event_id = p_source_event_id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.reorder_event_drills, public.copy_event_plan from anon, public;
grant execute on function public.reorder_event_drills, public.copy_event_plan to authenticated;

alter publication supabase_realtime add table public.event_drills;
