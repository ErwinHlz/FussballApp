import { format, type Locale } from 'date-fns'
import { de } from 'date-fns/locale/de'
import { enUS } from 'date-fns/locale/en-US'

const locales: Record<string, Locale> = { de, en: enUS }

/** Formats a timestamp in the user's local time zone. */
export function formatDate(value: string | Date, locale: string, pattern = 'PP'): string {
  return format(typeof value === 'string' ? new Date(value) : value, pattern, {
    locale: locales[locale] ?? de,
  })
}
