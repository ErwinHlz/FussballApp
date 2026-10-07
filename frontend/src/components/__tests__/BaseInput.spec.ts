import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseInput from '../BaseInput.vue'

describe('BaseInput', () => {
  it('links label and input', () => {
    const wrapper = mount(BaseInput, { props: { label: 'Email' } })
    const input = wrapper.get('input')

    expect(wrapper.get('label').attributes('for')).toBe(input.attributes('id'))
  })

  it('supports v-model', async () => {
    const wrapper = mount(BaseInput, {
      props: {
        label: 'Name',
        modelValue: 'Alex',
        'onUpdate:modelValue': (value: string) => wrapper.setProps({ modelValue: value }),
      },
    })
    const input = wrapper.get('input')

    expect(input.element.value).toBe('Alex')
    await input.setValue('Sam')
    expect(wrapper.props('modelValue')).toBe('Sam')
  })

  it('marks the field invalid and describes the error', () => {
    const wrapper = mount(BaseInput, { props: { label: 'Email', error: 'Required' } })
    const input = wrapper.get('input')
    const error = wrapper.get('[role="alert"]')

    expect(input.attributes('aria-invalid')).toBe('true')
    expect(input.attributes('aria-describedby')).toBe(error.attributes('id'))
  })
})
