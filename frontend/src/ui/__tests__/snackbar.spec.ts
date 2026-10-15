import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { i18n } from '@/lib/i18n'
import SnackbarHost from '../SnackbarHost.vue'
import { useSnackbar } from '../useSnackbar'

afterEach(() => {
  useSnackbar().dismiss()
  vi.useRealTimers()
})

describe('Snackbar', () => {
  it('announces messages in a live region and hides them after a while', async () => {
    vi.useFakeTimers()
    const wrapper = mount(SnackbarHost, { global: { plugins: [i18n] } })
    const host = wrapper.get('.snackbar-host')
    expect(host.attributes('aria-live')).toBe('polite')

    useSnackbar().show({ text: 'Gespeichert' })
    await nextTick()
    expect(host.text()).toContain('Gespeichert')

    vi.advanceTimersByTime(5000)
    await nextTick()
    expect(useSnackbar().current.value).toBeNull()
  })

  it('runs the undo action once and closes', async () => {
    const run = vi.fn()
    const wrapper = mount(SnackbarHost, { global: { plugins: [i18n] } })
    useSnackbar().show({ text: 'Abgesagt', action: { label: 'Rückgängig', run } })
    await nextTick()

    await wrapper.get('.snackbar__action').trigger('click')
    expect(run).toHaveBeenCalledTimes(1)
    expect(useSnackbar().current.value).toBeNull()
  })

  it('replaces an older message with a newer one', () => {
    const snackbar = useSnackbar()
    snackbar.show({ text: 'Eins' })
    snackbar.show({ text: 'Zwei' })
    expect(snackbar.current.value?.text).toBe('Zwei')
  })
})
