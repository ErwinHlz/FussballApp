import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import UiButton from '../UiButton.vue'

describe('UiButton', () => {
  it('renders the slot and defaults to type="button"', () => {
    const wrapper = mount(UiButton, { slots: { default: 'Save' } })

    expect(wrapper.text()).toBe('Save')
    expect(wrapper.attributes('type')).toBe('button')
    expect(wrapper.classes()).toContain('ui-button--primary')
  })

  it('is disabled and busy while loading', () => {
    const wrapper = mount(UiButton, { props: { loading: true }, slots: { default: 'Save' } })

    expect(wrapper.attributes('disabled')).toBeDefined()
    expect(wrapper.attributes('aria-busy')).toBe('true')
  })

  it('emits native click events', async () => {
    const wrapper = mount(UiButton, { slots: { default: 'Go' } })

    await wrapper.trigger('click')

    expect(wrapper.emitted('click')).toHaveLength(1)
  })
})
