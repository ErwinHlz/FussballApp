import { supabase } from './supabase'
import { accentTheme } from './color'

export const LOGO_BUCKET = 'club-logos'
const STYLE_ID = 'club-theme'
const DEFAULT_THEME_COLOR = '#15803d'

/** Public URL of a club logo (the bucket is public, paths change with every upload). */
export function clubLogoUrl(path: string): string {
  return supabase.storage.from(LOGO_BUCKET).getPublicUrl(path).data.publicUrl
}

/**
 * CSS that replaces the primary color family in light and dark mode. Meaning colors (training,
 * match, yes/no) stay as they are.
 */
export function clubThemeCss(accent: string): string {
  const { light, dark } = accentTheme(accent)
  // :root:root beats the base tokens regardless of stylesheet order.
  return [
    `:root:root{--color-primary:${light.primary};--color-primary-hover:${light.hover};--color-primary-contrast:${light.contrast}}`,
    `@media (prefers-color-scheme: dark){:root:root{--color-primary:${dark.primary};--color-primary-hover:${dark.hover};--color-primary-contrast:${dark.contrast}}}`,
  ].join('\n')
}

/** Themes the app with the club color, or restores the default green for null. */
export function applyClubTheme(accent: string | null) {
  let style = document.getElementById(STYLE_ID)
  if (!accent) {
    style?.remove()
  } else {
    if (!style) {
      style = document.createElement('style')
      style.id = STYLE_ID
      document.head.append(style)
    }
    style.textContent = clubThemeCss(accent)
  }
  const meta = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"][media="(prefers-color-scheme: light)"]',
  )
  if (meta) meta.content = accent ? accentTheme(accent).light.primary : DEFAULT_THEME_COLOR
}
