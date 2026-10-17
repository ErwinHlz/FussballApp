import { describe, expect, it } from 'vitest'
import { mapsUrl } from '../maps'

describe('mapsUrl', () => {
  it('opens Google Maps with the place as search', () => {
    expect(mapsUrl(' Waldstadion, Am Stadtwald 1 ', 'Mozilla/5.0 (Linux; Android 14)')).toBe(
      'https://www.google.com/maps/search/?api=1&query=Waldstadion%2C%20Am%20Stadtwald%201',
    )
  })

  it('opens Apple Maps on iPhones', () => {
    expect(mapsUrl('Sportpark', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe(
      'https://maps.apple.com/?q=Sportpark',
    )
  })
})
