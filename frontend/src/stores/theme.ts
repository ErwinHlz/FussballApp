import { watchEffect } from 'vue'
import { defineStore } from 'pinia'
import { useLocalStorage } from '@vueuse/core'

export type ThemePreference = 'auto' | 'light' | 'dark'

/** Browser status bar colors (match --color-bg in styles/_tokens.scss). */
const STATUS_BAR = { light: '#f3f5f0', dark: '#0f1412' } as const

/**
 * Light/dark appearance per device. "auto" follows the OS setting; a fixed choice sets
 * data-theme on <html>, which the tokens and the club theme respect.
 */
export const useThemeStore = defineStore('theme', () => {
  const preference = useLocalStorage<ThemePreference>('rondo.theme', 'auto')

  watchEffect(() => {
    const root = document.documentElement
    if (preference.value === 'auto') root.removeAttribute('data-theme')
    else root.dataset.theme = preference.value
    // Both media-specific metas get the forced color, or their own color again on "auto".
    for (const scheme of ['light', 'dark'] as const) {
      const meta = document.querySelector<HTMLMetaElement>(
        `meta[name="theme-color"][media="(prefers-color-scheme: ${scheme})"]`,
      )
      if (meta) meta.content = STATUS_BAR[preference.value === 'auto' ? scheme : preference.value]
    }
  })

  function setPreference(value: ThemePreference) {
    preference.value = value
  }

  return { preference, setPreference }
})
