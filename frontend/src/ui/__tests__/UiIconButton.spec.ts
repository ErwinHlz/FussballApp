import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import UiButton from '../UiButton.vue'
import UiIconButton from '../UiIconButton.vue'

describe('UiIconButton', () => {
  it('shares the global button design with UiButton', () => {
    const icon = mount(UiIconButton, { props: { icon: 'filter', label: 'Filter' } })
    const text = mount(UiButton, { props: { variant: 'secondary' }, slots: { default: 'Go' } })

    expect(icon.classes()).toEqual(['ui-button', 'ui-button--icon', 'ui-button--secondary'])
    expect(text.classes()).toEqual(
      expect.arrayContaining(['ui-button', 'ui-button--secondary', 'ui-button--md']),
    )
  })

  it('is named by its label and shows a count as badge', () => {
    const wrapper = mount(UiIconButton, { props: { icon: 'filter', label: 'Filter', badge: 2 } })

    expect(wrapper.attributes('aria-label')).toBe('Filter')
    expect(wrapper.get('.ui-button__badge').text()).toBe('2')
    expect(wrapper.get('.ui-button__badge').attributes('aria-hidden')).toBe('true')
  })

  it('shows no badge for zero and is no toggle unless pressed is set', () => {
    const wrapper = mount(UiIconButton, { props: { icon: 'filter', label: 'Filter', badge: 0 } })

    expect(wrapper.find('.ui-button__badge').exists()).toBe(false)
    expect(wrapper.attributes('aria-pressed')).toBeUndefined()
  })
})
