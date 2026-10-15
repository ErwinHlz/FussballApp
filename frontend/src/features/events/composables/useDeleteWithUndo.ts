import { useI18n } from 'vue-i18n'
import { useQueryClient } from '@tanstack/vue-query'
import { useSnackbar } from '@/ui/useSnackbar'
import { deleteEvent } from '../api'
import type { TeamEvent } from '../logic'
import { eventKeys } from './useEvents'

/** How long "Undo" is offered before the event is really deleted. */
export const DELETE_DELAY_MS = 7000

/**
 * Deleting an event cannot be reverted in the database (answers go with it), so it is delayed:
 * the event disappears at once, the snackbar offers "Undo", and only afterwards it is deleted.
 * If the app is closed in between, the event simply stays (the safe direction).
 */
export function useDeleteWithUndo() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const snackbar = useSnackbar()

  function remove(eventId: string, label: string) {
    const snapshot = queryClient.getQueriesData<TeamEvent[] | TeamEvent>({
      queryKey: eventKeys.all,
    })
    queryClient.setQueriesData<TeamEvent[] | TeamEvent>({ queryKey: eventKeys.all }, (data) =>
      Array.isArray(data) ? data.filter((e) => e.id !== eventId) : data,
    )
    const restore = () => {
      for (const [key, data] of snapshot) queryClient.setQueryData(key, data)
    }

    let undone = false
    const timer = setTimeout(async () => {
      if (undone) return
      try {
        await deleteEvent(eventId)
      } catch {
        restore()
        snackbar.show({ text: t('events.deleteFailed'), tone: 'error' })
      } finally {
        void queryClient.invalidateQueries({ queryKey: eventKeys.all })
      }
    }, DELETE_DELAY_MS)

    snackbar.show(
      {
        text: t('events.deleted', { title: label }),
        action: {
          label: t('ui.undo'),
          run: () => {
            undone = true
            clearTimeout(timer)
            restore()
          },
        },
      },
      DELETE_DELAY_MS,
    )
  }

  return { remove }
}
