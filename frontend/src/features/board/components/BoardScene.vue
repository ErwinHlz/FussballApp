<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { arrowPath, FIELD_SIZE, fromSvg, objectRadius, toSvg } from '../geometry'
import BoardToken from './BoardToken.vue'
import type { Positions } from '../interpolate'
import type { Annotation, BoardObject, FieldType, Point } from '../schema'

/** Renders the field, arrows and objects. Pointer events are reported in field percent. */
const props = withDefaults(
  defineProps<{
    field: FieldType
    objects: BoardObject[]
    positions: Positions
    annotations: Annotation[]
    draftArrow?: Annotation | null
    selectedId?: string | null
    interactive?: boolean
    title: string
    /** Zoomed view (editor): factor >= 1 and the visible center in meters. */
    zoom?: number
    center?: [number, number] | null
  }>(),
  { draftArrow: null, selectedId: null, interactive: false, zoom: 1, center: null },
)

const emit = defineEmits<{
  objectDown: [id: string, point: Point, event: PointerEvent]
  arrowDown: [index: number, event: PointerEvent]
  fieldDown: [point: Point, event: PointerEvent]
  move: [point: Point, event: PointerEvent]
  up: [point: Point, event: PointerEvent]
  objectKey: [id: string, event: KeyboardEvent]
  resizeDown: [id: string, point: Point, event: PointerEvent]
}>()

const { t } = useI18n()
const uid = useId()
const svgRef = ref<SVGSVGElement | null>(null)

const size = computed(() => FIELD_SIZE[props.field])
const r = computed(() => objectRadius(props.field))
/** The whole field with a small margin (meters). */
const base = computed(() => {
  const pad = 2
  return { x: -pad, y: -pad, w: size.value.w + pad * 2, h: size.value.h + pad * 2 }
})
const fullViewBox = computed(
  () => `${base.value.x} ${base.value.y} ${base.value.w} ${base.value.h}`,
)
const viewBox = computed(() => {
  const b = base.value
  if (props.zoom <= 1) return fullViewBox.value
  const w = b.w / props.zoom
  const h = b.h / props.zoom
  const [cx, cy] = props.center ?? [b.x + b.w / 2, b.y + b.h / 2]
  return `${cx - w / 2} ${cy - h / 2} ${w} ${h}`
})
const arrows = computed(() =>
  props.draftArrow ? [...props.annotations, props.draftArrow] : props.annotations,
)

function point(event: PointerEvent): Point {
  const svg = svgRef.value
  // getScreenCTM is missing in non-rendering environments (tests); fall back to the center.
  const matrix = typeof svg?.getScreenCTM === 'function' ? svg.getScreenCTM() : null
  if (!svg || !matrix) return [50, 50]
  const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
  return fromSvg(props.field, p.x, p.y)
}

/**
 * Field percent for a screen point (drops from the palette); points beyond the pitch land on
 * its nearest edge. The caller decides whether the drop counts.
 */
function clientToField(clientX: number, clientY: number): Point | null {
  const svg = svgRef.value
  if (!svg) return null
  const matrix = typeof svg.getScreenCTM === 'function' ? svg.getScreenCTM() : null
  if (!matrix) return [50, 50]
  const p = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse())
  return fromSvg(props.field, p.x, p.y)
}
defineExpose({ clientToField, svg: svgRef, base })

// Zones lie under everything, the ball on top.
const LAYER: Partial<Record<BoardObject['type'], number>> = { zone: 0, text: 3, ball: 4 }
const layered = computed(() =>
  [...props.objects].sort((a, b) => (LAYER[a.type] ?? 2) - (LAYER[b.type] ?? 2)),
)

/** Selection/hit size: zones by their area, everything else by the base radius and size. */
function extent(o: BoardObject): number {
  if (o.type === 'zone') return Math.max(o.w ?? 10, o.h ?? 10) / 2 + r.value * 0.4
  const s = o.scale ?? 1
  if (o.type === 'ladder') return r.value * 3.2 * s
  if (o.type === 'goal') return r.value * 2.4 * s
  return r.value * 1.6 * s
}

/**
 * Resize handle of the selected object, top right (a carried ball sits bottom right): a zone's
 * corner, otherwise on the selection ring.
 */
function handleAt(o: BoardObject): [number, number] {
  // Outside the selection ring, so its touch area never covers the object itself.
  const d = extent(o) + r.value * 0.9
  if (o.type !== 'zone') return [d * 0.71, -d * 0.71]
  const f = o.shape === 'circle' ? 0.71 : 1
  return [((o.w ?? 10) / 2) * f, -((o.h ?? 10) / 2) * f]
}

