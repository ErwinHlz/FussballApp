<script setup lang="ts" generic="T extends string">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

/**
 * One column of a UiWheelPicker: an endless drum in both directions. Drag it (touch or mouse),
 * turn the mouse wheel or tap a row; it swings on and snaps to the row in the middle band, which
 * is the value. With the keyboard: arrow keys, Page Up/Down, Home/End.
 */
const props = defineProps<{ label: string; options: { value: T; label: string }[] }>()
const model = defineModel<T>()

const ROW = 40
/** Rows drawn above and below the middle one (the drum shows five). */
const REACH = 3
const TILT = 20

const mod = (i: number, n: number) => ((i % n) + n) % n
const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Position on the endless drum in rows; the option is `position mod options.length`. */
const position = ref(
  Math.max(
    0,
    props.options.findIndex((o) => o.value === model.value),
  ),
)
const current = computed(() => props.options[mod(Math.round(position.value), props.options.length)])

const rows = computed(() => {
  const n = props.options.length
  if (!n) return []
  const base = Math.round(position.value)
  return Array.from({ length: REACH * 2 + 1 }, (_, k) => {
    const i = base - REACH + k
    const offset = i - position.value
    return {
      key: i,
      index: i,
      option: props.options[mod(i, n)]!,
      current: i === base,
      style: {
        transform: `translateY(${offset * ROW}px) rotateX(${-offset * TILT}deg)`,
        opacity: String(Math.max(0, 1 - Math.abs(offset) * 0.32)),
      },
    }
  })
})

// --- Snapping animation ---------------------------------------------------------------------
let frame = 0
function stop() {
  cancelAnimationFrame(frame)
  frame = 0
}

function commit() {
  const option = current.value
  if (option && option.value !== model.value) model.value = option.value
}

function animateTo(target: number) {
  stop()
  const from = position.value
  const distance = Math.abs(target - from)
  if (reducedMotion() || distance < 0.01) {
    position.value = target
    commit()
    return
  }
  const duration = Math.min(700, 180 + distance * 70)
  const start = performance.now()
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / duration)
    position.value = from + (target - from) * (1 - (1 - t) ** 3)
    if (t < 1) frame = requestAnimationFrame(step)
    else {
      frame = 0
      commit()
    }
  }
  frame = requestAnimationFrame(step)
}

/** The row nearest to the current position that shows the given option. */
function nearest(index: number) {
  const n = props.options.length
  const base = Math.round(position.value)
  let delta = mod(index - base, n)
  if (delta > n / 2) delta -= n
  return base + delta
}

// --- Dragging, with a swing at the end ------------------------------------------------------
let drag: { y: number; position: number; moved: boolean; lastY: number; lastTime: number } | null =
  null
let velocity = 0 // rows per millisecond

function onPointerdown(event: PointerEvent) {
  if (event.button !== 0) return
  stop()
  ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
  drag = {
    y: event.clientY,
    position: position.value,
    moved: false,
    lastY: event.clientY,
    lastTime: event.timeStamp,
  }
  velocity = 0
}

function onPointermove(event: PointerEvent) {
  if (!drag) return
  const dy = event.clientY - drag.y
  if (Math.abs(dy) > 4) drag.moved = true
  position.value = drag.position - dy / ROW
  const dt = event.timeStamp - drag.lastTime
  if (dt > 0) velocity = -(event.clientY - drag.lastY) / ROW / dt
  drag.lastY = event.clientY
  drag.lastTime = event.timeStamp
}

function onPointerup(event: PointerEvent) {
  if (!drag) return
  const { moved } = drag
  drag = null
  if (!moved) {
    // A tap: turn to the tapped row.
    const row = (event.target as HTMLElement).closest<HTMLElement>('[data-index]')
    animateTo(row ? Number(row.dataset.index) : Math.round(position.value))
    return
  }
  const swing = Math.max(-8, Math.min(8, velocity * 250))
  animateTo(Math.round(position.value + swing))
}

// --- Mouse wheel and keyboard ---------------------------------------------------------------
let settle: ReturnType<typeof setTimeout> | undefined
function onWheel(event: WheelEvent) {
  stop()
  const pixels = event.deltaMode === 1 ? event.deltaY * ROW : event.deltaY
  position.value += Math.max(-ROW, Math.min(ROW, pixels)) / ROW
  clearTimeout(settle)
  settle = setTimeout(() => animateTo(Math.round(position.value)), 90)
}

const STEPS: Record<string, number> = { ArrowUp: -1, ArrowDown: 1, PageUp: -5, PageDown: 5 }
function onKeydown(event: KeyboardEvent) {
  const base = Math.round(position.value)
  let target: number | undefined
  if (event.key in STEPS) target = base + STEPS[event.key]!
  else if (event.key === 'Home') target = nearest(0)
  else if (event.key === 'End') target = nearest(props.options.length - 1)
  if (target === undefined) return
  event.preventDefault()
  animateTo(target)
}

// Values set from outside (form reset, the other column) turn the drum.
watch([model, () => props.options], () => {
  if (drag || current.value?.value === model.value) return
  const index = props.options.findIndex((o) => o.value === model.value)
  if (index >= 0) animateTo(nearest(index))
})

onBeforeUnmount(() => {
  stop()
  clearTimeout(settle)
})
</script>

<template>
  <div
    class="ui-wheel field__focus"
    role="spinbutton"
    tabindex="0"
    :aria-label="label"
    :aria-valuenow="mod(Math.round(position), options.length)"
    :aria-valuemin="0"
    :aria-valuemax="options.length - 1"
    :aria-valuetext="current?.label"
    @pointerdown="onPointerdown"
    @pointermove="onPointermove"
    @pointerup="onPointerup"
    @pointercancel="onPointerup"
    @wheel.prevent="onWheel"
    @keydown="onKeydown"
  >
    <div class="ui-wheel__drum" aria-hidden="true">
      <span
        v-for="row in rows"
        :key="row.key"
        class="ui-wheel__row"
        :class="{ 'ui-wheel__row--current': row.current }"
        :data-index="row.index"
        :style="row.style"
      >
        {{ row.option.label }}
      </span>
    </div>
  </div>
</template>

<style scoped lang="scss">
$row: 40px;

.ui-wheel {
  position: relative;
  flex: 1;
  min-width: 0;
  height: $row * 5;
  overflow: hidden;
  outline: none;
  mask-image: linear-gradient(transparent, #000 30%, #000 70%, transparent);
  cursor: grab;
  touch-action: none;
  user-select: none;

  &:active {
    cursor: grabbing;
  }

  &__drum {
    position: absolute;
    inset: 0;
    perspective: 420px;
  }

  &__row {
    position: absolute;
    top: $row * 2;
    right: 0;
    left: 0;
    display: grid;
    place-items: center;
    height: $row;
    padding: 0 $space-2;
    color: var(--color-text-muted);
    font-size: $font-md;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    backface-visibility: hidden;
    will-change: transform;

    &--current {
      color: var(--color-text);
      font-size: $font-lg;
      font-weight: 800;
    }
  }
}
</style>
