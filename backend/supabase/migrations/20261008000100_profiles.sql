-- Phase 1: user profiles, created automatically on sign-up.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  avatar_url text,
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'Public profile per auth user. Rows are created by the on_auth_user_created trigger.';

alter table public.profiles enable row level security;

-- Phase 1: users only see their own profile. Phase 2 extends this to team mates.
create policy "profiles: read own"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy "profiles: update own"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- No insert/delete policies: rows are managed by the trigger and the FK cascade.
-- Only the editable columns may be updated by clients.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(
      coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
        split_part(coalesce(new.email, ''), '@', 1)
      ),
      60
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
