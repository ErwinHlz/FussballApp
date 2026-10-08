import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { i18n } from '@/lib/i18n'
import LoginView from '../views/LoginView.vue'

const mutateAsync = vi.fn()

vi.mock('../composables/useAuth', () => ({
  useSendMagicLink: () => ({
    mutateAsync,
    reset: vi.fn(),
    isPending: ref(false),
    isError: ref(false),
  }),
}))

async function mountLogin(path = '/login') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/login', name: 'login', component: LoginView }],
  })
  await router.push(path)
  await router.isReady()
  return mount(LoginView, { global: { plugins: [router, i18n] } })
}

describe('LoginView', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'de'
    mutateAsync.mockReset().mockResolvedValue(undefined)
  })

  it('validates the email before sending', async () => {
    const wrapper = await mountLogin()

    await wrapper.get('input').setValue('not-an-email')
    await wrapper.get('form').trigger('submit')
    // VeeValidate validates asynchronously.
    await vi.waitFor(() => expect(wrapper.text()).toContain('gültige E-Mail-Adresse'))
    expect(mutateAsync).not.toHaveBeenCalled()
  })

  it('sends the magic link with a safe redirect and shows the confirmation', async () => {
    const wrapper = await mountLogin('/login?redirect=/squad')

    await wrapper.get('input').setValue('  player@example.test ')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(mutateAsync).toHaveBeenCalled())
    await flushPromises()

    expect(mutateAsync).toHaveBeenCalledWith({
      email: 'player@example.test',
      redirectPath: '/squad',
    })
    expect(wrapper.get('[role="status"]').text()).toContain('player@example.test')
  })
})
