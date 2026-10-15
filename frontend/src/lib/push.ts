import { supabase } from './supabase'

/** Web push in the browser (installed web app). Server side: Edge Function push-dispatch. */

export type PushState =
  | 'unsupported' // browser without push (e.g. iOS Safari outside the installed app)
  | 'unconfigured' // no VAPID key configured for this deployment
  | 'denied' // the user blocked notifications in the browser settings
  | 'off'
  | 'on'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/** iPhones only allow push for apps added to the home screen. */
export function isIosWithoutInstall(): boolean {
  if (typeof navigator === 'undefined') return false
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches
  return ios && !standalone
}

/** VAPID public key (base64url) -> bytes for pushManager.subscribe. */
export function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = (value + '='.repeat((4 - (value.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const raw = atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

export function registerServiceWorker(): Promise<ServiceWorkerRegistration | undefined> {
  if (!('serviceWorker' in navigator)) return Promise.resolve(undefined)
  return navigator.serviceWorker.register('/sw.js').catch(() => undefined)
}

export async function getPushState(): Promise<PushState> {
  if (!isPushSupported()) return 'unsupported'
  if (!VAPID_PUBLIC_KEY) return 'unconfigured'
  if (Notification.permission === 'denied') return 'denied'
  try {
    const subscription = await withTimeout(
      navigator.serviceWorker
        .getRegistration()
        .then((registration) => registration?.pushManager.getSubscription()),
      PUSH_SERVICE_TIMEOUT_MS,
    )
    return subscription ? 'on' : 'off'
  } catch {
    // The API exists but no push service answers: Firefox with push disabled rejects
    // with an AbortError or never settles.
    return 'unsupported'
  }
}

const PUSH_SERVICE_TIMEOUT_MS = 5000

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms)
    promise.then(resolve, reject).finally(() => clearTimeout(timer))
  })
}

export async function enablePush(locale: string): Promise<PushState> {
  if (!isPushSupported()) return 'unsupported'
  if (!VAPID_PUBLIC_KEY) return 'unconfigured'
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off'

  const registration = (await registerServiceWorker()) ?? (await navigator.serviceWorker.ready)
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY),
    }))
  const json = subscription.toJSON()
  const { error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: subscription.endpoint,
    p_p256dh: json.keys?.p256dh ?? '',
    p_auth: json.keys?.auth ?? '',
    p_locale: locale.startsWith('en') ? 'en' : 'de',
    p_user_agent: navigator.userAgent.slice(0, 300),
  })
  if (error) throw error
  return 'on'
}

export async function disablePush(): Promise<PushState> {
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  if (subscription) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
    await subscription.unsubscribe()
  }
  return 'off'
}

/** Queues a test notification for the own devices and triggers sending right away. */
export async function sendTestPush(): Promise<void> {
  const { error } = await supabase.rpc('request_test_push')
  if (error) throw error
  const { error: invokeError } = await supabase.functions.invoke('push-dispatch', { body: {} })
  if (invokeError) throw invokeError
}
