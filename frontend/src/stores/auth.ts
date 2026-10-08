import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export const useAuthStore = defineStore('auth', () => {
  const session = shallowRef<Session | null>(null)
  const ready = ref(false)
  let initPromise: Promise<void> | null = null

  const user = computed(() => session.value?.user ?? null)
  const userId = computed(() => user.value?.id ?? null)
  const isAuthenticated = computed(() => !!session.value)

  /** Loads the current session once (also picks up magic-link tokens from the URL). */
  function init(): Promise<void> {
    initPromise ??= (async () => {
      const { data } = await supabase.auth.getSession()
      session.value = data.session
      supabase.auth.onAuthStateChange((_event, newSession) => {
        session.value = newSession
      })
      ready.value = true
    })()
    return initPromise
  }

  return { session, user, userId, isAuthenticated, ready, init }
})
