import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { i18n } from '@/lib/i18n'
import AnswerControl from '../AnswerControl.vue'
import UiSegmented from '../UiSegmented.vue'
import UiStepper from '../UiStepper.vue'
import WeekStrip, { type WeekDay } from '../WeekStrip.vue'

const global = { plugins: [i18n] }

describe('AnswerControl', () => {
  it('shows one big "I am in" button and only reports taps', async () => {
    i18n.global.locale.value = 'de'
    const wrapper = mount(AnswerControl, { props: { status: null }, global })
    const [main, maybe, no] = wrapper.findAll('button')

    expect(wrapper.get('[role="group"]').attributes('aria-label')).toBe('Bist du dabei?')
    expect(main!.text()).toBe('Ich bin dabei')
    expect(main!.attributes('aria-pressed')).toBe('false')
    await no!.trigger('click')
    await maybe!.trigger('click')
    expect(wrapper.emitted('answer')).toEqual([['no'], ['maybe']])
  })

  it('confirms a yes and marks other answers as pressed', async () => {
    const wrapper = mount(AnswerControl, { props: { status: 'yes' }, global })
    expect(wrapper.findAll('button')[0]!.text()).toBe('Du bist dabei')
    expect(wrapper.findAll('button')[0]!.attributes('aria-pressed')).toBe('true')

    await wrapper.setProps({ status: 'no' })
    expect(wrapper.findAll('button')[2]!.attributes('aria-pressed')).toBe('true')
  })

  it('labels the icon-only compact buttons', () => {
    const wrapper = mount(AnswerControl, {
      props: { status: 'maybe', variant: 'compact' },
      global,
    })
    const labels = wrapper.findAll('button').map((b) => b.attributes('aria-label'))
    expect(labels).toEqual(['Zusage', 'Vielleicht', 'Absage'])
    expect(wrapper.findAll('button')[1]!.attributes('aria-pressed')).toBe('true')
  })
})

describe('UiSegmented', () => {
  const options = [
    { value: 'plan', label: 'Plan' },
    { value: 'groups', label: 'Gruppen' },
    { value: 'who', label: 'Wer kommt' },
  ]

  function mountSegmented() {
    const wrapper = mount(UiSegmented, {
      attachTo: document.body,
      props: {
        label: 'Bereiche',
        options,
        modelValue: 'plan',
        'onUpdate:modelValue': (value: string) => wrapper.setProps({ modelValue: value }),
      },
    })
    return wrapper
  }

  it('is a tab list with only the selected tab in the tab order', () => {
    const wrapper = mountSegmented()
    const tabs = wrapper.findAll('[role="tab"]')
    expect(wrapper.get('[role="tablist"]').attributes('aria-label')).toBe('Bereiche')
    expect(tabs.map((t) => t.attributes('tabindex'))).toEqual(['0', '-1', '-1'])
    expect(tabs[0]!.attributes('aria-selected')).toBe('true')
    wrapper.unmount()
  })

  it('moves with arrow keys, wraps around and supports Home/End', async () => {
    const wrapper = mountSegmented()
    const tabs = () => wrapper.findAll('[role="tab"]')

    await tabs()[0]!.trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.props('modelValue')).toBe('groups')
    await tabs()[1]!.trigger('keydown', { key: 'End' })
    expect(wrapper.props('modelValue')).toBe('who')
    await tabs()[2]!.trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.props('modelValue')).toBe('plan')
    await tabs()[0]!.trigger('keydown', { key: 'ArrowLeft' })
    expect(wrapper.props('modelValue')).toBe('who')
    wrapper.unmount()
  })
})

describe('UiSegmented as radio group', () => {
  it('marks the choice with aria-checked and keeps arrow-key navigation', async () => {
    const wrapper = mount(UiSegmented, {
      props: {
        label: 'Darstellung',
        as: 'radio' as const,
        options: [
          { value: 'auto', label: 'Automatisch' },
          { value: 'dark', label: 'Dunkel' },
        ],
        modelValue: 'auto',
        'onUpdate:modelValue': (value: string) => wrapper.setProps({ modelValue: value }),
      },
    })
    expect(wrapper.get('[role="radiogroup"]').attributes('aria-label')).toBe('Darstellung')
    const radios = wrapper.findAll('[role="radio"]')
    expect(radios.map((r) => r.attributes('aria-checked'))).toEqual(['true', 'false'])
    expect(radios[0]!.attributes('aria-selected')).toBeUndefined()

    await radios[0]!.trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.props('modelValue')).toBe('dark')
  })
})

describe('UiStepper', () => {
  it('changes in steps, stays within bounds and names the value', async () => {
    i18n.global.locale.value = 'de'
    const wrapper = mount(UiStepper, {
      props: {
        label: 'Dauer Rondo',
        modelValue: 10,
        min: 5,
        max: 15,
        'onUpdate:modelValue': (value: number) => wrapper.setProps({ modelValue: value }),
      },
      global,
    })
    const [less, more] = wrapper.findAll('button')

    expect(wrapper.get('[role="group"]').attributes('aria-label')).toBe('Dauer Rondo: 10 Minuten')
    expect(less!.attributes('aria-label')).toBe('5 Minuten weniger')
    await more!.trigger('click')
    expect(wrapper.props('modelValue')).toBe(15)
    expect(more!.attributes('disabled')).toBeDefined()
    await less!.trigger('click')
    await less!.trigger('click')
    expect(wrapper.props('modelValue')).toBe(5)
    expect(less!.attributes('disabled')).toBeDefined()
  })
})

describe('WeekStrip', () => {
  it('describes each day with its events and selects a day', async () => {
    i18n.global.locale.value = 'de'
    const wrapper = mount(WeekStrip, {
      props: {
        label: 'Diese Woche',
        today: '2026-10-15',
        days: [
          { date: '2026-10-15', marks: [] },
          { date: '2026-10-16', marks: ['training'] },
          { date: '2026-10-18', marks: ['match', 'match'] },
        ] satisfies WeekDay[],
        modelValue: null,
        'onUpdate:modelValue': (value: string | null) => wrapper.setProps({ modelValue: value }),
      },
      global,
    })
    const days = wrapper.findAll('button')

    // Accessible name: the visible day number with hidden context (aria-hidden parts skipped).
    const name = (i: number) =>
      days[i]!.findAll(':scope > span:not([aria-hidden])')
        .map((s) => s.text())
        .join('')
    expect(name(0)).toBe('Donnerstag,15. Oktober, heute')
    expect(name(1)).toBe('Freitag,16. Oktober, Training')
    expect(name(2)).toBe('Sonntag,18. Oktober, Spiel')
    await days[1]!.trigger('click')
    expect(wrapper.props('modelValue')).toBe('2026-10-16')
    expect(days[1]!.attributes('aria-pressed')).toBe('true')
  })
})
