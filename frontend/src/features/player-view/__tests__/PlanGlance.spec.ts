import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import { ref } from 'vue'
import { i18n } from '@/lib/i18n'
import type { PlanItem } from '@/features/training-plan/logic'
import type { DrillGroups, SavedGroup } from '@/features/groups/api'
import PlanGlance from '../components/PlanGlance.vue'
import { sameGroupsEverywhere } from '../logic'

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

const group = (
  id: string,
  name: string,
  color: SavedGroup['color'],
  ids: string[],
): SavedGroup => ({
  id,
  name,
  color,
  created_at: '',
  member_ids: ids,
})

const split = (red: string[], blue: string[]) => [
  group('r', 'Rot', 'red', red),
  group('b', 'Blau', 'blue', blue),
]

const names = new Map([
  ['me', 'Pia'],
  ['p2', 'Lena'],
  ['p3', 'Ali'],
])

function mountGlance(draft = false, showAll = true) {
  return mount(PlanGlance, {
    props: { eventId: 'e1', memberId: 'me', names, draft, showAll },
    global: { plugins: [i18n], stubs: { RouterLink: RouterLinkStub, DrillThumb: true } },
  })
}

describe('PlanGlance', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'de'
    plan.value = []
    groups.value = []
  })

  it('renders nothing without a plan', () => {
    expect(mountGlance().find('.glance').exists()).toBe(false)
  })

  it('lists the drills with minutes and leaves out missing groups', () => {
    plan.value = [item('a', 'Rondo 4 gegen 2', 15), item('b', 'Abschluss', 20)]
    const wrapper = mountGlance()
    expect(wrapper.get('.glance__total').text()).toBe('35 Min.')
    expect(wrapper.findAll('.glance__name').map((n) => n.text())).toEqual([
      '1 · Rondo 4 gegen 2',
      '2 · Abschluss',
    ])
    expect(wrapper.find('.glance__groups').exists()).toBe(false)
  })

  it('shows players only their own bib, once when it never changes', () => {
    plan.value = [item('a', 'Rondo', 15), item('b', 'Spiel', 20)]
    groups.value = [
      { id: 'a', position: 1, drill: { id: 'd-a', title: 'Rondo' }, groups: split(['me'], ['p2']) },
      { id: 'b', position: 2, drill: { id: 'd-b', title: 'Spiel' }, groups: split(['p2'], ['me']) },
    ]
    const perDrill = mountGlance(false, false)
    expect(perDrill.text()).not.toContain('Lena')
    expect(perDrill.findAll('.glance__link').map((l) => l.find('.bib-chip__label').text())).toEqual(
      ['Rot', 'Blau'],
    )

    groups.value[1]!.groups = split(['me'], ['p2'])
    const same = mountGlance(false, false)
    expect(same.get('.glance__mine').text()).toContain('Rot')
    expect(same.findAll('.glance__link .bib-chip')).toHaveLength(0)
  })

  it('shows coaches the same split once, with the own name highlighted', () => {
    plan.value = [item('a', 'Rondo', 15), item('b', 'Spiel', 20)]
    groups.value = [
      {
        id: 'a',
        position: 1,
        drill: { id: 'd-a', title: 'Rondo' },
        groups: split(['me', 'p2'], ['p3']),
      },
      {
        id: 'b',
        position: 2,
        drill: { id: 'd-b', title: 'Spiel' },
        groups: split(['p2', 'me'], ['p3']),
      },
    ]
    const wrapper = mountGlance()
    expect(wrapper.get('.glance__shared').text()).toContain('Gruppen für alle Übungen')
    expect(wrapper.findAll('.glance__group')).toHaveLength(2)
    expect(wrapper.get('.glance__me').text()).toBe('Pia (du)')
    expect(wrapper.get('.glance__shared').text()).toContain('Lena')
  })

  it('shows groups per drill when they differ and marks drafts', () => {
    plan.value = [item('a', 'Rondo', 15), item('b', 'Spiel', 20)]
    groups.value = [
      { id: 'a', position: 1, drill: { id: 'd-a', title: 'Rondo' }, groups: split(['me'], ['p2']) },
      { id: 'b', position: 2, drill: { id: 'd-b', title: 'Spiel' }, groups: [] },
    ]
    const wrapper = mountGlance(true)
    expect(wrapper.find('.glance__shared').exists()).toBe(false)
    expect(wrapper.findAll('.glance__drill')[0]!.findAll('.glance__group')).toHaveLength(2)
    expect(wrapper.findAll('.glance__drill')[1]!.find('.glance__groups').exists()).toBe(false)
    expect(wrapper.get('.glance__title').text()).toContain('Entwurf')
  })
})

describe('sameGroupsEverywhere', () => {
  it('needs groups in every drill with the same bibs and players', () => {
    expect(sameGroupsEverywhere([])).toBeNull()
    expect(sameGroupsEverywhere([split(['a'], ['b']), []])).toBeNull()
    expect(sameGroupsEverywhere([split(['a'], ['b']), split(['b'], ['a'])])).toBeNull()
    expect(sameGroupsEverywhere([split(['a', 'c'], ['b']), split(['c', 'a'], ['b'])])).toHaveLength(
      2,
    )
  })
})
