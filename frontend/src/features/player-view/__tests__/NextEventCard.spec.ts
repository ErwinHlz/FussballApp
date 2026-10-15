import { describe, expect, it } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import { i18n } from '@/lib/i18n'
import { member } from '@/features/squad/__tests__/squad.spec'
import type { TeamEvent } from '@/features/events/logic'
import NextEventCard from '../components/NextEventCard.vue'

const inTwoDays = (h: number, m = 0) => {
  const d = new Date()
  d.setDate(d.getDate() + 2)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

function match(overrides: Partial<TeamEvent> = {}): TeamEvent {
  return {
    id: 'm1',
    type: 'match',
    starts_at: inTwoDays(15),
    ends_at: null,
    meet_at: inTwoDays(13, 45),
    meet_location: 'Vereinsheim',
    location: 'Sportpark Nord',
    opponent: 'FC Gegner',
    is_home: false,
    competition: 'league',
    is_cancelled: false,
    response_deadline: null,
    plan_status: 'draft',
    attendances: [],
    match_squad: [{ member_id: 'me', role: 'starter' }],
    ...overrides,
  } as TeamEvent
}

function mountCard(event: TeamEvent, isCoach = false) {
  return mount(NextEventCard, {
    props: { event, myMember: member({ id: 'me' }), isCoach, playerIds: ['me', 'p2', 'p3'] },
    global: { plugins: [i18n], stubs: { RouterLink: RouterLinkStub, MyBibs: true } },
  })
}

describe('NextEventCard', () => {
  it('shows opponent, kick-off, venue and meeting point at a glance', () => {
    i18n.global.locale.value = 'de'
    const text = mountCard(match()).text()
    expect(text).toContain('vs. FC Gegner')
    expect(text).toContain('15:00')
    expect(text).toContain('Sportpark Nord')
    expect(text).toContain('Treffpunkt 13:45 · Vereinsheim')
  })

  it('does not show the nomination on the start card', () => {
    expect(mountCard(match()).text()).not.toContain('Startelf')
  })

  it('reports the answer and marks the current one', async () => {
    const wrapper = mountCard(match({ attendances: [{ member_id: 'me', status: 'yes' } as never] }))
    const main = wrapper.get('.answer__main')
    expect(main.text()).toBe('Du bist dabei')
    expect(main.attributes('aria-pressed')).toBe('true')
    await wrapper.findAll('.answer__side')[1]!.trigger('click')
    expect(wrapper.emitted('answer')).toEqual([['no']])
  })

  it('shows the bibs only for a published training plan', () => {
    const draft = mountCard(match({ type: 'training', plan_status: 'draft' }))
    expect(draft.findComponent({ name: 'MyBibs' }).exists()).toBe(false)
    const published = mountCard(match({ type: 'training', plan_status: 'published' }))
    expect(published.findComponent({ name: 'MyBibs' }).exists()).toBe(true)
  })

  it('gives coaches the answer counts', () => {
    const wrapper = mountCard(
      match({
        attendances: [
          { member_id: 'me', status: 'yes' },
          { member_id: 'p2', status: 'maybe' },
        ] as never,
      }),
      true,
    )
    expect(wrapper.get('.next__counts').text()).toBe('1 dabei · 1 vielleicht · 1 offen')
  })
})
