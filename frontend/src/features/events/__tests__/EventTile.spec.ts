import { describe, expect, it } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import { i18n } from '@/lib/i18n'
import { member } from '@/features/squad/__tests__/squad.spec'
import type { TeamEvent } from '@/features/events/logic'
import EventTile from '../components/EventTile.vue'

const inThreeDays = () => {
  const d = new Date()
  d.setDate(d.getDate() + 3)
  d.setHours(18, 30, 0, 0)
  return d.toISOString()
}

function training(overrides: Partial<TeamEvent> = {}): TeamEvent {
  return {
    id: 't1',
    type: 'training',
    starts_at: inThreeDays(),
    ends_at: null,
    location: 'Sportpark',
    is_cancelled: false,
    response_deadline: null,
    attendances: [],
    ...overrides,
  } as TeamEvent
}

function mountTile(event: TeamEvent, isCoach = false) {
  return mount(EventTile, {
    props: { event, myMember: member({ id: 'me' }), isCoach, playerIds: ['me', 'p2'] },
    global: { plugins: [i18n], stubs: { RouterLink: RouterLinkStub } },
  })
}

describe('EventTile', () => {
  it('shows date, title and time in one slim row in the event color', () => {
    i18n.global.locale.value = 'de'
    const wrapper = mountTile(
      training({ type: 'match', opponent: 'FC Gegner', is_home: false } as never),
    )
    expect(wrapper.classes()).toContain('tile--match')
    expect(wrapper.get('.tile__title').text()).toBe('vs. FC Gegner')
    expect(wrapper.get('.tile__meta').text()).toBe('18:30 · Sportpark · Auswärts')
  })

  it('lets players answer right there', async () => {
    const wrapper = mountTile(training())
    await wrapper.findAll('.tile__answer button')[0]!.trigger('click')
    expect(wrapper.emitted('answer')).toEqual([['yes']])
  })

  it('notes what the buttons cannot say: absence, closed answers', () => {
    const absent = mountTile(
      training({
        attendances: [
          { member_id: 'me', status: 'no', reason: 'vacation', source_absence_id: 'a1' },
        ],
      } as never),
    )
    expect(absent.get('.tile__note').text()).toBe('Abgesagt (Abwesenheit)')

    const closed = mountTile(
      training({ response_deadline: new Date(Date.now() - 3600_000).toISOString() }),
    )
    expect(closed.get('.tile__note').text()).toBe('Anmeldeschluss vorbei')
    expect(closed.get('.tile__answer button').attributes('disabled')).toBeDefined()

    expect(mountTile(training()).find('.tile__note').exists()).toBe(false)
  })

  it('shows no answer without an own squad entry (past dates)', () => {
    const wrapper = mount(EventTile, {
      props: { event: training(), myMember: null, isCoach: false, playerIds: [] },
      global: { plugins: [i18n], stubs: { RouterLink: RouterLinkStub } },
    })
    expect(wrapper.find('.tile__answer').exists()).toBe(false)
  })

  it('gives coaches the counts instead', () => {
    const wrapper = mountTile(
      training({ attendances: [{ member_id: 'me', status: 'yes' }] as never }),
      true,
    )
    expect(wrapper.find('.tile__answer').exists()).toBe(false)
    expect(wrapper.findAll('.tile__count').map((c) => c.text())).toEqual(['✓ 1', '✗ 0', '– 1'])
  })
})
