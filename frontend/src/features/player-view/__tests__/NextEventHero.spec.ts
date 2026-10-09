import { describe, expect, it, vi } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import { ref } from 'vue'
import { i18n } from '@/lib/i18n'
import { member } from '@/features/squad/__tests__/squad.spec'
import type { TeamEvent } from '@/features/events/logic'
import NextEventHero from '../components/NextEventHero.vue'

vi.mock('@/features/events/composables/useEvents', () => ({
  useSetAttendance: () => ({ mutate: vi.fn(), isPending: ref(false), isError: ref(false) }),
}))

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

function mountHero(event: TeamEvent) {
  return mount(NextEventHero, {
    props: { event, myMember: member({ id: 'me' }), isCoach: false },
    global: {
      plugins: [i18n],
      stubs: { RouterLink: RouterLinkStub, MyTrainingFlow: true, teleport: true },
    },
  })
}

describe('NextEventHero (match)', () => {
  it('shows opponent, meeting point and time and kick-off at a glance', () => {
    i18n.global.locale.value = 'de'
    const wrapper = mountHero(match())
    const text = wrapper.text()

    expect(wrapper.get('#hero-title').text()).toBe('@ FC Gegner')
    expect(text).toContain('Treffpunkt')
    expect(text).toContain('13:45')
    expect(text).toContain('Vereinsheim')
    expect(text).toContain('15:00')
    expect(wrapper.find('.hero__nomination').exists()).toBe(false)
    expect(wrapper.findAll('.attendance__button')).toHaveLength(3)
  })
})

describe('NextEventHero (training)', () => {
  it('shows the training flow only when the plan is published', () => {
    const training = match({ type: 'training', opponent: null, is_home: null, match_squad: [] })
    expect(mountHero(training).findComponent({ name: 'MyTrainingFlow' }).exists()).toBe(false)
    expect(mountHero(training).text()).toContain('noch nicht veröffentlicht')

    const published = mountHero({ ...training, plan_status: 'published' })
    expect(published.findComponent({ name: 'MyTrainingFlow' }).exists()).toBe(true)
  })
})
