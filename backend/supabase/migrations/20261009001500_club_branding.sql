-- Club branding: logo (public storage bucket) and accent color picked from the logo.
-- Path convention: <club_id>/<file>. Logos are public so they load without signed URLs.

alter table public.clubs
  add column logo_path text,
  add column accent_color text check (accent_color ~ '^#[0-9a-f]{6}$'),
  add constraint clubs_logo_path_check
    check (logo_path is null or logo_path ~ ('^' || id::text || '/[^/]+$'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'club-logos',
  'club-logos',
  true,
  2097152, -- 2 MB (the app uploads a downscaled image)
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Club id of a logo path, or NULL if the path does not follow the convention.
create function public.club_logo_club_id(p_name text)
returns uuid
language sql immutable set search_path = ''
as $$
  select case when p_name ~ '^[0-9a-f-]{36}/[^/]+$' then split_part(p_name, '/', 1)::uuid end;
$$;

revoke execute on function public.club_logo_club_id from anon, public;
grant execute on function public.club_logo_club_id to authenticated;

-- Reading works through the public URL; the select policy lets admins replace and remove files.
create policy "club-logos: admins read"
  on storage.objects for select to authenticated
  using (bucket_id = 'club-logos' and public.is_club_admin(public.club_logo_club_id(name)));
create policy "club-logos: admins upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'club-logos' and public.is_club_admin(public.club_logo_club_id(name)));
create policy "club-logos: admins update"
  on storage.objects for update to authenticated
  using (bucket_id = 'club-logos' and public.is_club_admin(public.club_logo_club_id(name)))
  with check (bucket_id = 'club-logos' and public.is_club_admin(public.club_logo_club_id(name)));
create policy "club-logos: admins delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'club-logos' and public.is_club_admin(public.club_logo_club_id(name)));

-- Admins set logo and color together (direct updates of clubs are not granted).
create function public.set_club_branding(p_club_id uuid, p_logo_path text, p_accent_color text)
returns public.clubs
language plpgsql security definer set search_path = ''
as $$
declare
  v_club public.clubs;
begin
  if not public.is_club_admin(p_club_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.clubs
  set logo_path = p_logo_path, accent_color = lower(p_accent_color)
  where id = p_club_id
  returning * into v_club;
  return v_club;
end;
$$;

revoke execute on function public.set_club_branding from anon, public;
grant execute on function public.set_club_branding to authenticated;

-- my_teams also returns the club branding so the app can theme itself for the active team.
drop function public.my_teams();
create function public.my_teams()
returns table (
  team_id uuid,
  team_name text,
  team_season text,
  club_id uuid,
  club_name text,
  team_role public.team_role,
  is_club_admin boolean,
  club_logo_path text,
  club_accent_color text
)
language sql stable security invoker set search_path = ''
as $$
  select t.id, t.name, t.season, c.id, c.name, tm.role, coalesce(cm.role = 'admin', false),
    c.logo_path, c.accent_color
  from public.teams t
  join public.clubs c on c.id = t.club_id
  left join public.team_members tm on tm.team_id = t.id and tm.user_id = (select auth.uid())
  left join public.club_members cm on cm.club_id = c.id and cm.user_id = (select auth.uid())
  where tm.id is not null or cm.role = 'admin'
  order by c.name, t.name;
$$;

revoke execute on function public.my_teams from anon, public;
grant execute on function public.my_teams to authenticated;
