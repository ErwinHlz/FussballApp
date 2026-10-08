import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from '../App.vue'
import { routes } from '../router'
import { i18n } from '@/lib/i18n'

// Uses a router without the auth guard: this test covers layout and navigation only.
async function mountAt(path: string) {
  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push(path)
  await router.isReady()
  const wrapper = mount(App, {
    global: {
      plugins: [createPinia(), router, i18n, [VueQueryPlugin, { queryClient: new QueryClient() }]],
    },
  })
  return { wrapper, router }
}

describe('App layout', () => {
  it('redirects / to the events tab and shows the bottom navigation', async () => {
    i18n.global.locale.value = 'de'
    const { wrapper, router } = await mountAt('/')
    await flush()

    expect(router.currentRoute.value.name).toBe('events')
    const links = wrapper.findAll('.bottom-nav__link')
    expect(links.map((l) => l.text())).toEqual(['Termine', 'Training', 'Kader', 'Profil'])
    expect(wrapper.get('.bottom-nav__link--active').text()).toBe('Termine')
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
