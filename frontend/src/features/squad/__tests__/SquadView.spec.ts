import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { computed, ref } from 'vue'
import { createPinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { i18n } from '@/lib/i18n'
import type { TeamMember } from '@/features/teams/api'
import SquadView from '../views/SquadView.vue'
import { member } from './squad.spec'

const isCoach = ref(false)
const squad = ref<TeamMember[]>([])

vi.mock('@/features/teams/composables/useActiveTeam', () => ({
  useActiveTeam: () => ({
    activeTeam: computed(() => ({ team_id: 'team', team_name: 'U17' })),
    isCoach,
  }),
}))
vi.mock('@/features/teams/composables/useTeams', () => ({
  useTeamMembers: () => ({
    data: squad,
    isPending: ref(false),
    isError: ref(false),
  }),
}))

function mountView() {
  return mount(SquadView, {
    global: {
      plugins: [createPinia(), i18n, [VueQueryPlugin, { queryClient: new QueryClient() }]],
      stubs: { InvitePanel: true, MemberFormModal: true, teleport: true },
    },
  })
}

describe('SquadView', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'de'
    squad.value = [
      member({ display_name: 'Coach', role: 'coach', user_id: 'c' }),
      member({ display_name: 'Max', shirt_number: 9, positions: ['FW'] }),
      member({ display_name: 'Tom', shirt_number: 4, positions: ['DF'], status: 'injured' }),
    ]
  })

  it('shows players with number, positions and status (text, not only color)', () => {
    const wrapper = mountView()
    const rows = wrapper.findAll('#squad-players ~ ul .squad__member')

    expect(rows.map((r) => r.find('.squad__name').text())).toEqual(['Tom', 'Max'])
    expect(rows[0]!.text()).toContain('4')
    expect(rows[0]!.text()).toContain('ABW')
    expect(rows[0]!.text()).toContain('Verletzt')
    expect(wrapper.text()).toContain('ohne Konto')
  })

  it('is read-only for players', () => {
    isCoach.value = false
    const wrapper = mountView()

    expect(wrapper.text()).not.toContain('Spieler hinzufügen')
    expect(wrapper.findAll('button.squad__member')).toHaveLength(0)
  })

  it('lets coaches add and edit players', () => {
    isCoach.value = true
    const wrapper = mountView()

    expect(wrapper.find('button[aria-label="Spieler hinzufügen"]').exists()).toBe(true)
    expect(wrapper.findAll('button.squad__member').length).toBe(3)
  })

  it('filters by status', async () => {
    isCoach.value = false
    const wrapper = mountView()
    const injuredChip = wrapper.findAll('.ui-chip').find((c) => c.text() === 'Verletzt')!

    await injuredChip.trigger('click')

    const names = wrapper.findAll('#squad-players ~ ul .squad__name').map((n) => n.text())
    expect(names).toEqual(['Tom'])
  })
})
