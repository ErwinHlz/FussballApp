/**
 * push-dispatch: sends pending web push notifications.
 *
 * Called every minute by pg_cron (private.run_push_cron) with the service key, and by the app
 * right after "send test notification" (user JWT; it only triggers processing).
 * Claims pending outbox messages with their recipients' devices and sends them via Web Push.
 * Devices that no longer exist (404/410) are removed.
 */
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import { buildMessage, type PushRow } from './messages.ts'

type ClaimedRow = PushRow & {
  subscription_id: string
  endpoint: string
  p256dh: string
  auth: string
}

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.test'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return Response.json(
      { error: 'VAPID keys missing (see backend/scripts/setup-push.mjs)' },
      { status: 500, headers: corsHeaders },
    )
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  let sent = 0
  let failed = 0
  let removed = 0

  // Process in batches until the outbox is empty (bounded).
  for (let batch = 0; batch < 10; batch++) {
    const { data, error } = await supabase.rpc('claim_push_messages', { p_limit: 100 })
    if (error) {
      return Response.json({ error: error.message }, { status: 500, headers: corsHeaders })
    }
    const rows = (data ?? []) as ClaimedRow[]
    if (!rows.length) break

    await Promise.all(
      rows.map(async (row) => {
        const message = buildMessage(row)
        try {
          // web-push only encrypts and signs (RFC 8291 / VAPID); sending uses Deno's fetch,
          // which is more robust in the edge runtime than Node's https module.
          const request = webpush.generateRequestDetails(
            { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
            JSON.stringify(message),
            { TTL: 6 * 3600, urgency: row.kind === 'reminder' ? 'high' : 'normal' },
          )
          const headers = { ...request.headers } as Record<string, string>
          delete headers['Content-Length']
          const response = await fetch(request.endpoint, {
            method: request.method,
            headers,
            body: request.body ? new Uint8Array(request.body) : undefined,
          })
          await response.body?.cancel()
          if (response.ok) {
            sent++
          } else if (response.status === 404 || response.status === 410) {
            // The browser unsubscribed or the subscription expired.
            await supabase.from('push_subscriptions').delete().eq('id', row.subscription_id)
            removed++
          } else {
            failed++
            console.error('push failed', response.status)
          }
        } catch (err) {
          failed++
          console.error('push failed', (err as Error).message)
        }
      }),
    )
  }

  return Response.json({ sent, failed, removed }, { headers: corsHeaders })
})
