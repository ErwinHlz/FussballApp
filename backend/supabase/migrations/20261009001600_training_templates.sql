-- Training templates: reusable training plans without a date. Owned by a team, optionally
-- shared with the coaches of the club. Applying a template appends its drills to a training.

create table public.training_templates (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 2 and 80),
  description text not null default '' check (char_length(description) <= 2000),
  shared boolean not null default false,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.template_drills (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.training_templates (id) on delete cascade,
  -- Deleting a drill removes it from templates (unlike plans, templates have no history).
  drill_id uuid not null references public.drills (id) on delete cascade,
  position int not null default 0,
  duration_min int check (duration_min between 1 and 180),
  coach_notes text check (char_length(coach_notes) <= 1000),
  created_at timestamptz not null default now()
);

create index training_templates_team_idx on public.training_templates (team_id);
create index template_drills_template_idx on public.template_drills (template_id, position);
create index template_drills_drill_idx on public.template_drills (drill_id);

create function private.templates_touch()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger training_templates_touch before update on public.training_templates
  for each row execute function private.templates_touch();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Coach of any team of the club, or club admin.
create function public.is_club_coach(p_club_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_club_admin(p_club_id) or exists (
    select 1 from public.team_members tm
    join public.teams t on t.id = tm.team_id
    where t.club_id = p_club_id and tm.user_id = (select auth.uid()) and tm.role = 'coach'
  );
$$;

create function public.template_team_id(p_template_id uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select team_id from public.training_templates where id = p_template_id;
$$;

-- Own team's templates, or shared templates of the club, for coaches.
create function public.can_read_template(p_template_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.training_templates tt
    where tt.id = p_template_id
      and (
        public.is_team_coach(tt.team_id)
        or (tt.shared and public.is_club_coach(public.team_club_id(tt.team_id)))
      )
  );
$$;

-- Drills a team may put into its templates: the public library and its own drills.
create function public.drill_usable_by_team(p_drill_id uuid, p_team_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.drills
    where id = p_drill_id and (team_id is null or team_id = p_team_id)
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.training_templates enable row level security;
alter table public.template_drills enable row level security;

create policy "training_templates: coaches read own and shared" on public.training_templates
  for select to authenticated
  using (
    public.is_team_coach(team_id)
    or (shared and public.is_club_coach(public.team_club_id(team_id)))
  );
create policy "training_templates: coaches insert" on public.training_templates
  for insert to authenticated with check (public.is_team_coach(team_id));
create policy "training_templates: coaches update" on public.training_templates
  for update to authenticated
  using (public.is_team_coach(team_id)) with check (public.is_team_coach(team_id));
create policy "training_templates: coaches delete" on public.training_templates
  for delete to authenticated using (public.is_team_coach(team_id));

-- Items of shared templates are read through template_items() (drills of other teams are hidden).
create policy "template_drills: coaches read" on public.template_drills
  for select to authenticated
  using (public.is_team_coach(public.template_team_id(template_id)));
create policy "template_drills: coaches write" on public.template_drills
  for all to authenticated
  using (public.is_team_coach(public.template_team_id(template_id)))
  with check (
    public.is_team_coach(public.template_team_id(template_id))
    and public.drill_usable_by_team(drill_id, public.template_team_id(template_id))
  );

revoke all on public.training_templates, public.template_drills from anon;
revoke insert, update on public.training_templates, public.template_drills from authenticated;
grant insert (team_id, title, description, shared) on public.training_templates to authenticated;
grant update (title, description, shared) on public.training_templates to authenticated;
grant insert (template_id, drill_id, position, duration_min, coach_notes)
  on public.template_drills to authenticated;
grant update (position, duration_min, coach_notes) on public.template_drills to authenticated;

-- ---------------------------------------------------------------------------
-- Reading
-- ---------------------------------------------------------------------------

-- Templates a coach can use for a team: the team's own and those shared in the club.
create function public.list_training_templates(p_team_id uuid)
returns table (
  id uuid,
  team_id uuid,
  team_name text,
  title text,
  description text,
  shared boolean,
  is_own boolean,
  drill_count int,
  total_minutes int,
  updated_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select tt.id, tt.team_id, t.name, tt.title, tt.description, tt.shared,
    tt.team_id = p_team_id,
    (select count(*)::int from public.template_drills td where td.template_id = tt.id),
    (select coalesce(sum(coalesce(td.duration_min, d.duration_min, 0)), 0)::int
       from public.template_drills td join public.drills d on d.id = td.drill_id
       where td.template_id = tt.id),
    tt.updated_at
  from public.training_templates tt
  join public.teams t on t.id = tt.team_id
  where public.is_team_coach(p_team_id)
    and (
      tt.team_id = p_team_id
      or (tt.shared and t.club_id = public.team_club_id(p_team_id))
    )
  order by tt.team_id = p_team_id desc, tt.updated_at desc;
$$;

-- Items of a readable template with the drill summary (also for drills of other teams).
create function public.template_items(p_template_id uuid)
returns table (
  id uuid,
  item_position int,
  duration_min int,
  coach_notes text,
  drill_id uuid,
  drill_title text,
  drill_category text,
  drill_duration_min int,
  drill_team_id uuid
)
language sql stable security definer set search_path = ''
as $$
  select td.id, td.position, td.duration_min, td.coach_notes,
    d.id, d.title, d.category, d.duration_min, d.team_id
  from public.template_drills td
  join public.drills d on d.id = td.drill_id
  where td.template_id = p_template_id and public.can_read_template(p_template_id)
  order by td.position, td.created_at;
$$;

-- ---------------------------------------------------------------------------
-- Writing
-- ---------------------------------------------------------------------------

create function public.reorder_template_drills(p_template_id uuid, p_ids uuid[])
returns void
language sql security invoker set search_path = ''
as $$
  update public.template_drills td
  set position = o.ord
  from unnest(p_ids) with ordinality as o(id, ord)
  where td.id = o.id and td.template_id = p_template_id;
$$;

-- Saves the plan of a training as a new template of the same team.
create function public.create_template_from_event(p_event_id uuid, p_title text, p_shared boolean default false)
returns public.training_templates
language plpgsql security invoker set search_path = ''
as $$
declare
  v_template public.training_templates;
begin
  insert into public.training_templates (team_id, title, shared)
  values (public.event_team_id(p_event_id), trim(p_title), p_shared)
  returning * into v_template;

  insert into public.template_drills (template_id, drill_id, position, duration_min, coach_notes)
  select v_template.id, drill_id, row_number() over (order by position, created_at),
    duration_min, coach_notes
  from public.event_drills
  where event_id = p_event_id;

  return v_template;
end;
$$;

-- Appends a template to a training. Drills that belong to another team are copied into the
-- training's team first (an earlier copy is reused). Returns the number of added drills.
create function public.apply_training_template(p_template_id uuid, p_event_id uuid)
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_team uuid := public.event_team_id(p_event_id);
  v_offset int;
  v_count int := 0;
  v_item record;
  v_drill uuid;
begin
  if v_team is null or not public.is_team_coach(v_team) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not public.is_training_event(p_event_id) then
    raise exception 'not a training' using errcode = 'P0001', hint = 'not_a_training';
  end if;
  if not exists (
    select 1 from public.training_templates tt
    where tt.id = p_template_id
      and (tt.team_id = v_team
        or (tt.shared and public.team_club_id(tt.team_id) = public.team_club_id(v_team)))
  ) then
    raise exception 'template not available' using errcode = '42501';
  end if;

  select coalesce(max(position), 0) into v_offset
  from public.event_drills where event_id = p_event_id;

  for v_item in
    select td.*, d.team_id as drill_team_id
    from public.template_drills td
    join public.drills d on d.id = td.drill_id
    where td.template_id = p_template_id
    order by td.position, td.created_at
  loop
    v_drill := v_item.drill_id;
    if v_item.drill_team_id is not null and v_item.drill_team_id <> v_team then
      select id into v_drill from public.drills
      where team_id = v_team and copied_from = v_item.drill_id
      order by created_at limit 1;
      if v_drill is null then
        insert into public.drills (team_id, title, description, category, duration_min,
          min_players, max_players, equipment, video_url, animation, copied_from)
        select v_team, title, description, category, duration_min,
          min_players, max_players, equipment, video_url, animation, id
        from public.drills where id = v_item.drill_id
        returning id into v_drill;
      end if;
    end if;

    v_count := v_count + 1;
    insert into public.event_drills (event_id, drill_id, position, duration_min, coach_notes)
    values (p_event_id, v_drill, v_offset + v_count, v_item.duration_min, v_item.coach_notes);
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.is_club_coach, public.template_team_id, public.can_read_template,
  public.drill_usable_by_team, public.list_training_templates, public.template_items,
  public.reorder_template_drills, public.create_template_from_event,
  public.apply_training_template from anon, public;
grant execute on function public.is_club_coach, public.template_team_id, public.can_read_template,
  public.drill_usable_by_team, public.list_training_templates, public.template_items,
  public.reorder_template_drills, public.create_template_from_event,
  public.apply_training_template to authenticated;
