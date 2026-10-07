import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseButton from '../BaseButton.vue'

describe('BaseButton', () => {
  it('renders the slot and defaults to type="button"', () => {
    const wrapper = mount(BaseButton, { slots: { default: 'Save' } })

    expect(wrapper.text()).toBe('Save')
    expect(wrapper.attributes('type')).toBe('button')
    expect(wrapper.classes()).toContain('base-button--primary')
  })

  it('is disabled and busy while loading', () => {
    const wrapper = mount(BaseButton, { props: { loading: true }, slots: { default: 'Save' } })

    expect(wrapper.attributes('disabled')).toBeDefined()
    expect(wrapper.attributes('aria-busy')).toBe('true')
  })

  it('emits native click events', async () => {
    const wrapper = mount(BaseButton, { slots: { default: 'Go' } })

    await wrapper.trigger('click')

    expect(wrapper.emitted('click')).toHaveLength(1)
  })
})
