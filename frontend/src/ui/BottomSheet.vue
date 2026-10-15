<script lang="ts">
// Open sheets, innermost last: only the top sheet reacts to Escape and Tab.
const openSheets: symbol[] = []
</script>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import UiIcon from './UiIcon.vue'

/**
 * Dialog that slides up from the bottom, in thumb reach. Keeps the focus inside, closes with
 * Escape, the close button, a tap on the backdrop or a swipe down on the handle, and gives the
 * focus back to where it came from.
 */
const props = defineProps<{ title: string; description?: string }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ closed: [] }>()

const { t } = useI18n()
const id = useId()
const token = Symbol(props.title)
const sheet = ref<HTMLElement | null>(null)
const dragY = ref(0)
let lastFocused: HTMLElement | null = null
let dragStart: { y: number; time: number } | null = null

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function isTop() {
  return openSheets[openSheets.length - 1] === token
}

function close() {
  open.value = false
}

function onKeydown(event: KeyboardEvent) {
  if (!open.value || !isTop()) return
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
    return
  }
  if (event.key !== 'Tab' || !sheet.value) return
  const focusable = [...sheet.value.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  )
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (!first || !last) {
    event.preventDefault()
    return
  }
  const active = document.activeElement
  if (event.shiftKey && (active === first || active === sheet.value)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}

function lockScroll(lock: boolean) {
  document.body.style.overflow = lock ? 'hidden' : ''
}

watch(
  open,
  async (isOpen) => {
    if (isOpen) {
      lastFocused = document.activeElement as HTMLElement | null
      openSheets.push(token)
      lockScroll(true)
      document.addEventListener('keydown', onKeydown)
      await nextTick()
      sheet.value?.focus()
    } else {
      const index = openSheets.indexOf(token)
      if (index === -1) return
      openSheets.splice(index, 1)
      if (openSheets.length === 0) lockScroll(false)
      document.removeEventListener('keydown', onKeydown)
      dragY.value = 0
      if (lastFocused?.isConnected) lastFocused.focus()
      emit('closed')
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (open.value) open.value = false
  const index = openSheets.indexOf(token)
  if (index !== -1) openSheets.splice(index, 1)
  if (openSheets.length === 0) lockScroll(false)
  document.removeEventListener('keydown', onKeydown)
})

// Swipe down on the handle area: follow the finger, close past 96px or on a quick flick.
function onPointerDown(event: PointerEvent) {
  if (event.button !== 0) return
  dragStart = { y: event.clientY, time: event.timeStamp }
  ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
}

function onPointerMove(event: PointerEvent) {
  if (!dragStart) return
  dragY.value = Math.max(0, event.clientY - dragStart.y)
}

function onPointerUp(event: PointerEvent) {
  if (!dragStart) return
  const velocity = dragY.value / Math.max(1, event.timeStamp - dragStart.time)
  dragStart = null
  if (dragY.value > 96 || velocity > 0.6) close()
  else dragY.value = 0
}
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="open" class="sheet" @click.self="close">
        <div
          :id="id"
          ref="sheet"
          class="sheet__panel"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="`${id}-title`"
          :aria-describedby="description ? `${id}-desc` : undefined"
          tabindex="-1"
          :style="dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined"
        >
          <header
            class="sheet__head"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
            @pointercancel="onPointerUp"
          >
            <span class="sheet__handle" aria-hidden="true" />
            <div class="sheet__titles">
              <h2 :id="`${id}-title`" class="sheet__title">{{ title }}</h2>
              <p v-if="description" :id="`${id}-desc`" class="sheet__description">
                {{ description }}
              </p>
            </div>
            <button
              type="button"
              class="sheet__close"
              :aria-label="t('common.close')"
              @pointerdown.stop
              @click="close"
            >
              <UiIcon name="x" :size="22" />
            </button>
          </header>
          <div class="sheet__body"><slot /></div>
          <footer v-if="$slots.footer" class="sheet__footer"><slot name="footer" /></footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
.sheet {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: var(--color-overlay);

  @include from($bp-sm) {
    align-items: center;
    padding: $space-4;
  }

  &__panel {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 560px;
    max-height: 92dvh;
    border-radius: 26px 26px 0 0;
    background: var(--color-bg);
    box-shadow: var(--shadow-lg);
    transition: transform var(--duration-medium) var(--ease-out);

    &:focus {
      outline: none;
    }

    @include from($bp-sm) {
      border-radius: 26px;
    }
  }

  &__head {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: $space-3;
    padding: $space-5 $space-3 $space-2 $space-4;
    touch-action: none;
  }

  &__handle {
    position: absolute;
    top: 8px;
    left: 50%;
    width: 40px;
    height: 5px;
    border-radius: $radius-full;
    background: var(--color-border);
    transform: translateX(-50%);
  }

  &__titles {
    flex: 1;
    min-width: 0;
    padding-top: $space-2;
  }

  &__title {
    font-size: $font-2xl;
  }

  &__description {
    margin-top: $space-1;
    color: var(--color-text-muted);
    font-size: $font-sm;
  }

  &__close {
    @include focus-visible;

    display: grid;
    flex-shrink: 0;
    place-items: center;
    width: $touch-target;
    height: $touch-target;
    border: 0;
    border-radius: 50%;
    background: var(--color-surface);
    color: var(--color-text);
  }

  &__body {
    flex: 1;
    padding: $space-2 $space-4 $space-4;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  &__footer {
    @include safe-area-padding(bottom, $space-4);

    display: flex;
    gap: $space-2;
    padding-top: $space-3;
    padding-inline: $space-4;
    border-top: 1px solid var(--color-border);
    background: var(--color-bar);

    > :deep(*) {
      flex: 1;
    }
  }

  &__body:last-child {
    @include safe-area-padding(bottom, $space-5);
  }
}

.sheet-enter-active,
.sheet-leave-active {
  transition: opacity var(--duration-medium) var(--ease-out);

  .sheet__panel {
    transition: transform var(--duration-medium) var(--ease-out);
  }
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;

  .sheet__panel {
    transform: translateY(100%);
  }
}
</style>
