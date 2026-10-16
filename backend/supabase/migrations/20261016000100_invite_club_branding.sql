-- The invite page shows the club's logo and color (both are public anyway: the logo bucket is
-- public, the color is used for the app theme). Return type changes, so drop and recreate.
drop function public.get_team_invite(text);

create function public.get_team_invite(p_token text)
returns table (
  club_name text,
  team_name text,
  team_season text,
  role public.team_role,
  expires_at timestamptz,
  status text,
  club_logo_path text,
  club_accent_color text
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
    end,
    c.logo_path,
    c.accent_color
  from public.team_invites i
  join public.teams t on t.id = i.team_id
  join public.clubs c on c.id = t.club_id
  where i.token = p_token;
$$;

revoke execute on function public.get_team_invite from public;
grant execute on function public.get_team_invite to anon, authenticated;
