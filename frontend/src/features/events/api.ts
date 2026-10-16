import { subDays } from 'date-fns'
import { supabase } from '@/lib/supabase'
import type { TablesInsert } from '@/types/database'
import type {
  Attendance,
  AttendanceStatus,
  DeclineReason,
  EventRow,
  SquadRole,
  TeamEvent,
} from './logic'

/** How far back the event list goes (older events are not shown in the MVP). */
const PAST_DAYS = 60

const EVENT_SELECT = '*, attendances(*), match_squad(*)'

export type EventInput = Omit<
  TablesInsert<'events'>,
  'id' | 'team_id' | 'created_at' | 'series_id' | 'is_cancelled' | 'cancel_reason' | 'plan_status'
>

export async function fetchTeamEvents(teamId: string): Promise<TeamEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select(EVENT_SELECT)
    .eq('team_id', teamId)
    .gte('starts_at', subDays(new Date(), PAST_DAYS).toISOString())
    .order('starts_at')
  if (error) throw error
  return data
}

export async function fetchEvent(eventId: string): Promise<TeamEvent> {
  const { data, error } = await supabase
    .from('events')
    .select(EVENT_SELECT)
    .eq('id', eventId)
    .single()
  if (error) throw error
  return data
}

export async function createEvent(teamId: string, input: EventInput): Promise<EventRow> {
  const { data, error } = await supabase
    .from('events')
    .insert({ ...input, team_id: teamId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateEvent(
  eventId: string,
  patch: Partial<EventInput> & Pick<Partial<EventRow>, 'is_cancelled' | 'cancel_reason'>,
): Promise<EventRow> {
  const { data, error } = await supabase
    .from('events')
    .update(patch)
    .eq('id', eventId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteEvent(eventId: string): Promise<void> {
  const { error } = await supabase.from('events').delete().eq('id', eventId)
  if (error) throw error
}

export type SeriesRequest = {
  teamId: string
  weekday: number
  startTime: string
  durationMin: number
  location: string | null
  validFrom: string
  validUntil: string
  startsAt: Date[]
  deadlineHours: number | null
}

export async function createTrainingSeries(input: SeriesRequest): Promise<void> {
  const { error } = await supabase.rpc('create_training_series', {
    p_team_id: input.teamId,
    p_weekday: input.weekday,
    p_start_time: input.startTime,
    p_duration_min: input.durationMin,
    p_location: input.location ?? '',
    p_valid_from: input.validFrom,
    p_valid_until: input.validUntil,
    p_starts_at: input.startsAt.map((d) => d.toISOString()),
    p_deadline_hours: input.deadlineHours ?? undefined,
  })
  if (error) throw error
}

export type AttendanceRequest = {
  eventId: string
  memberId: string
  status: AttendanceStatus
  reason?: DeclineReason | null
  reasonNote?: string | null
}

export async function setAttendance(input: AttendanceRequest): Promise<Attendance> {
  const { data, error } = await supabase.rpc('set_attendance', {
    p_event_id: input.eventId,
    p_member_id: input.memberId,
    p_status: input.status,
    p_reason: input.reason ?? undefined,
    p_reason_note: input.reasonNote ?? undefined,
  })
  if (error) throw error
  return data
}

/** Back to "no answer yet" (undo of a first answer). RLS allows it only while the event is open. */
export async function withdrawAttendance(input: {
  eventId: string
  memberId: string
}): Promise<void> {
  const { data, error } = await supabase
    .from('attendances')
    .delete()
    .eq('event_id', input.eventId)
    .eq('member_id', input.memberId)
    .select('id')
  if (error) throw error
  // A delete blocked by RLS removes nothing and raises no error: report it.
  if (!data.length) throw new Error('not allowed')
}

export async function setMatchSquad(
  eventId: string,
  entries: { member_id: string; role: SquadRole }[],
): Promise<void> {
  const { error } = await supabase.rpc('set_match_squad', {
    p_event_id: eventId,
    p_entries: entries,
  })
  if (error) throw error
}
