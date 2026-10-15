import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import type { EventRow } from '@/features/events/logic'
import type { PlanItem } from './logic'

type PlanStatus = Database['public']['Enums']['plan_status']

// Animation and video come along for the drill previews in the training flow.
const PLAN_SELECT =
  '*, drill:drills(id, title, category, duration_min, team_id, animation, video_url, video_path)'

export type TrainingSummary = EventRow & { event_drills: { count: number }[] }

export async function fetchPlan(eventId: string): Promise<PlanItem[]> {
  const { data, error } = await supabase
    .from('event_drills')
    .select(PLAN_SELECT)
    .eq('event_id', eventId)
    .order('position')
    .order('created_at')
  if (error) throw error
  return data
}

/** Upcoming trainings of a team with the number of planned drills (visible to the caller). */
export async function fetchUpcomingTrainings(teamId: string): Promise<TrainingSummary[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*, event_drills(count)')
    .eq('team_id', teamId)
    .eq('type', 'training')
    .gte('starts_at', new Date(Date.now() - 3 * 3600_000).toISOString())
    .order('starts_at')
    .limit(30)
  if (error) throw error
  return data
}

export async function addPlanDrill(input: {
  eventId: string
  drillId: string
  position: number
  durationMin: number | null
}): Promise<void> {
  const { error } = await supabase.from('event_drills').insert({
    event_id: input.eventId,
    drill_id: input.drillId,
    position: input.position,
    duration_min: input.durationMin,
  })
  if (error) throw error
}

export async function updatePlanItem(
  itemId: string,
  patch: { duration_min?: number | null; coach_notes?: string | null },
): Promise<void> {
  const { error } = await supabase.from('event_drills').update(patch).eq('id', itemId)
  if (error) throw error
}

export async function removePlanItem(itemId: string): Promise<void> {
  const { error } = await supabase.from('event_drills').delete().eq('id', itemId)
  if (error) throw error
}

export async function reorderPlan(eventId: string, ids: string[]): Promise<void> {
  const { error } = await supabase.rpc('reorder_event_drills', { p_event_id: eventId, p_ids: ids })
  if (error) throw error
}

export async function copyPlan(sourceEventId: string, targetEventId: string): Promise<number> {
  const { data, error } = await supabase.rpc('copy_event_plan', {
    p_source_event_id: sourceEventId,
    p_target_event_id: targetEventId,
  })
  if (error) throw error
  return data
}

export async function setPlanStatus(eventId: string, status: PlanStatus): Promise<void> {
  const { error } = await supabase.from('events').update({ plan_status: status }).eq('id', eventId)
  if (error) throw error
}

/** Trainings of a team that already have a plan (to copy from), most recent first. */
export async function fetchPlannedTrainings(teamId: string): Promise<TrainingSummary[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*, event_drills(count)')
    .eq('team_id', teamId)
    .eq('type', 'training')
    .gte('starts_at', new Date(Date.now() - 180 * 86400_000).toISOString())
    .order('starts_at', { ascending: false })
    .limit(60)
  if (error) throw error
  return data.filter((e) => (e.event_drills[0]?.count ?? 0) > 0)
}
