import type { LocationQueryValue, RouteLocationNormalized, RouteLocationRaw } from 'vue-router'

export const DEFAULT_AUTHENTICATED_PATH = '/events'

const AUTH_PAGES = ['/login', '/register', '/forgot-password', '/reset-password']

/**
 * Only allow same-origin, absolute app paths as post-login redirect targets
 * (prevents open redirects like `//evil.com` or `https://evil.com`).
 */
export function safeRedirect(
  value: LocationQueryValue | LocationQueryValue[] | undefined,
  fallback = DEFAULT_AUTHENTICATED_PATH,
): string {
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw !== 'string') return fallback
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return fallback
  const pathname = raw.split(/[?#]/)[0]
  if (AUTH_PAGES.includes(pathname!)) return fallback
  return raw
}

/** Decides where a navigation must go based on auth state. `true` means: allow. */
export function resolveAuthRedirect(
  to: Pick<RouteLocationNormalized, 'meta' | 'fullPath' | 'query'>,
  isAuthenticated: boolean,
): true | RouteLocationRaw {
  if (to.meta.requiresAuth && !isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.meta.guestOnly && isAuthenticated) {
    return safeRedirect(to.query.redirect)
  }
  return true
}
