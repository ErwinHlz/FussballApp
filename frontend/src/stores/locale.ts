import { watch } from 'vue'
import { defineStore } from 'pinia'
import { useLocalStorage } from '@vueuse/core'
import { detectLocale, i18n, type AppLocale } from '@/lib/i18n'

export type LocalePreference = 'auto' | AppLocale

/** App language per device: "auto" follows the browser, otherwise the chosen language. */
export const useLocaleStore = defineStore('locale', () => {
  const preference = useLocalStorage<LocalePreference>('rondo.locale', 'auto')

  // On start, i18n already uses the browser language; only a fixed choice overrides it.
  watch(
    preference,
    (value, previous) => {
      if (value !== 'auto') i18n.global.locale.value = value
      else if (previous !== undefined) i18n.global.locale.value = detectLocale()
    },
    { immediate: true },
  )

  function setPreference(value: LocalePreference) {
    preference.value = value
  }

  return { preference, setPreference }
})
