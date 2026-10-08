import { useI18n } from 'vue-i18n'
import { formatDate } from '@/lib/date'
import type { EventRow } from './logic'

/** Display helpers for events, all in the user's local time zone. */
export function useEventFormat() {
  const { t, locale } = useI18n()

  const weekdayShort = (iso: string) => formatDate(iso, locale.value, 'EEEEEE')
  const dayMonth = (iso: string) => formatDate(iso, locale.value, t('events.dayMonthPattern'))
  const longDay = (iso: string) => formatDate(iso, locale.value, 'EEEE, PPP')
  const time = (iso: string) => formatDate(iso, locale.value, 'p')
  const dateTime = (iso: string) => formatDate(iso, locale.value, 'Pp')

  function title(event: Pick<EventRow, 'type' | 'opponent' | 'is_home'>) {
    if (event.type === 'training') return t('events.training')
    return event.is_home === false
      ? t('events.matchAway', { opponent: event.opponent })
      : t('events.matchHome', { opponent: event.opponent })
  }

  function timeRange(event: Pick<EventRow, 'starts_at' | 'ends_at'>) {
    return event.ends_at
      ? `${time(event.starts_at)} – ${time(event.ends_at)}`
      : time(event.starts_at)
  }

  return { weekdayShort, dayMonth, longDay, time, dateTime, title, timeRange }
}
