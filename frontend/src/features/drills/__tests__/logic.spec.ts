import { describe, expect, it } from 'vitest'
import {
  activeDrillFilters,
  filterDrills,
  parseEquipment,
  parseYouTubeId,
  playersLabel,
  youTubeEmbedUrl,
  type Drill,
} from '../logic'

function drill(overrides: Partial<Drill>): Drill {
  return {
    id: overrides.title ?? 'd',
    team_id: null,
    created_by: null,
    title: 'Drill',
    description: '',
    category: 'passing',
    duration_min: null,
    min_players: null,
    max_players: null,
    equipment: [],
    video_url: null,
    video_path: null,
    animation: null,
    copied_from: null,
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

describe('parseYouTubeId', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s', 'dQw4w9WgXcQ'],
    ['https://m.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?si=abc', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
  ])('reads %s', (url, id) => {
    expect(parseYouTubeId(url)).toBe(id)
  })

  it.each([
    'http://youtu.be/dQw4w9WgXcQ',
    'https://evil.example/watch?v=dQw4w9WgXcQ',
    'https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ',
    'https://youtube.com/watch?v=short',
    'not a url',
    '',
  ])('rejects %s', (url) => {
    expect(parseYouTubeId(url)).toBeNull()
  })

  it('embeds via youtube-nocookie', () => {
    expect(youTubeEmbedUrl('dQw4w9WgXcQ')).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0',
    )
  })
})

describe('filterDrills', () => {
  const drills = [
    drill({ title: 'Rondo 4 gegen 2', category: 'possession' }),
    drill({ title: 'Torschuss', category: 'finishing', description: 'Abschluss nach Doppelpass' }),
    drill({ title: 'Unser Aufwärmen', category: 'warmup', team_id: 't', equipment: ['Hütchen'] }),
  ]
  const all = { query: '', category: 'all', scope: 'all' } as const

  it('lists team drills first, then alphabetically', () => {
    expect(filterDrills(drills, all).map((d) => d.title)).toEqual([
      'Unser Aufwärmen',
      'Rondo 4 gegen 2',
      'Torschuss',
    ])
  })

  it('searches title, description and equipment, ignoring case and umlauts', () => {
    expect(filterDrills(drills, { ...all, query: 'doppelpass' }).map((d) => d.title)).toEqual([
      'Torschuss',
    ])
    expect(filterDrills(drills, { ...all, query: 'HUTCHEN' }).map((d) => d.title)).toEqual([
      'Unser Aufwärmen',
    ])
  })

  it('filters by category and scope', () => {
    expect(filterDrills(drills, { ...all, category: 'possession' })).toHaveLength(1)
    expect(filterDrills(drills, { ...all, scope: 'team' }).map((d) => d.title)).toEqual([
      'Unser Aufwärmen',
    ])
    expect(filterDrills(drills, { ...all, scope: 'library' })).toHaveLength(2)
  })
})

describe('helpers', () => {
  it('parses equipment lists', () => {
    expect(parseEquipment(' Hütchen, Bälle,,Hütchen , Leibchen ')).toEqual([
      'Hütchen',
      'Bälle',
      'Leibchen',
    ])
    expect(parseEquipment(undefined)).toEqual([])
  })

  it('formats player counts', () => {
    expect(playersLabel({ min_players: 6, max_players: 6 })).toBe('6')
    expect(playersLabel({ min_players: 6, max_players: 12 })).toBe('6–12')
    expect(playersLabel({ min_players: 4, max_players: null })).toBe('4+')
    expect(playersLabel({ min_players: null, max_players: null })).toBeNull()
  })
})

describe('drill filter extras', () => {
  const all = { query: '', category: 'all', scope: 'all' } as const

  it('keeps only drills with an animation or a video', () => {
    const drills = [
      drill({ title: 'Ohne' }),
      drill({ title: 'Video', video_url: 'https://youtu.be/abcdefghijk' }),
      drill({ title: 'Animiert', animation: { keyframes: [] } }),
    ]
    expect(filterDrills(drills, { ...all, media: true }).map((d) => d.title)).toEqual([
      'Animiert',
      'Video',
    ])
  })

  it('counts the filters of the sheet', () => {
    expect(activeDrillFilters({ scope: 'all', media: false })).toBe(0)
    expect(activeDrillFilters({ scope: 'team', media: true })).toBe(2)
  })
})
