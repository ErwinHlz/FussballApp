import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { i18n } from '@/lib/i18n'
import { member } from '@/features/squad/__tests__/squad.spec'
import type { TeamEvent } from '@/features/events/logic'
import MatchSquadList from '../components/MatchSquadList.vue'

const members = [
  member({ id: 'a', display_name: 'Lena', shirt_number: 10 }),
  member({ id: 'b', display_name: 'Ben', shirt_number: 7 }),
  member({ id: 'c', display_name: 'Mia', shirt_number: 3 }),
]

function mountList(attendances: unknown[], myMemberId: string | null = null) {
  return mount(MatchSquadList, {
    props: { event: { attendances } as TeamEvent, members, myMemberId },
    global: { plugins: [i18n] },
  })
}

describe('MatchSquadList', () => {
  it('lists everyone who said yes with the shirt number, no roles', () => {
    i18n.global.locale.value = 'de'
    const wrapper = mountList(
      [
        { member_id: 'a', status: 'yes' },
        { member_id: 'b', status: 'yes' },
        { member_id: 'c', status: 'maybe' },
      ],
      'a',
    )
    expect(wrapper.get('h2').text()).toBe('Kader (2)')
    const rows = wrapper.findAll('.match-squad__player')
    expect(rows.map((r) => r.text())).toEqual(['7Ben', '10Lena'])
    expect(rows[1]!.classes()).toContain('match-squad__player--me')
    expect(wrapper.text()).not.toMatch(/Startelf|Bank|Reserve/)
  })

  it('says so when nobody said yes yet', () => {
    expect(mountList([]).text()).toContain('Noch keine Zusagen.')
  })
})
