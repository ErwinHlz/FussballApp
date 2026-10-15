import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import { ref } from 'vue'
import { i18n } from '@/lib/i18n'
import type { PlanItem } from '@/features/training-plan/logic'
import type { DrillGroups } from '@/features/groups/api'
import TrainingFlow from '../components/TrainingFlow.vue'

const plan = ref<PlanItem[]>([])
const groups = ref<DrillGroups[]>([])

vi.mock('@/features/training-plan/composables/usePlan', () => ({
  usePlan: () => ({ data: plan, isPending: ref(false) }),
}))
vi.mock('@/features/groups/composables/useGroups', () => ({
  useEventGroups: () => ({ data: groups }),
}))

function item(id: string, title: string, minutes: number): PlanItem {
  return {
    id,
    event_id: 'e1',
    drill_id: `d-${id}`,
    position: 1,
    duration_min: null,
    coach_notes: null,
    created_at: '',
    drill: { id: `d-${id}`, title, category: 'passing', duration_min: minutes, team_id: null },
  }
}

function drillGroups(id: string, mine: 'red' | 'blue' | null): DrillGroups {
  return {
    id,
    position: 1,
    drill: { id: `d-${id}`, title: id },
    groups: [
      {
        id: `${id}-r`,
        name: 'Rot',
        color: 'red',
        created_at: '',
        member_ids: mine === 'red' ? ['me'] : [],
      },
      {
        id: `${id}-b`,
        name: 'Blau',
        color: 'blue',
        created_at: '',
        member_ids: mine === 'blue' ? ['me'] : [],
      },
    ],
  }
}

function mountFlow() {
  return mount(TrainingFlow, {
    props: { eventId: 'e1', memberId: 'me' },
    global: { plugins: [i18n], stubs: { RouterLink: RouterLinkStub } },
  })
}

describe('TrainingFlow', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'de'
    plan.value = [
      item('ed1', 'Aufwärmen', 10),
      item('ed2', 'Rondo', 20),
      item('ed3', 'Abschluss', 25),
    ]
    groups.value = [drillGroups('ed2', 'red'), drillGroups('ed3', 'blue')]
  })

  it('lists the drills in order with minutes and the total', () => {
    const wrapper = mountFlow()
    const rows = wrapper.findAll('.flow__item')
    expect(rows.map((r) => r.get('.flow__drill').text())).toEqual([
      'Aufwärmen',
      'Rondo',
      'Abschluss',
    ])
    expect(rows[1]!.get('.flow__minutes').text()).toBe('20 Min.')
    expect(wrapper.get('.flow__total').text()).toBe('55 Min.')
  })

  it('shows the own bib with color and name only where the player is in a group', () => {
    const wrapper = mountFlow()
    const rows = wrapper.findAll('.flow__item')
    expect(rows[0]!.find('.bib-chip').exists()).toBe(false)
    expect(rows[1]!.get('.bib-chip').text()).toContain('Rot')
    expect(rows[2]!.get('.bib-chip').text()).toContain('Blau')
  })

  it('links each drill with the event context for the drill page', () => {
    const wrapper = mountFlow()
    const link = wrapper.findAllComponents(RouterLinkStub)[1]!
    expect(link.props('to')).toEqual({
      name: 'drill',
      params: { drillId: 'd-ed2' },
      query: { event: 'e1', ed: 'ed2' },
    })
  })
})
