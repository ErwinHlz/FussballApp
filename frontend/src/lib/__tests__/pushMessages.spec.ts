import { describe, expect, it } from 'vitest'
// The Edge Function's pure message module (no Deno APIs), tested here with Vitest.
import {
  buildMessage,
  type PushRow,
} from '../../../../backend/supabase/functions/push-dispatch/messages'

function row(overrides: Partial<PushRow>): PushRow {
  return {
    outbox_id: 1,
    kind: 'event_created',
    payload: {},
    event_id: 'e1',
    event_type: 'training',
    // Tuesday 13 Oct 2026, 18:30 in Berlin (UTC+2).
    starts_at: '2026-10-13T16:30:00Z',
    opponent: null,
    is_home: null,
    location: 'Sportpark',
    team_name: 'U17',
    locale: 'de',
    ...overrides,
  }
}

describe('push messages', () => {
  it('announces a new training with date, time and place in German time', () => {
    expect(buildMessage(row({}))).toEqual({
      title: 'Neues Training · U17',
      body: 'Di., 13.10., 18:30 · Sportpark',
      url: '/events/e1',
      tag: 'event_created:e1',
    })
  })

  it('names team events by their title', () => {
    const m = buildMessage(row({ event_type: 'event', event_title: 'Teamabend' }))
    expect(m.title).toBe('Neues Event · U17')
    expect(m.body).toBe('Teamabend · Di., 13.10., 18:30 · Sportpark')
    const cancelled = buildMessage(
      row({ kind: 'event_cancelled', event_type: 'event', event_title: 'Teamabend' }),
    )
    expect(cancelled.title).toBe('Abgesagt: Teamabend am Di., 13.10., 18:30')
  })

  it('names the opponent for matches', () => {
    const m = buildMessage(row({ event_type: 'match', opponent: 'FC Nachbarort', location: null }))
    expect(m.title).toBe('Neues Spiel · U17')
    expect(m.body).toBe('vs. FC Nachbarort · Di., 13.10., 18:30')
  })

  it('summarises a series in one message', () => {
    const m = buildMessage(row({ kind: 'series_created', payload: { count: 26 } }))
    expect(m.title).toBe('Neue Trainings · U17')
    expect(m.body).toBe('26 Trainings angelegt, ab Di., 13.10., 18:30')
    expect(m.url).toBe('/training')
  })

  it('covers cancellations, plans, nominations and reminders', () => {
    expect(buildMessage(row({ kind: 'event_cancelled' })).title).toBe(
      'Abgesagt: Training am Di., 13.10., 18:30',
    )
    expect(buildMessage(row({ kind: 'plan_published' })).body).toContain(
      'schau dir deine Gruppe an',
    )
    expect(
      buildMessage(row({ kind: 'nomination', event_type: 'match', opponent: 'SV Gegner' })).body,
    ).toBe('U17 vs. SV Gegner · Di., 13.10., 18:30')
    expect(buildMessage(row({ kind: 'reminder' })).title).toBe('Bist du dabei?')
  })

  it('speaks English to English devices', () => {
    const m = buildMessage(row({ locale: 'en', kind: 'reminder' }))
    expect(m.title).toBe('Are you in?')
    expect(m.body).toBe('Training Tue 13/10, 18:30 – please answer before the deadline')
  })

  it('opens the profile for test notifications', () => {
    expect(buildMessage(row({ kind: 'test', event_id: null })).url).toBe('/profile')
  })
})
