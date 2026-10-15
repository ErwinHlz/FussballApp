import type { Tables } from '@/types/database'
import type { TeamMember } from '@/features/teams/api'
import type { Drill } from '@/features/drills/logic'
import type { Attendance, EventRow } from '@/features/events/logic'

export type EventDrill = Tables<'event_drills'>
export type PlanDrill = Pick<Drill, 'id' | 'title' | 'category' | 'duration_min' | 'team_id'> &
  Partial<Pick<Drill, 'animation' | 'video_url' | 'video_path'>>
export type PlanItem = EventDrill & { drill: PlanDrill }

/** Duration of a plan item: own override, else the drill's default. */
export function itemMinutes(item: Pick<PlanItem, 'duration_min' | 'drill'>): number {
  return item.duration_min ?? item.drill.duration_min ?? 0
}

export function planTotalMinutes(items: Pick<PlanItem, 'duration_min' | 'drill'>[]): number {
  return items.reduce((sum, item) => sum + itemMinutes(item), 0)
}

export function eventMinutes(event: Pick<EventRow, 'starts_at' | 'ends_at'>): number | null {
  if (!event.ends_at) return null
  return Math.round(
    (new Date(event.ends_at).getTime() - new Date(event.starts_at).getTime()) / 60000,
  )
}

export type DurationFit = 'none' | 'under' | 'fits' | 'over'

/** Compares plan length with the event length (5 minutes tolerance counts as fitting). */
export function durationFit(planMinutes: number, available: number | null): DurationFit {
  if (available === null) return 'none'
  if (planMinutes > available) return 'over'
  if (planMinutes < available - 5) return 'under'
  return 'fits'
}

/** Moves an element in a list (used for keyboard reordering). */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list
  const copy = [...list]
  const [item] = copy.splice(from, 1)
  copy.splice(to, 0, item as T)
  return copy
}

/** Members who declined after the plan was published (coach hint). */
export function lateDeclines(
  event: Pick<EventRow, 'plan_status' | 'plan_published_at'>,
  attendances: Attendance[],
  members: TeamMember[],
): { member: TeamMember; attendance: Attendance }[] {
  if (event.plan_status !== 'published' || !event.plan_published_at) return []
  const publishedAt = new Date(event.plan_published_at)
  const byId = new Map(members.map((m) => [m.id, m]))
  return attendances
    .filter((a) => a.status === 'no' && new Date(a.updated_at) > publishedAt)
    .flatMap((a) => {
      const member = byId.get(a.member_id)
      return member ? [{ member, attendance: a }] : []
    })
}
