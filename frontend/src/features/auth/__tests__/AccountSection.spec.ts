import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { createMemoryHistory, createRouter } from 'vue-router'
import { i18n } from '@/lib/i18n'
import AccountSection from '../components/AccountSection.vue'
import LegalView from '@/features/legal/views/LegalView.vue'

const deleteMyAccount = vi.fn()

vi.mock('../api', () => ({
  deleteMyAccount: () => deleteMyAccount(),
  isSoleAdminError: (error: { hint?: string } | null) => error?.hint === 'sole_admin',
}))

const Stub = { template: '<div />' }

async function mountSection() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/profile', component: Stub },
      { path: '/login', name: 'login', component: Stub },
    ],
  })
  await router.push('/profile')
  await router.isReady()
  const wrapper = mount(AccountSection, {
    attachTo: document.body,
    global: { plugins: [router, i18n, [VueQueryPlugin, { queryClient: new QueryClient() }]] },
  })
  await wrapper
    .findAll('button')
    .find((b) => b.text() === 'Konto löschen')!
    .trigger('click')
  await flushPromises()
  return { wrapper, router }
}

function finalButton() {
  return [...document.body.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === 'Endgültig löschen',
  )!
}

async function typeConfirmation(value: string) {
  const input = document.body.querySelector<HTMLInputElement>('[role="dialog"] input')!
  input.value = value
  input.dispatchEvent(new Event('input'))
  await flushPromises()
}

describe('AccountSection', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'de'
    deleteMyAccount.mockReset().mockResolvedValue(undefined)
    document.body.innerHTML = ''
  })

  it('deletes only after typing the confirmation word, then goes to the login', async () => {
    const { wrapper, router } = await mountSection()

    expect(finalButton().disabled).toBe(true)
    await typeConfirmation('löschen')
    expect(finalButton().disabled).toBe(false)

    finalButton().click()
    await flushPromises()

    expect(deleteMyAccount).toHaveBeenCalledOnce()
    expect(router.currentRoute.value.fullPath).toBe('/login?deleted=1')
    wrapper.unmount()
  })

  it('explains when the user is the last admin of a club', async () => {
    deleteMyAccount.mockRejectedValue({ hint: 'sole_admin' })
    const { wrapper } = await mountSection()

    await typeConfirmation('LÖSCHEN')
    finalButton().click()
    await flushPromises()

    expect(document.body.textContent).toContain('einzige Admin')
    wrapper.unmount()
  })
})

describe('LegalView', () => {
  it('highlights template placeholders', () => {
    const wrapper = mount(LegalView, {
      props: { document: 'imprint' },
      global: { plugins: [i18n], stubs: { RouterLink: true } },
    })

    expect(wrapper.get('h1').text()).toBe('Impressum')
    expect(wrapper.findAll('mark').map((m) => m.text())).toContain('[Name / Verein]')
    expect(wrapper.get('[role="note"]').text()).toContain('Vorlage')
  })
})
