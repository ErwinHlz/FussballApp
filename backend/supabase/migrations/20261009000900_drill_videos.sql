-- Phase 10: video upload for drills (Supabase Storage).
-- Path convention: <team_id>/<drill_id>/<file>. Private bucket, read via signed URLs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'drill-videos',
  'drill-videos',
  false,
  52428800, -- 50 MB
  array['video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Team id of a storage path, or NULL if the path does not follow the convention.
create function public.drill_video_team_id(p_name text)
returns uuid
language sql immutable set search_path = ''
as $$
  select case
    when p_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[^/]+$' then split_part(p_name, '/', 1)::uuid
  end;
$$;

-- True if the path points into the folder of a drill that belongs to the path's team.
create function public.drill_video_path_valid(p_name text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.drills d
    where p_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[^/]+$'
      and d.team_id = split_part(p_name, '/', 1)::uuid
      and d.id = split_part(p_name, '/', 2)::uuid
  );
$$;

revoke execute on function public.drill_video_team_id, public.drill_video_path_valid from anon, public;
grant execute on function public.drill_video_team_id, public.drill_video_path_valid to authenticated;

create policy "drill-videos: team members read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'drill-videos'
    and public.is_team_member(public.drill_video_team_id(name))
  );

create policy "drill-videos: coaches upload into own drills"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'drill-videos'
    and public.is_team_coach(public.drill_video_team_id(name))
    and public.drill_video_path_valid(name)
  );

create policy "drill-videos: coaches update"
  on storage.objects for update to authenticated
  using (bucket_id = 'drill-videos' and public.is_team_coach(public.drill_video_team_id(name)))
  with check (
    bucket_id = 'drill-videos'
    and public.is_team_coach(public.drill_video_team_id(name))
    and public.drill_video_path_valid(name)
  );

create policy "drill-videos: coaches delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'drill-videos' and public.is_team_coach(public.drill_video_team_id(name)));

-- The drill may only reference a file inside its own folder.
alter table public.drills
  add constraint drills_video_path_check check (
    video_path is null
    or (team_id is not null and video_path like team_id::text || '/' || id::text || '/%')
  );

grant update (video_path) on public.drills to authenticated;
