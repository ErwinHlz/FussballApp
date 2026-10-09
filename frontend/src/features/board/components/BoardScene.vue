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
  }>(),
  { draftArrow: null, selectedId: null, interactive: false },
)

const emit = defineEmits<{
  objectDown: [id: string, point: Point, event: PointerEvent]
  arrowDown: [index: number, event: PointerEvent]
  fieldDown: [point: Point, event: PointerEvent]
  move: [point: Point, event: PointerEvent]
  up: [point: Point, event: PointerEvent]
  objectKey: [id: string, event: KeyboardEvent]
}>()

const { t } = useI18n()
const uid = useId()
const svgRef = ref<SVGSVGElement | null>(null)

const size = computed(() => FIELD_SIZE[props.field])
const r = computed(() => objectRadius(props.field))
const viewBox = computed(() => {
  const pad = 2
  return `${-pad} ${-pad} ${size.value.w + pad * 2} ${size.value.h + pad * 2}`
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

/** Field percent for a screen point, or null outside the field (drops from the palette). */
function clientToField(clientX: number, clientY: number): Point | null {
  const svg = svgRef.value
  if (!svg) return null
  const rect = svg.getBoundingClientRect()
  if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom)
    return null
  const matrix = typeof svg.getScreenCTM === 'function' ? svg.getScreenCTM() : null
  if (!matrix) return [50, 50]
  const p = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse())
  return fromSvg(props.field, p.x, p.y)
}
defineExpose({ clientToField })

// Zones lie under everything, the ball on top.
const LAYER: Partial<Record<BoardObject['type'], number>> = { zone: 0, text: 3, ball: 4 }
const layered = computed(() =>
  [...props.objects].sort((a, b) => (LAYER[a.type] ?? 2) - (LAYER[b.type] ?? 2)),
)

/** Selection/hit size: zones by their area, everything else by the base radius. */
function extent(o: BoardObject): number {
  if (o.type === 'zone') return Math.max(o.w ?? 10, o.h ?? 10) / 2 + r.value * 0.4
  if (o.type === 'ladder') return r.value * 3.2
  if (o.type === 'goal') return r.value * 2.4
  return r.value * 1.6
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
        />
        <rect
          v-else
          :x="-(o.w ?? 10) / 2"
          :y="-(o.h ?? 10) / 2"
          :width="o.w ?? 10"
          :height="o.h ?? 10"
          class="board__hit"
        />
      </g>
      <circle v-else-if="interactive" :r="Math.max(r * 1.8, extent(o) * 0.8)" class="board__hit" />
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
}
</style>
