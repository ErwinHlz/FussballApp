import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from '../App.vue'
import { routes } from '../router'
import { i18n } from '@/lib/i18n'
import type { MyClub } from '@/features/teams/api'
import { teamKeys } from '@/features/teams/composables/useTeams'

// Uses a router without the auth guard: this test covers layout and navigation only.
async function mountAt(path: string, clubs?: MyClub[]) {
  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push(path)
  await router.isReady()
  const queryClient = new QueryClient()
  // Signed-out test user: queries are disabled but still read cached data.
  if (clubs) queryClient.setQueryData(teamKeys.myClubs(null), clubs)
  const wrapper = mount(App, {
    global: { plugins: [createPinia(), router, i18n, [VueQueryPlugin, { queryClient }]] },
  })
  return { wrapper, router }
}

const tabLabels = (wrapper: Awaited<ReturnType<typeof mountAt>>['wrapper']) =>
  wrapper.findAll('.bottom-nav__link').map((l) => l.text())

describe('App layout', () => {
  it('redirects / to the events tab and shows the bottom navigation', async () => {
    i18n.global.locale.value = 'de'
    const { wrapper, router } = await mountAt('/')
    await flush()

    expect(router.currentRoute.value.name).toBe('events')
    expect(tabLabels(wrapper)).toEqual(['Termine', 'Training', 'Kader', 'Profil'])
    expect(wrapper.get('.bottom-nav__link--active').text()).toBe('Termine')
  })

  it('shows the club tab only for club admins and links to the club', async () => {
    i18n.global.locale.value = 'de'
    const { wrapper: member } = await mountAt('/events', [
      { club_id: 'c1', club_name: 'SV Test', role: 'member' },
    ])
    expect(tabLabels(member)).not.toContain('Verein')

    const { wrapper: admin } = await mountAt('/events', [
      { club_id: 'c1', club_name: 'SV Test', role: 'admin' },
    ])
    await flush()
    expect(tabLabels(admin)).toEqual(['Termine', 'Training', 'Kader', 'Verein', 'Profil'])
    const clubTab = admin.findAll('.bottom-nav__link')[3]!
    expect(clubTab.attributes('href')).toBe('/clubs/c1')
  })

  it('opens the club list when the user administers several clubs', async () => {
    const { wrapper } = await mountAt('/events', [
      { club_id: 'c1', club_name: 'A', role: 'admin' },
      { club_id: 'c2', club_name: 'B', role: 'admin' },
    ])
    expect(wrapper.findAll('.bottom-nav__link')[3]!.attributes('href')).toBe('/teams')
  })

  it('switches language to English', async () => {
    i18n.global.locale.value = 'en'
    const { wrapper } = await mountAt('/squad')
    await flush()

    expect(wrapper.get('h1').text()).toBe('Squad')
    i18n.global.locale.value = 'de'
  })
})

// Lazy route components resolve asynchronously.
async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}
