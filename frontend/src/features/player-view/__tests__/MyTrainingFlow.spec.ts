import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import { ref } from 'vue'
import { i18n } from '@/lib/i18n'
import type { PlanItem } from '@/features/training-plan/logic'
import type { DrillGroups } from '@/features/groups/api'
import MyTrainingFlow from '../components/MyTrainingFlow.vue'

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
  return mount(MyTrainingFlow, {
    props: { eventId: 'e1', memberId: 'me' },
    global: { plugins: [i18n], stubs: { RouterLink: RouterLinkStub } },
  })
}

describe('MyTrainingFlow', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'de'
    plan.value = [
      item('ed1', 'Aufwärmen', 10),
      item('ed2', 'Rondo', 20),
      item('ed3', 'Abschluss', 25),
    ]
  })

  it('shows the own group (color + name) for each drill', () => {
    groups.value = [drillGroups('ed1', null), drillGroups('ed2', 'red'), drillGroups('ed3', 'blue')]
    const rows = mountFlow().findAll('.flow__item')

    expect(rows.map((r) => r.find('.flow__title').text())).toEqual([
      'Aufwärmen',
      'Rondo',
      'Abschluss',
    ])
    expect(rows[0]!.find('.bib').exists()).toBe(false)
    expect(rows[1]!.find('.bib').text()).toBe('Rot')
    expect(rows[2]!.find('.bib').text()).toBe('Blau')
    expect(rows[1]!.classes()).toContain('flow__item--grouped')
  })

  it('shows the group once, big, when it is the same in every drill', () => {
    groups.value = [
      drillGroups('ed1', 'blue'),
      drillGroups('ed2', 'blue'),
      drillGroups('ed3', 'blue'),
    ]
    const wrapper = mountFlow()

    expect(wrapper.find('.flow__same').text()).toContain('Deine Gruppe heute:')
    expect(wrapper.find('.flow__same .bib').text()).toBe('Blau')
    expect(wrapper.findAll('.flow__item .bib')).toHaveLength(0)
  })

  it('links each drill with the event context for the drill page', () => {
    groups.value = []
    const link = mountFlow().findAllComponents(RouterLinkStub)[1]!
    expect(link.props('to')).toEqual({
      name: 'drill',
      params: { drillId: 'd-ed2' },
      query: { event: 'e1', ed: 'ed2' },
    })
  })
})
