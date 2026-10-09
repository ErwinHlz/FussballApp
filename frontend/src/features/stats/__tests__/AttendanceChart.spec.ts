import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { i18n } from '@/lib/i18n'
import AttendanceChart from '../components/AttendanceChart.vue'
import type { TrainingPoint } from '../logic'

const point = (day: number, yes: number, players = 10): TrainingPoint => ({
  event_id: `e${day}`,
  starts_at: new Date(2026, 8, day, 18, 30).toISOString(),
  yes_count: yes,
  maybe_count: 0,
  no_count: players - yes,
  players,
})

function mountChart(points: TrainingPoint[]) {
  return mount(AttendanceChart, {
    props: { points, title: 'Beteiligung pro Training' },
    global: { plugins: [i18n] },
  })
}

describe('AttendanceChart', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'de'
  })

  it('draws one column per training with its share as height', () => {
    const wrapper = mountChart([point(1, 8), point(8, 5), point(15, 10)])
    const bars = wrapper.findAll('.chart__bar')

    expect(bars.map((b) => b.attributes('style'))).toEqual([
      'height: 80%;',
      'height: 50%;',
      'height: 100%;',
    ])
  })

  it('labels only the latest column, the rest is in tooltip and table', () => {
    const wrapper = mountChart([point(1, 8), point(8, 5)])
    expect(wrapper.findAll('.chart__value').map((v) => v.text())).toEqual(['50 %'])
  })

  it('describes every column for screen readers and shows a tooltip on focus', async () => {
    const wrapper = mountChart([point(1, 8)])
    const column = wrapper.get('.chart__slot')

    expect(column.attributes('aria-label')).toBe('Di 01.09.: 8 von 10 Spielern (80 %)')
    await column.trigger('focus')
    expect(wrapper.get('.chart__tooltip').text()).toContain('80 %')
  })

  it('offers a table with every value', async () => {
    const wrapper = mountChart([point(1, 8), point(8, 5)])
    await wrapper.get('.chart__toggle').trigger('click')

    const rows = wrapper.findAll('tbody tr').map((r) => r.findAll('td').map((c) => c.text()))
    expect(rows).toEqual([
      ['Di 08.09.', '5 / 10', '50 %'],
      ['Di 01.09.', '8 / 10', '80 %'],
    ])
  })

  it('shows at most 24 columns and says so', () => {
    const wrapper = mountChart(Array.from({ length: 30 }, (_, i) => point(i + 1, 5)))
    expect(wrapper.findAll('.chart__bar')).toHaveLength(24)
    expect(wrapper.text()).toContain('Die letzten 24 Trainings')
  })
})
