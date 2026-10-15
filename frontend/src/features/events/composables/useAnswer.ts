import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSnackbar } from '@/ui/useSnackbar'
import type { Attendance, AttendanceStatus, DeclineReason, EventRow } from '../logic'
import { useSetAttendance } from './useEvents'

export type DeclineRequest = {
  event: Pick<EventRow, 'id'>
  memberId: string
  previous: Attendance | null
  /** Shown in the sheet, e.g. "Training · Fr 16.10." */
  label: string
}

/**
 * The answer flow shared by start page, list and detail: yes/maybe save right away, "no"
 * opens the decline sheet (reason with one tap). A decline can be undone from the snackbar,
 * which restores the previous answer (players cannot delete an answer, so a first decline
 * has nothing to go back to).
 */
export function useAnswer() {
  const { t } = useI18n()
  const snackbar = useSnackbar()
  const setAttendance = useSetAttendance()
  const declining = ref<DeclineRequest | null>(null)

  function failed() {
    snackbar.show({ text: t('events.answerFailed'), tone: 'error' })
  }

  function save(
    eventId: string,
    memberId: string,
    status: AttendanceStatus,
    reason: DeclineReason | null = null,
    reasonNote: string | null = null,
  ) {
    return setAttendance.mutateAsync({ eventId, memberId, status, reason, reasonNote })
  }

  /** Tap on an answer button. */
  function answer(
    event: Pick<EventRow, 'id'>,
    memberId: string,
    previous: Attendance | null,
    status: AttendanceStatus,
    label: string,
  ) {
    if (status === 'no') {
      declining.value = { event, memberId, previous, label }
      return
    }
    if (previous?.status === status) return
    navigator.vibrate?.(10)
    save(event.id, memberId, status).catch(failed)
  }

  /** Reason picked in the sheet (null = without reason). */
  async function decline(reason: DeclineReason | null, note: string) {
    const request = declining.value
    if (!request) return
    declining.value = null
    try {
      await save(request.event.id, request.memberId, 'no', reason, note.trim() || null)
    } catch {
      failed()
      return
    }
    navigator.vibrate?.(10)
    const previous = request.previous
    snackbar.show({
      text: t('events.declined'),
      action:
        previous && previous.status !== 'no'
          ? {
              label: t('ui.undo'),
              run: () =>
                save(
                  request.event.id,
                  request.memberId,
                  previous.status,
                  // Stored reasons come from the same list (database check constraint).
                  previous.reason as DeclineReason | null,
                  previous.reason_note,
                ).then(() => undefined, failed),
            }
          : undefined,
    })
  }

  return { answer, decline, declining, isPending: setAttendance.isPending }
}
