import { describe, expect, it } from 'vitest'
import de from '@/locales/de.json'
import en from '@/locales/en.json'
import { detectLocale } from '../i18n'

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null
      ? keys(value as object, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  )
}

describe('i18n', () => {
  it('picks the first supported browser language', () => {
    expect(detectLocale(['fr-FR', 'en-US', 'de'])).toBe('en')
    expect(detectLocale(['de-AT'])).toBe('de')
  })

  it('falls back to German', () => {
    expect(detectLocale(['fr', 'it'])).toBe('de')
    expect(detectLocale([])).toBe('de')
  })

  it('has the same keys in de and en', () => {
    expect(keys(en).sort()).toEqual(keys(de).sort())
  })
})