function pos(id: string): [number, number] | null {
  const p = props.positions[id]
  return p ? toSvg(props.field, p) : null
}

function objectLabel(o: BoardObject) {
  const type = t(`board.objects.${o.type}`)
  return o.label ? `${type} ${o.label}` : type
}

// Pitch markings in meters (portrait): goal lines at top/bottom.
const markings = computed(() => {
  const { w, h } = size.value
  const cx = w / 2
  if (props.field === 'quarter')
    return { cx, centerLine: false, centerCircle: false, topBox: false, bottomBox: false }
  if (props.field === 'half')
    return { cx, centerLine: true, centerAt: h, centerCircle: true, topBox: true, bottomBox: false }
  return {
    cx,
    centerLine: true,
    centerAt: h / 2,
    centerCircle: true,
    topBox: true,
    bottomBox: true,
  }
})
</script>

<template>
  <svg
    ref="svgRef"
    class="board"
    :class="{ 'board--interactive': interactive }"
    :viewBox="viewBox"
    :data-full-viewbox="fullViewBox"
    role="img"
    :aria-label="title"
    preserveAspectRatio="xMidYMid meet"
    @pointerdown.self="emit('fieldDown', point($event), $event)"
    @pointermove="emit('move', point($event), $event)"
    @pointerup="emit('up', point($event), $event)"
    @pointercancel="emit('up', point($event), $event)"
  >
    <defs>
      <marker
        :id="`${uid}-head`"
        viewBox="0 0 10 10"
        refX="8"
        refY="5"
        markerWidth="4"
        markerHeight="4"
        orient="auto-start-reverse"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
      </marker>
    </defs>

    <!-- Field -->
    <g class="board__field" pointer-events="none">
      <rect :x="-2" :y="-2" :width="size.w + 4" :height="size.h + 4" class="board__grass" />
      <rect
        v-for="i in Math.ceil(size.h / 7)"
        :key="i"
        :x="0"
        :y="(i - 1) * 7"
        :width="size.w"
        :height="Math.min(3.5, size.h - (i - 1) * 7)"
        class="board__stripe"
      />
      <rect :x="0" :y="0" :width="size.w" :height="size.h" class="board__line" />
      <template v-if="markings.centerLine">
        <line
          :x1="0"
          :x2="size.w"
          :y1="markings.centerAt"
          :y2="markings.centerAt"
          class="board__line"
        />
        <circle
          v-if="markings.centerCircle"
          :cx="markings.cx"
          :cy="markings.centerAt"
          r="9.15"
          class="board__line"
        />
      </template>
      <template v-if="markings.topBox">
        <rect :x="markings.cx - 20.16" :y="0" width="40.32" height="16.5" class="board__line" />
        <rect :x="markings.cx - 9.16" :y="0" width="18.32" height="5.5" class="board__line" />
      </template>
      <template v-if="markings.bottomBox">
        <rect
          :x="markings.cx - 20.16"
          :y="size.h - 16.5"
          width="40.32"
          height="16.5"
          class="board__line"
        />
        <rect
          :x="markings.cx - 9.16"
          :y="size.h - 5.5"
          width="18.32"
          height="5.5"
          class="board__line"
        />
      </template>
    </g>

    <!-- Arrows -->
    <g class="board__arrows">
      <path
        v-for="(a, index) in arrows"
        :key="index"
        :d="arrowPath(field, a.from, a.to, a.style)"
        class="board__arrow"
        :class="[
          `board__arrow--${a.style}`,
          { 'board__arrow--draft': draftArrow && index === arrows.length - 1 },
        ]"
        :marker-end="a.style === 'line' ? undefined : `url(#${uid}-head)`"
        @pointerdown.stop="interactive && emit('arrowDown', index, $event)"
      />
    </g>

    <!-- Objects -->
    <g
      v-for="o in layered"
      v-show="pos(o.id)"
      :key="o.id"
      class="board__object"
      :class="{ 'board__object--selected': o.id === selectedId }"
      :transform="pos(o.id) ? `translate(${pos(o.id)![0]} ${pos(o.id)![1]})` : undefined"
      :tabindex="interactive ? 0 : undefined"
      :role="interactive ? 'button' : undefined"
      :aria-label="interactive ? objectLabel(o) : undefined"
      :aria-pressed="interactive ? o.id === selectedId : undefined"
      :data-object="o.id"
      @pointerdown.stop="interactive && emit('objectDown', o.id, point($event), $event)"
      @keydown="interactive && emit('objectKey', o.id, $event)"
    >
      <BoardToken :object="o" :r="r" />
      <circle
        v-if="o.id === selectedId"
        :r="extent(o)"
        class="board__selection"
        pointer-events="none"
        data-selection
      />
      <!-- Larger invisible hit area for touch; zones are grabbed anywhere on their area -->
      <g
        v-if="interactive && o.type === 'zone'"
        :transform="o.rotation ? `rotate(${o.rotation})` : undefined"
      >
        <ellipse
          v-if="o.shape === 'circle'"
          :rx="(o.w ?? 10) / 2"
          :ry="(o.h ?? 10) / 2"
          class="board__hit"
          data-hit
        />
        <rect
          v-else
          :x="-(o.w ?? 10) / 2"
          :y="-(o.h ?? 10) / 2"
          :width="o.w ?? 10"
          :height="o.h ?? 10"
          class="board__hit"
          data-hit
        />
      </g>
      <circle
        v-else-if="interactive"
        :r="Math.max(r * 1.8 * (o.scale ?? 1), extent(o) * 0.8)"
        class="board__hit"
        data-hit
      />
      <!-- Drag to resize (zones: width and height, rotated with the zone) -->
      <g
        v-if="interactive && o.id === selectedId"
        class="board__handle"
        :transform="o.type === 'zone' && o.rotation ? `rotate(${o.rotation})` : undefined"
        data-handle
        @pointerdown.stop="emit('resizeDown', o.id, point($event), $event)"
      >
        <circle
          :cx="handleAt(o)[0]"
          :cy="handleAt(o)[1]"
          :r="r * 1.3"
          class="board__hit"
          data-hit
        />
        <g :transform="`translate(${handleAt(o)[0]} ${handleAt(o)[1]})`" class="board__knob">
          <circle :r="r * 0.6" />
          <!-- Diagonal double arrow: drag outwards to enlarge -->
          <path
            :d="`M ${-r * 0.3} ${r * 0.3} L ${r * 0.3} ${-r * 0.3} M ${r * 0.05} ${-r * 0.3} L ${r * 0.3} ${-r * 0.3} L ${r * 0.3} ${-r * 0.05} M ${-r * 0.3} ${r * 0.05} L ${-r * 0.3} ${r * 0.3} L ${-r * 0.05} ${r * 0.3}`"
            class="board__knob-arrow"
          />
        </g>
      </g>
    </g>
  </svg>
