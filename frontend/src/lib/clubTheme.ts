import { supabase } from './supabase'
import { accentTheme } from './color'

export const LOGO_BUCKET = 'club-logos'
const STYLE_ID = 'club-theme'

/** Public URL of a club logo (the bucket is public, paths change with every upload). */
export function clubLogoUrl(path: string): string {
  return supabase.storage.from(LOGO_BUCKET).getPublicUrl(path).data.publicUrl
}

/**
 * CSS that replaces the primary color family in light and dark mode. Meaning colors (training,
 * match, yes/no) stay as they are. Dark applies with the OS setting unless the user forced
 * light, and always when the user forced dark (data-theme, see stores/theme.ts).
 */
export function clubThemeCss(accent: string): string {
  const { light, dark } = accentTheme(accent)
  const vars = (c: { primary: string; hover: string; contrast: string }) =>
    `--color-primary:${c.primary};--color-primary-hover:${c.hover};--color-primary-contrast:${c.contrast}`
  // :root:root beats the base tokens regardless of stylesheet order.
  return [
    `:root:root{${vars(light)}}`,
    `@media (prefers-color-scheme: dark){:root:root:not([data-theme='light']){${vars(dark)}}}`,
    `:root:root[data-theme='dark']{${vars(dark)}}`,
  ].join('\n')
}

/** Themes the app with the club color, or restores the default accent for null. */
export function applyClubTheme(accent: string | null) {
  let style = document.getElementById(STYLE_ID)
  if (!accent) {
    style?.remove()
    return
  }
  if (!style) {
    style = document.createElement('style')
    style.id = STYLE_ID
    document.head.append(style)
  }
  style.textContent = clubThemeCss(accent)
}
