import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import UiWheel from '../UiWheel.vue'
import UiWheelPicker from '../UiWheelPicker.vue'

const options = [
  { value: '0', label: '0 Min.' },
  { value: '5', label: '5 Min.' },
  { value: '10', label: '10 Min.' },
  { value: '15', label: '15 Min.' },
]

function mountWheel(modelValue: string) {
  const wrapper = mount(UiWheel, {
    props: {
      label: 'Minuten',
      options,
      modelValue,
      'onUpdate:modelValue': (value: string | undefined): void => {
        void wrapper.setProps({ modelValue: value })
      },
    },
  })
  return wrapper
}

// jsdom has no PointerEvent; a MouseEvent with the pointer type name does the same here.
async function pointer(el: { element: Element }, type: string, clientY: number) {
  el.element.dispatchEvent(new MouseEvent(`pointer${type}`, { bubbles: true, button: 0, clientY }))
  await flushPromises()
}

// Without animation the drum lands at once, so the tests need no frames.
beforeEach(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce') }))
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('UiWheel', () => {
  it('is a labelled spin button that names the picked row', () => {
    const wrapper = mountWheel('10')
    const wheel = wrapper.get('[role="spinbutton"]')
    expect(wheel.attributes('aria-label')).toBe('Minuten')
    expect(wheel.attributes('aria-valuetext')).toBe('10 Min.')
    expect(wrapper.get('.ui-wheel__row--current').text()).toBe('10 Min.')
  })

  it('goes on endlessly in both directions', async () => {
    const wrapper = mountWheel('0')
    // The rows above the first option are the last ones.
    expect(wrapper.findAll('.ui-wheel__row').map((r) => r.text())).toEqual([
      '5 Min.',
      '10 Min.',
      '15 Min.',
      '0 Min.',
      '5 Min.',
      '10 Min.',
      '15 Min.',
    ])
    const wheel = wrapper.get('[role="spinbutton"]')
    await wheel.trigger('keydown', { key: 'ArrowUp' })
    expect(wrapper.props('modelValue')).toBe('15')
    await wheel.trigger('keydown', { key: 'ArrowDown' })
    await wheel.trigger('keydown', { key: 'ArrowDown' })
    expect(wrapper.props('modelValue')).toBe('5')
    await wheel.trigger('keydown', { key: 'End' })
    expect(wrapper.props('modelValue')).toBe('15')
    await wheel.trigger('keydown', { key: 'Home' })
    expect(wrapper.props('modelValue')).toBe('0')
  })

  it('turns to a tapped row', async () => {
    const wrapper = mountWheel('0')
    const row = wrapper.findAll('.ui-wheel__row')[5]!
    await pointer(row, 'down', 100)
    await pointer(row, 'up', 100)
    expect(wrapper.props('modelValue')).toBe('10')
  })

  it('follows a drag and snaps to the nearest row', async () => {
    const wrapper = mountWheel('5')
    const wheel = wrapper.get('[role="spinbutton"]')
    await pointer(wheel, 'down', 200)
    await pointer(wheel, 'move', 115) // a bit more than two rows up
    await pointer(wheel, 'up', 115)
    expect(wrapper.props('modelValue')).toBe('15')
  })

  it('turns with the mouse wheel', async () => {
    vi.useFakeTimers()
    const wrapper = mountWheel('5')
    const wheel = wrapper.get('[role="spinbutton"]')
    for (let i = 0; i < 2; i++) {
      wheel.element.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, cancelable: true }))
    }
    vi.advanceTimersByTime(200)
    await flushPromises()
    expect(wrapper.props('modelValue')).toBe('15')
  })

  it('turns to a value set from outside', async () => {
    const wrapper = mountWheel('0')
    await wrapper.setProps({ modelValue: '15' })
    expect(wrapper.get('[role="spinbutton"]').attributes('aria-valuetext')).toBe('15 Min.')
  })
})

describe('UiWheelPicker', () => {
  it('groups its columns under one label', () => {
    const wrapper = mount(UiWheelPicker, {
      props: { label: 'Dauer' },
      slots: { default: '<span class="column" />' },
    })
    const group = wrapper.get('[role="group"]')
    expect(wrapper.get(`[id="${group.attributes('aria-labelledby')}"]`).text()).toBe('Dauer')
    expect(wrapper.find('.column').exists()).toBe(true)
  })
})