</template>

<style scoped lang="scss">
.board {
  display: block;
  width: 100%;
  max-height: 70dvh;
  border-radius: $radius-lg;
  background: #2f7d32;
  color: #fff;
  touch-action: none;
  user-select: none;

  &__grass {
    fill: #2f7d32;
  }

  &__stripe {
    fill: #2a722d;
  }

  &__line {
    fill: none;
    stroke: rgb(255 255 255 / 85%);
    stroke-width: 0.35;
  }

  &__arrow {
    fill: none;
    stroke: currentColor;
    stroke-width: 0.5;
    stroke-linecap: round;

    &--run {
      stroke-dasharray: 1.4 1;
    }

    &--pass {
      stroke: #fde047;
      color: #fde047;
    }

    &--dribble {
      stroke: #fff;
    }

    &--line {
      stroke: rgb(255 255 255 / 90%);
    }

    &--draft {
      opacity: 0.7;
    }
  }

  &--interactive &__arrow {
    cursor: pointer;
    stroke-width: 0.7;
  }

  &__object {
    outline: none;
  }

  &--interactive &__object {
    cursor: grab;
  }

  &__object:focus-visible &__selection,
  &__object--selected &__selection {
    fill: none;
    stroke: #fff;
    stroke-width: 0.4;
    stroke-dasharray: 1 0.6;
  }

  &__object:focus-visible:not(&__object--selected) &__hit {
    fill: rgb(255 255 255 / 25%);
  }

  &__hit {
    fill: transparent;
  }

  &__handle {
    cursor: nesw-resize;
  }

  &__knob circle {
    fill: #1d4f20;
    stroke: #fff;
    stroke-width: 0.25;
  }

  &__knob-arrow {
    fill: none;
    stroke: #fff;
    stroke-width: 0.22;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
}
</style>
