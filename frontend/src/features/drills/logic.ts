import type { Tables } from '@/types/database'

export type Drill = Tables<'drills'>

export const DRILL_CATEGORIES = [
  'warmup',
  'passing',
  'possession',
  'technique',
  'finishing',
  'defending',
  'tactics',
  'game',
  'fitness',
  'goalkeeping',
] as const
export type DrillCategory = (typeof DRILL_CATEGORIES)[number]

export type DrillScope = 'all' | 'team' | 'library'
export type DrillFilter = {
  query: string
  category: DrillCategory | 'all'
  scope: DrillScope
  /** Only drills with an animation or a video. */
  media?: boolean
}

export const DEFAULT_DRILL_FILTER: Omit<DrillFilter, 'query'> = {
  category: 'all',
  scope: 'all',
  media: false,
}

/** Filters set in the filter sheet (origin, media); category and search are always visible. */
export function activeDrillFilters(filter: Pick<DrillFilter, 'scope' | 'media'>): number {
  return (filter.scope !== 'all' ? 1 : 0) + (filter.media ? 1 : 0)
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/

/** Extracts the video id from common YouTube URL forms, or null. */
export function parseYouTubeId(url: string | null | undefined): string | null {
  if (!url) return null
  let parsed: URL
  try {
    parsed = new URL(url.trim())
  } catch {
    return null
  }
  if (parsed.protocol !== 'https:') return null
  const host = parsed.hostname.replace(/^(www\.|m\.)/, '')
  let id: string | null = null
  if (host === 'youtu.be') {
    id = parsed.pathname.slice(1).split('/')[0] ?? null
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (parsed.pathname === '/watch') id = parsed.searchParams.get('v')
    else {
      const match = parsed.pathname.match(/^\/(embed|shorts|live)\/([^/?#]+)/)
      id = match?.[2] ?? null
    }
  }
  return id && YOUTUBE_ID.test(id) ? id : null
}

/** Privacy-friendly embed (no cookies until the video is played). */
export function youTubeEmbedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0`
}

function normalize(text: string) {
  return text
    .toLocaleLowerCase('de')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

export function filterDrills(drills: Drill[], filter: DrillFilter): Drill[] {
  const query = normalize(filter.query.trim())
  return drills
    .filter((d) => filter.category === 'all' || d.category === filter.category)
    .filter((d) => !filter.media || !!(d.animation || d.video_url || d.video_path))
    .filter((d) => {
      if (filter.scope === 'team') return d.team_id !== null
      if (filter.scope === 'library') return d.team_id === null
      return true
    })
    .filter(
      (d) =>
        !query ||
        normalize(d.title).includes(query) ||
        normalize(d.description).includes(query) ||
        d.equipment.some((e) => normalize(e).includes(query)),
    )
    .sort((a, b) => {
      // Own team drills first, then alphabetically.
      if ((a.team_id === null) !== (b.team_id === null)) return a.team_id === null ? 1 : -1
      return a.title.localeCompare(b.title, 'de')
    })
}

/** "Hütchen, Bälle,  Leibchen" -> ["Hütchen", "Bälle", "Leibchen"] (unique, max 20). */
export function parseEquipment(value: string | undefined): string[] {
  const items = (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return [...new Set(items)].slice(0, 20)
}

export function playersLabel(drill: Pick<Drill, 'min_players' | 'max_players'>): string | null {
  const { min_players: min, max_players: max } = drill
  if (min && max) return min === max ? `${min}` : `${min}–${max}`
  if (min) return `${min}+`
  if (max) return `≤ ${max}`
  return null
}
