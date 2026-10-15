import { readonly, ref } from 'vue'

export type SnackbarMessage = {
  id: number
  text: string
  /** Optional action, typically "Undo". Runs once; the message closes afterwards. */
  action?: { label: string; run: () => void | Promise<void> }
  tone?: 'neutral' | 'error'
}

const DEFAULT_DURATION = 5000
const current = ref<SnackbarMessage | null>(null)
let timer: ReturnType<typeof setTimeout> | null = null
let nextId = 1

function dismiss(id?: number) {
  if (id !== undefined && current.value?.id !== id) return
  if (timer) clearTimeout(timer)
  timer = null
  current.value = null
}

/**
 * One short message at a time above the navigation, e.g. "Abgesagt · Rückgängig". A new
 * message replaces the old one. Shown by <SnackbarHost> in the app layout.
 */
function show(message: Omit<SnackbarMessage, 'id'>, duration = DEFAULT_DURATION): number {
  if (timer) clearTimeout(timer)
  const id = nextId++
  current.value = { ...message, id }
  // Messages with an action stay a bit longer so there is time to react.
  const visibleFor = message.action ? Math.max(duration, 7000) : duration
  timer = setTimeout(() => dismiss(id), visibleFor)
  return id
}

async function runAction() {
  const message = current.value
  if (!message?.action) return
  dismiss(message.id)
  await message.action.run()
}

export function useSnackbar() {
  return { current: readonly(current), show, dismiss, runAction }
}
