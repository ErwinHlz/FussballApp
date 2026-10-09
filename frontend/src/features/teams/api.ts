import { supabase } from '@/lib/supabase'
import { LOGO_BUCKET } from '@/lib/clubTheme'
import type { Database, Tables } from '@/types/database'

type Functions = Database['public']['Functions']

export type TeamRole = Database['public']['Enums']['team_role']
export type ClubRole = Database['public']['Enums']['club_role']
// Generated types mark function results as non-null; clubs without branding return null.
export type MyTeam = Omit<
  Functions['my_teams']['Returns'][number],
  'club_logo_path' | 'club_accent_color'
> & { club_logo_path: string | null; club_accent_color: string | null }
export type MyClub = Functions['my_clubs']['Returns'][number]
export type InviteInfo = Functions['get_team_invite']['Returns'][number]
export type Club = Tables<'clubs'>
export type Team = Tables<'teams'>
export type TeamMember = Tables<'team_members'>
export type TeamInvite = Tables<'team_invites'>

export type ClubTeam = Team & { coaches: Pick<TeamMember, 'id' | 'display_name'>[] }
export type ClubMember = { user_id: string; role: ClubRole; display_name: string }

export function inviteUrl(token: string): string {
  return new URL(`/join/${token}`, window.location.origin).toString()
}

export async function fetchMyTeams(): Promise<MyTeam[]> {
  const { data, error } = await supabase.rpc('my_teams')
  if (error) throw error
  return data
}

export async function fetchMyClubs(): Promise<MyClub[]> {
  const { data, error } = await supabase.rpc('my_clubs')
  if (error) throw error
  return data
}

export async function createClub(name: string): Promise<Club> {
  const { data, error } = await supabase.rpc('create_club', { p_name: name })
  if (error) throw error
  return data
}

export async function fetchClub(clubId: string): Promise<Club> {
  const { data, error } = await supabase.from('clubs').select('*').eq('id', clubId).single()
  if (error) throw error
  return data
}

export async function fetchClubTeams(clubId: string): Promise<ClubTeam[]> {
  const { data, error } = await supabase
    .from('teams')
    .select('*, coaches:team_members(id, display_name)')
    .eq('club_id', clubId)
    .eq('coaches.role', 'coach')
    .order('name')
  if (error) throw error
  return data
}

export async function createTeam(input: {
  clubId: string
  name: string
  season: string | null
}): Promise<Team> {
  const { data, error } = await supabase
    .from('teams')
    .insert({ club_id: input.clubId, name: input.name, season: input.season })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function fetchClubMembers(clubId: string): Promise<ClubMember[]> {
  const { data, error } = await supabase
    .from('club_members')
    .select('user_id, role, profile:profiles(display_name)')
    .eq('club_id', clubId)
  if (error) throw error
  return data
    .map((m) => ({ user_id: m.user_id, role: m.role, display_name: m.profile.display_name }))
    .sort((a, b) => a.display_name.localeCompare(b.display_name))
}

export async function setClubMemberRole(input: {
  clubId: string
  userId: string
  role: ClubRole
}): Promise<void> {
  const { error } = await supabase.rpc('set_club_member_role', {
    p_club_id: input.clubId,
    p_user_id: input.userId,
    p_role: input.role,
  })
  if (error) throw error
}

export async function fetchTeamMembers(teamId: string): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from('team_members')
    .select('*')
    .eq('team_id', teamId)
    .order('role')
    .order('display_name')
  if (error) throw error
  return data
}

/** Active (not revoked, not expired) invites of a team, newest first. */
export async function fetchTeamInvites(teamId: string): Promise<TeamInvite[]> {
  const { data, error } = await supabase
    .from('team_invites')
    .select('*')
    .eq('team_id', teamId)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createInvite(input: { teamId: string; role: TeamRole }): Promise<TeamInvite> {
  const { data, error } = await supabase
    .from('team_invites')
    .insert({ team_id: input.teamId, role: input.role })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function revokeInvite(inviteId: string): Promise<void> {
  const { error } = await supabase
    .from('team_invites')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', inviteId)
  if (error) throw error
}

export async function fetchInviteInfo(token: string): Promise<InviteInfo | null> {
  const { data, error } = await supabase.rpc('get_team_invite', { p_token: token })
  if (error) throw error
  return data[0] ?? null
}

export async function acceptInvite(token: string): Promise<string> {
  const { data, error } = await supabase.rpc('accept_team_invite', { p_token: token })
  if (error) throw error
  return data
}

// ---------------------------------------------------------------------------
// Branding (logo in the public bucket "club-logos", path <club>/<file>)
// ---------------------------------------------------------------------------

export async function uploadClubLogo(clubId: string, file: Blob): Promise<string> {
  const extension = file.type === 'image/webp' ? 'webp' : file.type === 'image/jpeg' ? 'jpg' : 'png'
  const path = `${clubId}/${crypto.randomUUID()}.${extension}`
  const { error } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(path, file, { contentType: file.type, cacheControl: '31536000' })
  if (error) throw error
  return path
}

export async function removeClubLogoFile(path: string): Promise<void> {
  const { error } = await supabase.storage.from(LOGO_BUCKET).remove([path])
  if (error) throw error
}

export async function setClubBranding(input: {
  clubId: string
  logoPath: string | null
  accentColor: string | null
}): Promise<Club> {
  const { data, error } = await supabase.rpc('set_club_branding', {
    p_club_id: input.clubId,
    // The generated types mark the arguments as non-null; the function accepts null.
    p_logo_path: input.logoPath as string,
    p_accent_color: input.accentColor as string,
  })
  if (error) throw error
  return data
}
