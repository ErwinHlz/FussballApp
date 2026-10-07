import { createI18n } from 'vue-i18n'
import de from '@/locales/de.json'
import en from '@/locales/en.json'

export type MessageSchema = typeof de
export const SUPPORTED_LOCALES = ['de', 'en'] as const
export type AppLocale = (typeof SUPPORTED_LOCALES)[number]

export function detectLocale(languages: readonly string[] = navigator.languages): AppLocale {
  for (const lang of languages) {
    const base = lang.toLowerCase().split('-')[0]
    const match = SUPPORTED_LOCALES.find((locale) => locale === base)
    if (match) return match
  }
  return 'de'
}

export const i18n = createI18n<[MessageSchema], AppLocale, false>({
  legacy: false,
  locale: detectLocale(),
  fallbackLocale: 'de',
  messages: { de, en },
})
