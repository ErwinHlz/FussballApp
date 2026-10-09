-- Tactics board 2: standalone boards per team and a richer animation format
-- (more equipment, zones, ball carriers; see PLAN.md section 6). Still version 1: the format
-- only gained optional fields, existing animations stay valid.

-- Shape check shared by drills and boards (details are validated with Zod in the app).
create function public.is_valid_animation(p jsonb)
returns boolean
language sql immutable set search_path = ''
as $$
  select
    jsonb_typeof(p) = 'object'
    and p ->> 'version' = '1'
    and p ->> 'field' in ('full', 'half', 'quarter')
    and jsonb_typeof(p -> 'objects') = 'array'
    and jsonb_typeof(p -> 'keyframes') = 'array'
    and jsonb_array_length(p -> 'keyframes') between 1 and 30
    and jsonb_array_length(p -> 'objects') <= 60
    and octet_length(p::text) <= 150000;
$$;

alter table public.drills drop constraint drills_animation_check,
  add constraint drills_animation_check
    check (animation is null or public.is_valid_animation(animation));

create table public.tactic_boards (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 2 and 80),
  animation jsonb not null check (public.is_valid_animation(animation)),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tactic_boards_team_idx on public.tactic_boards (team_id, updated_at desc);

create trigger tactic_boards_touch before update on public.tactic_boards
  for each row execute function private.templates_touch();

alter table public.tactic_boards enable row level security;

-- Boards are coach material (set plays, ideas); players see animations through drills.
create policy "tactic_boards: coaches read" on public.tactic_boards
  for select to authenticated using (public.is_team_coach(team_id));
create policy "tactic_boards: coaches insert" on public.tactic_boards
  for insert to authenticated with check (public.is_team_coach(team_id));
create policy "tactic_boards: coaches update" on public.tactic_boards
  for update to authenticated
  using (public.is_team_coach(team_id)) with check (public.is_team_coach(team_id));
create policy "tactic_boards: coaches delete" on public.tactic_boards
  for delete to authenticated using (public.is_team_coach(team_id));

revoke all on public.tactic_boards from anon;
revoke insert, update on public.tactic_boards from authenticated;
grant insert (team_id, title, animation) on public.tactic_boards to authenticated;
grant update (title, animation) on public.tactic_boards to authenticated;
