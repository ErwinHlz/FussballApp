import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from '../App.vue'
import { routes } from '../router'
import { i18n } from '@/lib/i18n'
import type { MyClub, MyTeam } from '@/features/teams/api'
import { teamKeys } from '@/features/teams/composables/useTeams'

// Uses a router without the auth guard: this test covers layout and navigation only.
async function mountAt(path: string, clubs?: MyClub[], teams?: Partial<MyTeam>[]) {
  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push(path)
  await router.isReady()
  const queryClient = new QueryClient()
  // Signed-out test user: queries are disabled but still read cached data.
  if (clubs) queryClient.setQueryData(teamKeys.myClubs(null), clubs)
  if (teams) queryClient.setQueryData(teamKeys.myTeams(null), teams)
  const wrapper = mount(App, {
    attachTo: document.body,
    global: { plugins: [createPinia(), router, i18n, [VueQueryPlugin, { queryClient }]] },
  })
  return { wrapper, router }
}

const tabLabels = (wrapper: Awaited<ReturnType<typeof mountAt>>['wrapper']) =>
  wrapper.findAll('.tab-bar__link').map((l) => l.text())

describe('App layout', () => {
  // First test loads the lazy start page (and its imports) once: give it more time.
  it('starts on the start tab and shows the four tabs', { timeout: 15_000 }, async () => {
    i18n.global.locale.value = 'de'
    const { wrapper, router } = await mountAt('/')
    await flush()

    expect(router.currentRoute.value.name).toBe('home')
    expect(tabLabels(wrapper)).toEqual(['Start', 'Termine', 'Training', 'Team'])
    expect(wrapper.get('[aria-current="page"]').text()).toBe('Start')
    wrapper.unmount()
  })

  it('marks the tab of sub-pages and links the profile from the header', async () => {
    i18n.global.locale.value = 'de'
    const { wrapper } = await mountAt('/stats')
    await flush()

    expect(wrapper.get('.tab-bar [aria-current="page"]').text()).toBe('Team')
    expect(wrapper.get('.top-bar__profile').attributes('aria-label')).toBe('Profil')
    expect(wrapper.get('.top-bar__profile').attributes('href')).toBe('/profile')
    wrapper.unmount()
  })

  it('switches teams and reaches club administration through the header sheet', async () => {
    i18n.global.locale.value = 'de'
    const { wrapper } = await mountAt(
      '/squad',
      [{ club_id: 'c1', club_name: 'SV Test', role: 'admin' }],
      [
        { team_id: 't1', team_name: 'U17', club_name: 'SV Test', team_role: 'coach' },
        { team_id: 't2', team_name: 'U19', club_name: 'SV Test', team_role: 'player' },
      ],
    )
    await flush()
    expect(wrapper.get('.top-bar__name').text()).toBe('U17')

    await wrapper.get('.top-bar__team').trigger('click')
    await flush()
    const sheet = document.body.querySelector('[role="dialog"]')!
    expect(sheet.textContent).toContain('Verein verwalten: SV Test')
    const u19 = [...sheet.querySelectorAll('button')].find((b) => b.textContent?.includes('U19'))!
    u19.click()
    await flush()
    expect(wrapper.get('.top-bar__name').text()).toBe('U19')
    wrapper.unmount()
  })

  it('switches language to English', async () => {
    i18n.global.locale.value = 'en'
    const { wrapper } = await mountAt('/squad')
    await flush()

    expect(wrapper.get('h1').text()).toBe('Squad')
    expect(tabLabels(wrapper)).toEqual(['Home', 'Events', 'Training', 'Team'])
    i18n.global.locale.value = 'de'
    wrapper.unmount()
  })
})

// Lazy route components resolve asynchronously.
async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}
