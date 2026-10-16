import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import { i18n } from '@/lib/i18n'
import { useSnackbar } from '@/ui/useSnackbar'
import type { Attendance } from '../logic'
import { useAnswer } from '../composables/useAnswer'

const mutateAsync = vi.fn()
const withdrawAsync = vi.fn()
vi.mock('../composables/useEvents', () => ({
  useSetAttendance: () => ({ mutateAsync, isPending: ref(false) }),
  useWithdrawAttendance: () => ({ mutateAsync: withdrawAsync }),
}))

function withAnswer() {
  let api!: ReturnType<typeof useAnswer>
  mount(
    defineComponent({
      setup() {
        api = useAnswer()
        return () => null
      },
    }),
    { global: { plugins: [i18n] } },
  )
  return api
}

const previous = { status: 'maybe', reason: null, reason_note: null } as Attendance
const event = { id: 'e1' }

beforeEach(() => {
  i18n.global.locale.value = 'de'
  mutateAsync.mockReset().mockResolvedValue({})
  withdrawAsync.mockReset().mockResolvedValue(undefined)
})
afterEach(() => useSnackbar().dismiss())

describe('useAnswer', () => {
  it('saves yes and maybe right away and skips repeating the same answer', () => {
    const { answer } = withAnswer()
    answer(event, 'm1', null, 'yes', 'Training')
    answer(event, 'm1', { ...previous, status: 'yes' }, 'yes', 'Training')

    expect(mutateAsync).toHaveBeenCalledTimes(1)
    expect(mutateAsync).toHaveBeenCalledWith({
      eventId: 'e1',
      memberId: 'm1',
      status: 'yes',
      reason: null,
      reasonNote: null,
    })
  })

  it('asks for a reason before declining, then saves reason and note', async () => {
    const { answer, decline, declining } = withAnswer()
    answer(event, 'm1', previous, 'no', 'Training · Fr 16.10.')
    expect(mutateAsync).not.toHaveBeenCalled()
    expect(declining.value?.label).toBe('Training · Fr 16.10.')

    await decline('sick', '  Erkältet ')
    expect(declining.value).toBeNull()
    expect(mutateAsync).toHaveBeenCalledWith({
      eventId: 'e1',
      memberId: 'm1',
      status: 'no',
      reason: 'sick',
      reasonNote: 'Erkältet',
    })
  })

  it('offers undo that restores the previous answer', async () => {
    const { answer, decline } = withAnswer()
    answer(event, 'm1', previous, 'no', 'Training')
    await decline(null, '')

    const snackbar = useSnackbar()
    expect(snackbar.current.value?.text).toBe('Abgesagt')
    await snackbar.runAction()
    expect(mutateAsync).toHaveBeenLastCalledWith({
      eventId: 'e1',
      memberId: 'm1',
      status: 'maybe',
      reason: null,
      reasonNote: null,
    })
  })

  it('undoes a first decline back to "no answer yet"', async () => {
    const { answer, decline } = withAnswer()
    answer(event, 'm1', null, 'no', 'Training')
    await decline('work', '')

    const snackbar = useSnackbar()
    expect(snackbar.current.value?.action?.label).toBe('Rückgängig')
    await snackbar.runAction()
    expect(withdrawAsync).toHaveBeenCalledWith({ eventId: 'e1', memberId: 'm1' })
  })

  it('reports a failed save in the snackbar', async () => {
    mutateAsync.mockRejectedValueOnce(new Error('closed'))
    const { answer, decline } = withAnswer()
    answer(event, 'm1', previous, 'no', 'Training')
    await decline('work', '')
    expect(useSnackbar().current.value?.tone).toBe('error')
  })
})
