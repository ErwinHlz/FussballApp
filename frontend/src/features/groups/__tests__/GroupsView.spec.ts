import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { i18n } from '@/lib/i18n'
import { member } from '@/features/squad/__tests__/squad.spec'
import type { DrillGroups } from '../api'
import GroupsView from '../views/GroupsView.vue'

const saveMutate = vi.fn()
const members = [
  member({ id: 'm1', display_name: 'Anna', shirt_number: 1, positions: ['GK'] }),
  member({ id: 'm2', display_name: 'Ben', shirt_number: 2, positions: ['DF'] }),
  member({ id: 'm3', display_name: 'Cem', shirt_number: 3, positions: ['MF'] }),
  member({ id: 'm4', display_name: 'Dana', shirt_number: 4, positions: ['FW'] }),
  member({ id: 'm5', display_name: 'Nein', shirt_number: 5 }),
]
const attendance = (memberId: string, status: string) => ({ member_id: memberId, status })
const eventData = ref({
  id: 'e1',
  team_id: 't1',
  starts_at: '2030-01-10T18:00:00Z',
  attendances: [
    attendance('m1', 'yes'),
    attendance('m2', 'yes'),
    attendance('m3', 'maybe'),
    attendance('m4', 'yes'),
    attendance('m5', 'no'),
  ],
})
const groupsData = ref<DrillGroups[]>([])

vi.mock('@/features/events/composables/useEvents', () => ({
  useEvent: () => ({ data: eventData, isPending: ref(false), isError: ref(false) }),
  useMyMember: () => ({ members: { data: ref(members) } }),
}))
vi.mock('@/features/teams/composables/useActiveTeam', () => ({
  useActiveTeam: () => ({
    myTeams: { data: ref([{ team_id: 't1', team_role: 'coach', is_club_admin: false }]) },
  }),
}))
vi.mock('../composables/useGroups', () => ({
  useEventGroups: () => ({ data: groupsData, isPending: ref(false) }),
  useSaveDrillGroups: () => ({
    mutateAsync: saveMutate,
    isPending: ref(false),
    isError: ref(false),
  }),
}))

async function mountView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/events/:eventId/groups', name: 'event-groups', component: GroupsView, props: true },
      { path: '/events/:eventId/plan', name: 'event-plan', component: { template: '<div />' } },
    ],
  })
  await router.push('/events/e1/groups')
  await router.isReady()
  return mount(GroupsView, {
    props: { eventId: 'e1' },
    global: { plugins: [router, i18n] },
  })
}

const poolNames = (w: Awaited<ReturnType<typeof mountView>>) =>
  w.findAll('.groups__box--pool .chip').map((c) => c.text().replace(/\s+/g, ' ').trim())

describe('GroupsView', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'de'
    saveMutate.mockReset().mockResolvedValue(undefined)
    groupsData.value = [
      { id: 'ed1', position: 1, drill: { id: 'd1', title: 'Rondo' }, groups: [] },
      { id: 'ed2', position: 2, drill: { id: 'd2', title: 'Abschluss' }, groups: [] },
    ]
  })

  it('offers only yes/maybe players, maybe marked, declined hidden', async () => {
    const wrapper = await mountView()

    expect(poolNames(wrapper)).toEqual(['1 Anna', '2 Ben', '3 Cem ?Vielleicht', '4 Dana'])
    expect(wrapper.text()).not.toContain('Nein')
  })

  it('moves a player by tapping (no drag needed) and saves exactly that', async () => {
    const wrapper = await mountView()
    await wrapper.findAll('.groups__add').at(0)!.trigger('click') // Rot
    await wrapper.findAll('.groups__add').at(0)!.trigger('click') // Blau

    const anna = wrapper.findAll('.groups__box--pool .chip').find((c) => c.text().includes('Anna'))!
    await anna.trigger('click')
    expect(anna.attributes('aria-pressed')).toBe('true')
    const here = wrapper.findAll('.groups__grid .groups__here')
    await here.at(1)!.trigger('click') // into "Blau"

    expect(poolNames(wrapper)).not.toContain('1 Anna')
    // Cem only said maybe, so only Ben and Dana count as unassigned yes.
    expect(wrapper.text()).toContain('2 Zusagen ohne Gruppe: Ben, Dana')

    await wrapper.find('.groups__savebar button').trigger('click')
    await flushPromises()
    expect(saveMutate).toHaveBeenCalledWith({
      eventDrillId: 'ed1',
      groups: [
        expect.objectContaining({ name: 'Rot', color: 'red', memberIds: [] }),
        expect.objectContaining({ name: 'Blau', color: 'blue', memberIds: ['m1'] }),
      ],
    })
  })

  it('distributes all available players randomly into two default groups', async () => {
    const wrapper = await mountView()
    const random = wrapper
      .findAll('.groups__tools button')
      .find((b) => b.text().includes('Zufällig'))!
    await random.trigger('click')

    expect(poolNames(wrapper)).toEqual([])
    const sizes = wrapper
      .findAll('.groups__grid .groups__box')
      .map((b) => b.findAll('.chip').length)
    expect(sizes).toEqual([2, 2])
    expect(wrapper.text()).toContain('ungespeichert')
  })
})
