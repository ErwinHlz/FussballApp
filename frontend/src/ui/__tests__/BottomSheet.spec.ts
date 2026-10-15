import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, nextTick, ref } from 'vue'
import { i18n } from '@/lib/i18n'
import BottomSheet from '../BottomSheet.vue'

// A trigger button plus a sheet with two actions, mounted into the document for focus tests.
const Host = defineComponent({
  components: { BottomSheet },
  setup: () => ({ open: ref(false) }),
  template: `
    <button id="trigger" @click="open = true">Open</button>
    <BottomSheet v-model:open="open" title="Absagen" description="Warum?">
      <button id="first">Krank</button>
      <button id="last">Arbeit</button>
    </BottomSheet>`,
})

function mountHost() {
  return mount(Host, { attachTo: document.body, global: { plugins: [i18n] } })
}

const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]')
const key = (k: string, shift = false) =>
  document.dispatchEvent(new KeyboardEvent('keydown', { key: k, shiftKey: shift, bubbles: true }))

async function openSheet() {
  const trigger = document.getElementById('trigger')!
  trigger.focus()
  trigger.click()
  await nextTick()
  await nextTick()
  return trigger
}

afterEach(() => {
  document.body.innerHTML = ''
  document.body.style.overflow = ''
})

describe('BottomSheet', () => {
  it('opens as a labelled modal dialog and takes the focus', async () => {
    const wrapper = mountHost()
    await openSheet()

    const sheet = dialog()!
    expect(sheet.getAttribute('aria-modal')).toBe('true')
    const title = document.getElementById(sheet.getAttribute('aria-labelledby')!)
    expect(title?.textContent).toBe('Absagen')
    const description = document.getElementById(sheet.getAttribute('aria-describedby')!)
    expect(description?.textContent).toContain('Warum?')
    expect(document.activeElement).toBe(sheet)
    expect(document.body.style.overflow).toBe('hidden')
    wrapper.unmount()
  })

  it('closes with Escape and gives the focus back to the trigger', async () => {
    const wrapper = mountHost()
    const trigger = await openSheet()

    key('Escape')
    await nextTick()
    await nextTick()
    expect(wrapper.vm.open).toBe(false)
    expect(document.activeElement).toBe(trigger)
    expect(document.body.style.overflow).toBe('')
    wrapper.unmount()
  })

  it('keeps Tab inside the sheet', async () => {
    const wrapper = mountHost()
    await openSheet()

    // jsdom has no layout, so offsetParent is null everywhere: treat all buttons as visible.
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetParent')
    Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
      configurable: true,
      get: () => document.body,
    })
    const buttons = [...dialog()!.querySelectorAll('button')]
    const last = buttons[buttons.length - 1]!
    last.focus()
    key('Tab')
    expect(document.activeElement).toBe(buttons[0])
    key('Tab', true)
    expect(document.activeElement).toBe(last)
    if (original) Object.defineProperty(HTMLElement.prototype, 'offsetParent', original)
    wrapper.unmount()
  })
})
