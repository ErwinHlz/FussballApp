import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy frontend/.env.example to frontend/.env.local.',
  )
}

/**
 * In development a local Supabase is reached through the dev server (`/supabase`, see
 * vite.config.ts), so a phone in the same network or a tunnel works without another
 * .env.local: 127.0.0.1 would point to the phone itself.
 */
function apiUrl(configured: string): string {
  if (!import.meta.env.DEV || typeof window === 'undefined') return configured
  const { hostname } = new URL(configured)
  if (hostname !== '127.0.0.1' && hostname !== 'localhost') return configured
  return `${window.location.origin}/supabase`
}

export const supabase = createClient<Database>(apiUrl(url), anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
