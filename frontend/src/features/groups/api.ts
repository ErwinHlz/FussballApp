import { supabase } from '@/lib/supabase'
import type { BibColor, DraftGroup } from './logic'

export type SavedGroup = {
  id: string
  name: string
  color: BibColor
  created_at: string
  member_ids: string[]
}
export type DrillGroups = {
  id: string
  position: number
  drill: { id: string; title: string }
  groups: SavedGroup[]
}

/** All drills of a training with their groups and assignments. */
export async function fetchEventGroups(eventId: string): Promise<DrillGroups[]> {
  const { data, error } = await supabase
    .from('event_drills')
    .select(
      'id, position, created_at, drill:drills(id, title), drill_groups(id, name, color, created_at, group_assignments(member_id))',
    )
    .eq('event_id', eventId)
    .order('position')
    .order('created_at')
  if (error) throw error
  return data.map((ed) => ({
    id: ed.id,
    position: ed.position,
    drill: ed.drill,
    groups: [...ed.drill_groups]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((g) => ({
        id: g.id,
        name: g.name,
        color: g.color as BibColor,
        created_at: g.created_at,
        member_ids: g.group_assignments.map((a) => a.member_id),
      })),
  }))
}

export async function saveDrillGroups(eventDrillId: string, groups: DraftGroup[]): Promise<void> {
  const { error } = await supabase.rpc('set_drill_groups', {
    p_event_drill_id: eventDrillId,
    p_groups: groups.map((g) => ({ name: g.name.trim(), color: g.color, member_ids: g.memberIds })),
  })
  if (error) throw error
}
