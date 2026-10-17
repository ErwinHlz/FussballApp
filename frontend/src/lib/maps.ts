/**
 * Link that shows a place (address or name) in a map app. iPhones and iPads open Apple Maps,
 * everything else Google Maps (on Android the Maps app, on computers the website). Plain text
 * search: no API key, no costs.
 */
export function mapsUrl(place: string, userAgent = globalThis.navigator?.userAgent ?? ''): string {
  const query = encodeURIComponent(place.trim())
  // iPadOS reports itself as a Mac; touch support tells them apart.
  const isApple =
    /iPhone|iPad|iPod/.test(userAgent) ||
    (/Macintosh/.test(userAgent) && (globalThis.navigator?.maxTouchPoints ?? 0) > 1)
  return isApple
    ? `https://maps.apple.com/?q=${query}`
    : `https://www.google.com/maps/search/?api=1&query=${query}`
}
