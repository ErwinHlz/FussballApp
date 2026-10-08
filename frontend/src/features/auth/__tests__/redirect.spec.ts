import { describe, expect, it } from 'vitest'
import { resolveAuthRedirect, safeRedirect } from '../redirect'

describe('safeRedirect', () => {
  it('accepts in-app paths', () => {
    expect(safeRedirect('/profile')).toBe('/profile')
    expect(safeRedirect('/join/abc?x=1')).toBe('/join/abc?x=1')
  })

  it('rejects external or malformed targets', () => {
    expect(safeRedirect('https://evil.example')).toBe('/events')
    expect(safeRedirect('//evil.example')).toBe('/events')
    expect(safeRedirect('/\\evil.example')).toBe('/events')
    expect(safeRedirect('profile')).toBe('/events')
    expect(safeRedirect(undefined)).toBe('/events')
    expect(safeRedirect(null)).toBe('/events')
  })

  it('does not loop back to the login page', () => {
    expect(safeRedirect('/login')).toBe('/events')
    expect(safeRedirect('/login?redirect=/x')).toBe('/events')
  })

  it('uses the first value of an array', () => {
    expect(safeRedirect(['/squad', '/profile'])).toBe('/squad')
  })
})

describe('resolveAuthRedirect', () => {
  const protectedRoute = { meta: { requiresAuth: true }, fullPath: '/profile', query: {} }
  const loginRoute = {
    meta: { guestOnly: true },
    fullPath: '/login',
    query: { redirect: '/squad' },
  }

  it('sends guests from protected pages to login with a redirect', () => {
    expect(resolveAuthRedirect(protectedRoute, false)).toEqual({
      name: 'login',
      query: { redirect: '/profile' },
    })
  })

  it('lets signed-in users through', () => {
    expect(resolveAuthRedirect(protectedRoute, true)).toBe(true)
  })

  it('sends signed-in users away from the login page', () => {
    expect(resolveAuthRedirect(loginRoute, true)).toBe('/squad')
    expect(resolveAuthRedirect(loginRoute, false)).toBe(true)
  })
})
