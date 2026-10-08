import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import { i18n } from '@/lib/i18n'
import AttendanceControl from '../components/AttendanceControl.vue'

const mutate = vi.fn()

vi.mock('../composables/useEvents', () => ({
  useSetAttendance: () => ({ mutate, isPending: ref(false), isError: ref(false) }),
}))

const future = () => new Date(Date.now() + 86_400_000).toISOString()
const past = () => new Date(Date.now() - 60_000).toISOString()

function mountControl(props: Record<string, unknown> = {}) {
  return mount(AttendanceControl, {
    props: {
      event: { id: 'e1', is_cancelled: false, response_deadline: null, starts_at: future() },
      memberId: 'm1',
      attendance: null,
      ...props,
    },
    global: { plugins: [i18n], stubs: { teleport: true } },
  })
}

const button = (wrapper: ReturnType<typeof mountControl>, text: string) =>
  wrapper.findAll('.attendance__button').find((b) => b.text().includes(text))!

describe('AttendanceControl', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'de'
    mutate.mockReset()
  })

  it('answers yes with one tap', async () => {
    const wrapper = mountControl()
    await button(wrapper, 'Zusage').trigger('click')

    expect(mutate).toHaveBeenCalledWith({ eventId: 'e1', memberId: 'm1', status: 'yes' })
  })

  it('marks the current answer with icon and pressed state (not only color)', () => {
    const wrapper = mountControl({
      attendance: { status: 'maybe', reason: null, reason_note: null },
    })
    const maybe = button(wrapper, 'Vielleicht')

    expect(maybe.attributes('aria-pressed')).toBe('true')
    expect(maybe.text()).toContain('?')
  })

  it('asks for an optional reason when declining', async () => {
    const wrapper = mountControl()
    await button(wrapper, 'Absage').trigger('click')

    expect(mutate).not.toHaveBeenCalled()
    const sick = wrapper.findAll('.chip-group__chip').find((c) => c.text().includes('Krank'))!
    await sick.trigger('click')
    await wrapper.find('.base-modal input').setValue('Fieber')
    const confirm = wrapper.findAll('.base-modal__footer button').at(-1)!
    await confirm.trigger('click')

    expect(mutate).toHaveBeenCalledWith({
      eventId: 'e1',
      memberId: 'm1',
      status: 'no',
      reason: 'sick',
      reasonNote: 'Fieber',
    })
  })

  it('locks players after the deadline but not coaches', () => {
    const event = { id: 'e1', is_cancelled: false, response_deadline: past(), starts_at: future() }

    const player = mountControl({ event })
    expect(button(player, 'Zusage').attributes('disabled')).toBeDefined()
    expect(player.text()).toContain('Anmeldeschluss vorbei')

    const coach = mountControl({ event, asCoach: true })
    expect(button(coach, 'Zusage').attributes('disabled')).toBeUndefined()
  })
})
