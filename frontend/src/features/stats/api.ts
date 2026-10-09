import { supabase } from '@/lib/supabase'
import type { MemberStats, TrainingPoint } from './logic'

export async function fetchMemberStats(
  teamId: string,
  from: Date,
  to: Date,
): Promise<MemberStats[]> {
  const { data, error } = await supabase.rpc('team_member_stats', {
    p_team_id: teamId,
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  })
  if (error) throw error
  return data
}

export async function fetchTrainingAttendance(
  teamId: string,
  from: Date,
  to: Date,
): Promise<TrainingPoint[]> {
  const { data, error } = await supabase.rpc('team_training_attendance', {
    p_team_id: teamId,
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  })
  if (error) throw error
  return data
}
