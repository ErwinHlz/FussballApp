import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseChipGroup from '../BaseChipGroup.vue'

const options = [
  { value: 'a', label: 'A' },
  { value: 'b', label: 'B' },
]

function mountGroup(modelValue: string | string[], multiple = false) {
  const wrapper = mount(BaseChipGroup, {
    props: {
      label: 'Pick',
      options,
      multiple,
      modelValue,
      'onUpdate:modelValue': (value: unknown) => wrapper.setProps({ modelValue: value as string }),
    },
  })
  return wrapper
}

describe('BaseChipGroup', () => {
  it('selects a single value and marks it as pressed', async () => {
    const wrapper = mountGroup('a')
    const [a, b] = wrapper.findAll('button')

    expect(a!.attributes('aria-pressed')).toBe('true')
    await b!.trigger('click')
    expect(wrapper.props('modelValue')).toBe('b')
  })

  it('toggles values in multi-select mode', async () => {
    const wrapper = mountGroup(['a'], true)
    const [a, b] = wrapper.findAll('button')

    await b!.trigger('click')
    expect(wrapper.props('modelValue')).toEqual(['a', 'b'])
    await a!.trigger('click')
    expect(wrapper.props('modelValue')).toEqual(['b'])
  })

  it('labels the group for screen readers', () => {
    const wrapper = mountGroup('a')
    const group = wrapper.get('[role="group"]')
    expect(wrapper.get(`#${group.attributes('aria-labelledby')}`).text()).toBe('Pick')
  })
})
