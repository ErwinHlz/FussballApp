import { supabase } from '@/lib/supabase'
import type { Json, TablesInsert } from '@/types/database'
import type { Drill } from './logic'

export type DrillInput = Pick<
  TablesInsert<'drills'>,
  | 'title'
  | 'description'
  | 'category'
  | 'duration_min'
  | 'min_players'
  | 'max_players'
  | 'equipment'
  | 'video_url'
>

/** Public library plus the drills of the given team (RLS hides everything else). */
export async function fetchDrills(teamId: string): Promise<Drill[]> {
  const { data, error } = await supabase
    .from('drills')
    .select('*')
    .or(`team_id.is.null,team_id.eq.${teamId}`)
  if (error) throw error
  return data
}

export async function fetchDrill(drillId: string): Promise<Drill> {
  const { data, error } = await supabase.from('drills').select('*').eq('id', drillId).single()
  if (error) throw error
  return data
}

export async function createDrill(teamId: string, input: DrillInput): Promise<Drill> {
  const { data, error } = await supabase
    .from('drills')
    .insert({ ...input, team_id: teamId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateDrill(drillId: string, input: DrillInput): Promise<Drill> {
  const { data, error } = await supabase
    .from('drills')
    .update(input)
    .eq('id', drillId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteDrill(drillId: string): Promise<void> {
  const { error } = await supabase.from('drills').delete().eq('id', drillId)
  if (error) throw error
}

export async function copyDrill(drillId: string, teamId: string): Promise<Drill> {
  const { data, error } = await supabase.rpc('copy_drill', {
    p_drill_id: drillId,
    p_team_id: teamId,
  })
  if (error) throw error
  return data
}

/** Saves (or removes, with null) the tactics board animation of a team drill. */
export async function updateDrillAnimation(
  drillId: string,
  animation: Json | null,
): Promise<Drill> {
  const { data, error } = await supabase
    .from('drills')
    .update({ animation })
    .eq('id', drillId)
    .select()
    .single()
  if (error) throw error
  return data
}
