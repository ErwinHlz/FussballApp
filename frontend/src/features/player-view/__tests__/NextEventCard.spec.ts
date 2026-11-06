import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { mount, RouterLinkStub } from '@vue/test-utils'
import { i18n } from '@/lib/i18n'
import { member } from '@/features/squad/__tests__/squad.spec'
import type { TeamEvent } from '@/features/events/logic'
import NextEventCard from '../components/NextEventCard.vue'

const publish = vi.fn()
vi.mock('@/features/training-plan/composables/usePlan', () => ({
  useSetPlanStatus: () => ({ mutate: publish, isPending: ref(false) }),
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
    ...overrides,
  } as TeamEvent
}

function mountCard(event: TeamEvent, isCoach = false) {
  return mount(NextEventCard, {
    props: {
      event,
      myMember: member({ id: 'me' }),
      isCoach,
      playerIds: ['me', 'p2', 'p3'],
      teamName: 'SV Ottweiler 1',
      names: new Map([['me', 'Ich']]),
    },
    global: { plugins: [i18n], stubs: { RouterLink: RouterLinkStub, PlanGlance: true } },
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
    expect(mountCard(match()).get('.next__team').text()).toBe('SV Ottweiler 1')
  })

  it('keeps the answer bottom left and the details bottom right, for everyone', async () => {
    const wrapper = mountCard(match({ attendances: [{ member_id: 'me', status: 'yes' }] as never }))
    const foot = wrapper.get('.next__foot')
    const buttons = foot.findAll('.answer__icon')
    expect(buttons).toHaveLength(3)
    expect(buttons[0]!.attributes('aria-pressed')).toBe('true')
    expect(foot.element.lastElementChild?.classList.contains('next__more')).toBe(true)
    await buttons[2]!.trigger('click')
    expect(wrapper.emitted('answer')).toEqual([['no']])

    const coach = mountCard(match({ type: 'training', plan_status: 'draft' }), true)
    expect(coach.get('.next__foot').findAll('.answer__icon')).toHaveLength(3)
    expect(
      coach.get('.next__foot').element.lastElementChild?.classList.contains('next__more'),
    ).toBe(true)
  })

  it('shows plan and groups of a training: published for players, drafts for coaches', () => {
    const glance = (event: TeamEvent, isCoach = false) =>
      mountCard(event, isCoach).findComponent({ name: 'PlanGlance' })
    expect(glance(match({ type: 'training', plan_status: 'draft' })).exists()).toBe(false)
    expect(glance(match({ type: 'training', plan_status: 'published' })).exists()).toBe(true)
    const coachDraft = glance(match({ type: 'training', plan_status: 'draft' }), true)
    expect(coachDraft.exists()).toBe(true)
    expect(coachDraft.props('draft')).toBe(true)
    expect(glance(match({ plan_status: 'published' })).exists()).toBe(false)
  })

  it('links the place to the maps app', () => {
    const link = mountCard(match()).get('.next__place')
    expect(link.attributes('href')).toBe(
      'https://www.google.com/maps/search/?api=1&query=Sportpark%20Nord',
    )
    expect(link.text()).toContain('Sportpark Nord')
  })

  it('gives coaches plan, groups and publishing for a training', async () => {
    const draft = mountCard(match({ type: 'training', plan_status: 'draft' }), true)
    expect(draft.get('.next__coach').text()).toContain('Plan veröffentlichen')
    await draft.findAll('.next__coach button').at(-1)!.trigger('click')
    expect(publish).toHaveBeenCalledWith({ eventId: 'm1', status: 'published' }, expect.anything())
    const published = mountCard(match({ type: 'training', plan_status: 'published' }), true)
    expect(published.get('.next__coach').text()).not.toContain('veröffentlichen')
    expect(
      mountCard(match({ type: 'training' }))
        .find('.next__coach')
        .exists(),
    ).toBe(false)
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
