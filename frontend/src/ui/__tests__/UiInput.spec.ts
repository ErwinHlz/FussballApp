import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { i18n } from '@/lib/i18n'
import UiInput from '../UiInput.vue'

describe('UiInput', () => {
  it('links label and input', () => {
    const wrapper = mount(UiInput, { props: { label: 'Email' }, global: { plugins: [i18n] } })
    const input = wrapper.get('input')

    expect(wrapper.get('label').attributes('for')).toBe(input.attributes('id'))
  })

  it('supports v-model', async () => {
    const wrapper = mount(UiInput, {
      props: {
        label: 'Name',
        modelValue: 'Alex',
        'onUpdate:modelValue': (value: string) => wrapper.setProps({ modelValue: value }),
      },
      global: { plugins: [i18n] },
    })
    const input = wrapper.get('input')

    expect(input.element.value).toBe('Alex')
    await input.setValue('Sam')
    expect(wrapper.props('modelValue')).toBe('Sam')
  })

  it('marks the field invalid and describes the error', () => {
    const wrapper = mount(UiInput, {
      props: { label: 'Email', error: 'Required' },
      global: { plugins: [i18n] },
    })
    const input = wrapper.get('input')
    const error = wrapper.get('[role="alert"]')

    expect(input.attributes('aria-invalid')).toBe('true')
    expect(input.attributes('aria-describedby')).toBe(error.attributes('id'))
  })

  it('offers to show the password and keeps the label as the field name', async () => {
    const wrapper = mount(UiInput, {
      props: { label: 'Passwort', type: 'password', required: true },
      global: { plugins: [i18n] },
    })
    expect(wrapper.get('label').text()).toBe('Passwort')
    const reveal = wrapper.get('button')
    expect(reveal.attributes('aria-pressed')).toBe('false')
    await reveal.trigger('click')
    expect(wrapper.get('input').attributes('type')).toBe('text')
    expect(reveal.attributes('aria-pressed')).toBe('true')
  })
})
