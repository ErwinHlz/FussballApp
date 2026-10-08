import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { TeamMember, TeamRole } from '@/features/teams/api'
import type { MemberStatus, Position } from './squad'

export type MemberInput = {
  display_name: string
  shirt_number: number | null
  positions: Position[]
  status: MemberStatus
  role: TeamRole
}

export type SquadErrorKind = 'shirtNumberTaken' | 'unknown'

export function squadErrorKind(error: unknown): SquadErrorKind {
  const code = (error as Partial<PostgrestError> | null)?.code
  return code === '23505' ? 'shirtNumberTaken' : 'unknown'
}

/** Adds a player without an account (maintained by the coach). */
export async function createMember(teamId: string, input: MemberInput): Promise<TeamMember> {
  const { data, error } = await supabase
    .from('team_members')
    .insert({ team_id: teamId, ...input })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateMember(memberId: string, input: MemberInput): Promise<TeamMember> {
  const { data, error } = await supabase
    .from('team_members')
    .update(input)
    .eq('id', memberId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteMember(memberId: string): Promise<void> {
  const { error } = await supabase.from('team_members').delete().eq('id', memberId)
  if (error) throw error
}

export async function linkMember(
  manualMemberId: string,
  accountMemberId: string,
): Promise<TeamMember> {
  const { data, error } = await supabase.rpc('link_team_member', {
    p_manual_member_id: manualMemberId,
    p_account_member_id: accountMemberId,
  })
  if (error) throw error
  return data
}
