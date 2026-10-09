import { subDays } from 'date-fns'
import type { Database } from '@/types/database'

type Functions = Database['public']['Functions']
export type MemberStats = Functions['team_member_stats']['Returns'][number]
export type TrainingPoint = Functions['team_training_attendance']['Returns'][number]

export const RANGES = ['last30', 'season', 'all'] as const
export type RangeKey = (typeof RANGES)[number]

/** Football seasons start on July 1. */
export function seasonStart(now: Date = new Date()): Date {
  const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1
  return new Date(year, 6, 1)
}

export function rangeFor(key: RangeKey, now: Date = new Date()): { from: Date; to: Date } {
  if (key === 'last30') return { from: subDays(now, 30), to: now }
  if (key === 'season') return { from: seasonStart(now), to: now }
  return { from: new Date(2000, 0, 1), to: now }
}

/** Share in percent (0–100), or null when there is nothing to compare against. */
export function percent(part: number, total: number): number | null {
  return total > 0 ? Math.round((part / total) * 100) : null
}

export function formatPercent(value: number | null): string {
  return value === null ? '–' : `${value} %`
}

/** Minutes as hours with one decimal in the user's locale ("12,5"). */
export function formatHours(minutes: number, locale: string): string {
  return (minutes / 60).toLocaleString(locale, { maximumFractionDigits: 1 })
}

export type TeamSummary = {
  trainings: number
  /** Average share of players who said yes per training. */
  attendanceRate: number | null
  /** Average number of players per training. */
  averagePlayers: number | null
  matches: number
}

export function teamSummary(points: TrainingPoint[], members: MemberStats[]): TeamSummary {
  const yes = points.reduce((n, p) => n + p.yes_count, 0)
  const possible = points.reduce((n, p) => n + p.players, 0)
  const matches = Math.max(0, ...members.map((m) => m.matches_total))
  return {
    trainings: points.length,
    attendanceRate: percent(yes, possible),
    averagePlayers: points.length ? Math.round((yes / points.length) * 10) / 10 : null,
    matches,
  }
}

export function trainingRate(m: Pick<MemberStats, 'trainings_yes' | 'trainings_total'>) {
  return percent(m.trainings_yes, m.trainings_total)
}

export function answerRate(m: Pick<MemberStats, 'answered' | 'events_total'>) {
  return percent(m.answered, m.events_total)
}

export type PlayerSort = 'rate' | 'name'

/** Players only, best participation first (no data last), or by name. */
export function sortPlayers(members: MemberStats[], sort: PlayerSort): MemberStats[] {
  const players = members.filter((m) => m.role === 'player')
  return [...players].sort((a, b) => {
    if (sort === 'name') return a.display_name.localeCompare(b.display_name, 'de')
    const ra = trainingRate(a) ?? -1
    const rb = trainingRate(b) ?? -1
    return rb - ra || a.display_name.localeCompare(b.display_name, 'de')
  })
}

/** Decline reasons, most frequent first. */
export function reasonList(reasons: unknown): { reason: string; count: number }[] {
  if (!reasons || typeof reasons !== 'object') return []
  return Object.entries(reasons as Record<string, number>)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
}
