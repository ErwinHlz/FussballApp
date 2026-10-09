import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { i18n } from '@/lib/i18n'
import LoginView from '../views/LoginView.vue'
import RegisterView from '../views/RegisterView.vue'

const signInMutate = vi.fn()
const signUpMutate = vi.fn()

function mutation(mutateAsync: ReturnType<typeof vi.fn>) {
  return { mutateAsync, isPending: ref(false), isError: ref(false), error: ref(null) }
}

vi.mock('../composables/useAuth', () => ({
  useSignIn: () => mutation(signInMutate),
  useSignUp: () => mutation(signUpMutate),
}))

const Stub = { template: '<div />' }

async function mountAt(component: object, path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'login', component: LoginView },
      { path: '/register', name: 'register', component: RegisterView },
      { path: '/forgot-password', name: 'forgot-password', component: Stub },
      { path: '/privacy', name: 'privacy', component: Stub },
      { path: '/imprint', name: 'imprint', component: Stub },
      { path: '/:any(.*)*', component: Stub },
    ],
  })
  await router.push(path)
  await router.isReady()
  const wrapper = mount(component, { global: { plugins: [router, i18n] } })
  return { wrapper, router }
}

async function fill(wrapper: Awaited<ReturnType<typeof mountAt>>['wrapper'], values: string[]) {
  const inputs = wrapper.findAll('input')
  for (const [index, value] of values.entries()) await inputs[index]!.setValue(value)
}

async function acceptConsent(wrapper: Awaited<ReturnType<typeof mountAt>>['wrapper']) {
  await wrapper.get('input[type="checkbox"]').setValue(true)
}

describe('LoginView', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'de'
    signInMutate.mockReset().mockResolvedValue(undefined)
  })

  it('validates before signing in', async () => {
    const { wrapper } = await mountAt(LoginView, '/login')

    await fill(wrapper, ['not-an-email', ''])
    await wrapper.get('form').trigger('submit')

    // VeeValidate validates asynchronously.
    await vi.waitFor(() => expect(wrapper.text()).toContain('gültige E-Mail-Adresse'))
    expect(signInMutate).not.toHaveBeenCalled()
  })

  it('signs in and follows a safe redirect', async () => {
    const { wrapper, router } = await mountAt(LoginView, '/login?redirect=/join/abc?accept=1')

    await fill(wrapper, [' coach@example.test ', 'secret-pass'])
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(signInMutate).toHaveBeenCalled())
    await flushPromises()

    expect(signInMutate).toHaveBeenCalledWith({
      email: 'coach@example.test',
      password: 'secret-pass',
    })
    expect(router.currentRoute.value.fullPath).toBe('/join/abc?accept=1')
  })
})

describe('RegisterView', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'de'
    signUpMutate.mockReset().mockResolvedValue({ signedIn: true })
  })

  it('requires passwords of at least 8 characters', async () => {
    const { wrapper } = await mountAt(RegisterView, '/register')

    await fill(wrapper, ['Alex', 'alex@example.test', 'short', 'short'])
    await wrapper.get('form').trigger('submit')

    await vi.waitFor(() => expect(wrapper.text()).toContain('Mindestens 8 Zeichen'))
    expect(signUpMutate).not.toHaveBeenCalled()
  })

  it('requires both passwords to match', async () => {
    const { wrapper } = await mountAt(RegisterView, '/register')

    await fill(wrapper, ['Alex', 'alex@example.test', 'long-enough', 'different-one'])
    await acceptConsent(wrapper)
    await wrapper.get('form').trigger('submit')

    await vi.waitFor(() => expect(wrapper.text()).toContain('stimmen nicht überein'))
    expect(signUpMutate).not.toHaveBeenCalled()
  })

  it('creates the account with the display name and continues to the invite', async () => {
    const { wrapper, router } = await mountAt(RegisterView, '/register?redirect=/join/abc?accept=1')

    await fill(wrapper, ['Alex', 'alex@example.test', 'long-enough', 'long-enough'])
    await acceptConsent(wrapper)
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(signUpMutate).toHaveBeenCalled())
    await flushPromises()

    expect(signUpMutate).toHaveBeenCalledWith({
      email: 'alex@example.test',
      password: 'long-enough',
      displayName: 'Alex',
      redirectPath: '/join/abc?accept=1',
    })
    expect(router.currentRoute.value.fullPath).toBe('/join/abc?accept=1')
  })

  it('requires the privacy and age consent', async () => {
    const { wrapper } = await mountAt(RegisterView, '/register')

    await fill(wrapper, ['Alex', 'alex@example.test', 'long-enough', 'long-enough'])
    await wrapper.get('form').trigger('submit')

    await vi.waitFor(() => expect(wrapper.text()).toContain('Bitte bestätigen'))
    expect(signUpMutate).not.toHaveBeenCalled()
    expect(wrapper.get('.consent a[href="/privacy"]').text()).toBe('Datenschutzerklärung')
  })

  it('asks to confirm the email when no session is returned', async () => {
    signUpMutate.mockResolvedValue({ signedIn: false })
    const { wrapper } = await mountAt(RegisterView, '/register')

    await fill(wrapper, ['Alex', 'alex@example.test', 'long-enough', 'long-enough'])
    await acceptConsent(wrapper)
    await wrapper.get('form').trigger('submit')

    await vi.waitFor(() => expect(wrapper.find('[role="status"]').exists()).toBe(true))
    expect(wrapper.get('[role="status"]').text()).toContain('alex@example.test')
  })
})
