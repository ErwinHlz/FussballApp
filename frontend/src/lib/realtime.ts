import { onScopeDispose, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { useQueryClient, type QueryKey } from '@tanstack/vue-query'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './supabase'

let channelCounter = 0

/**
 * Invalidates a query whenever rows of the given tables change (Supabase Realtime).
 * RLS applies to subscriptions, so users only receive changes they may read.
 */
export function useRealtimeInvalidate(
  tables: { table: string; filter?: MaybeRefOrGetter<string | undefined> }[],
  queryKey: MaybeRefOrGetter<QueryKey>,
  enabled: MaybeRefOrGetter<boolean> = true,
) {
  const queryClient = useQueryClient()
  let channel: RealtimeChannel | null = null

  function unsubscribe() {
    if (channel) void supabase.removeChannel(channel)
    channel = null
  }

  watch(
    () => [toValue(enabled), ...tables.map((t) => toValue(t.filter))],
    () => {
      unsubscribe()
      if (!toValue(enabled)) return
      channel = supabase.channel(`invalidate-${++channelCounter}`)
      for (const { table, filter } of tables) {
        channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table, filter: toValue(filter) },
          () => void queryClient.invalidateQueries({ queryKey: toValue(queryKey) }),
        )
      }
      channel.subscribe()
    },
    { immediate: true },
  )

  onScopeDispose(unsubscribe)
}
