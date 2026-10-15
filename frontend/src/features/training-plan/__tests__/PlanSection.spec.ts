import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import { computed, ref, toValue } from 'vue'
import { i18n } from '@/lib/i18n'
import type { TeamEvent } from '@/features/events/logic'
import PlanSection from '../components/PlanSection.vue'
import type { PlanItem } from '../logic'

const planData = ref<PlanItem[] | undefined>(undefined)
const queryEnabled = ref<boolean | null>(null)

vi.mock('../composables/usePlan', () => ({
  usePlan: (_id: unknown, enabled: () => boolean) => {
    const isEnabled = computed(() => toValue(enabled))
    queryEnabled.value = isEnabled.value
    return {
      data: computed(() => (isEnabled.value ? planData.value : undefined)),
      isSuccess: computed(() => isEnabled.value && !!planData.value),
    }
  },
}))

function event(planStatus: 'draft' | 'published'): TeamEvent {
  return {
    id: 'e1',
    plan_status: planStatus,
    plan_published_at: planStatus === 'published' ? '2030-01-01T10:00:00Z' : null,
    attendances: [],
  } as unknown as TeamEvent
}

function item(id: string, title: string, minutes: number): PlanItem {
  return {
    id,
    event_id: 'e1',
    drill_id: id,
    position: 1,
    duration_min: null,
    coach_notes: null,
    created_at: '',
    drill: { id, title, category: 'passing', duration_min: minutes, team_id: null },
  }
}

function mountSection(planStatus: 'draft' | 'published', isCoach: boolean) {
  return mount(PlanSection, {
    props: { event: event(planStatus), isCoach, members: [], myMemberId: 'me' },
    global: { plugins: [i18n], stubs: { RouterLink: RouterLinkStub } },
  })
}

describe('PlanSection', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'de'
    planData.value = [item('a', 'Aufwärmen', 10), item('b', 'Rondo', 20)]
  })

  it('hides draft plans from players and does not even query them', () => {
    const wrapper = mountSection('draft', false)

    expect(wrapper.text()).toBe('')
    expect(queryEnabled.value).toBe(false)
  })

  it('never offers editing to players', () => {
    const wrapper = mountSection('published', false)

    expect(wrapper.text()).toContain('Rondo')
    expect(wrapper.text()).not.toContain('Plan bearbeiten')
  })

  it('shows coaches the draft with status and edit link', () => {
    const wrapper = mountSection('draft', true)

    expect(wrapper.text()).toContain('Entwurf')
    expect(wrapper.text()).toContain('Plan bearbeiten')
  })
})
