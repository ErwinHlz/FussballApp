import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'
import type { DeclineReason } from '@/features/events/logic'

export type Absence = Tables<'absences'> & {
  member: { id: string; display_name: string; team_id: string; user_id: string | null }
}

const SELECT = '*, member:team_members!inner(id, display_name, team_id, user_id)'

/** Current and upcoming absences of a team (visible to all members). */
export async function fetchTeamAbsences(teamId: string): Promise<Absence[]> {
  const { data, error } = await supabase
    .from('absences')
    .select(SELECT)
    .eq('member.team_id', teamId)
    .gt('ends_at', new Date().toISOString())
    .order('starts_at')
  if (error) throw error
  return data
}

/** Current and upcoming absences of the signed-in user across all teams. */
export async function fetchMyAbsences(userId: string): Promise<Absence[]> {
  const { data, error } = await supabase
    .from('absences')
    .select(SELECT)
    .eq('member.user_id', userId)
    .gt('ends_at', new Date().toISOString())
    .order('starts_at')
  if (error) throw error
  return data
}

export async function fetchMyMemberIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from('team_members').select('id').eq('user_id', userId)
  if (error) throw error
  return data.map((m) => m.id)
}

export type AbsenceInput = {
  memberIds: string[]
  startsAt: Date
  endsAt: Date
  reason: DeclineReason
  note: string | null
}

/** Returns how many events were declined automatically. */
export async function createAbsences(input: AbsenceInput): Promise<number> {
  const { data, error } = await supabase.rpc('create_absences', {
    p_member_ids: input.memberIds,
    p_starts_at: input.startsAt.toISOString(),
    p_ends_at: input.endsAt.toISOString(),
    p_reason: input.reason,
    p_note: input.note ?? undefined,
  })
  if (error) throw error
  return data
}

export async function deleteAbsence(absenceId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_absence', { p_absence_id: absenceId })
  if (error) throw error
}
