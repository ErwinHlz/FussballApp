<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEventListener } from '@vueuse/core'
import UiChipGroup from '@/ui/UiChipGroup.vue'
import BottomSheet from '@/ui/BottomSheet.vue'
import UiButton from '@/ui/UiButton.vue'
import UiIconButton from '@/ui/UiIconButton.vue'
import UiSegmented from '@/ui/UiSegmented.vue'
import AnimationPlayer from './AnimationPlayer.vue'
import BoardScene from './BoardScene.vue'
import BoardToken from './BoardToken.vue'
import { distance } from '../geometry'
import { holdersAt, resolveKeyframes } from '../interpolate'
import {
  addKeyframe,
  addObject,
  carrierNear,
  duplicateObject,
  EQUIPMENT_COLORS,
  moveObject,
  nearestBall,
  newObject,
  PLAYER_COLORS,
  removeKeyframe,
  removeObject,
  setDuration,
  setHolder,
  setKeyframeTime,
  updateObject,
} from '../editor'
import {
  BALL_CARRIERS,
  COLORED,
  FIELD_TYPES,
  ROTATABLE,
  type Animation,
  type Annotation,
  type ArrowStyle,
  type BoardObject,
  type FieldType,
  type ObjectType,
  type Point,
} from '../schema'

/**
 * Tactics board editor: drag equipment from the palette onto the field, move it, draw arrows
 * and animate in steps (keyframes). Used for drill animations and standalone boards.
 */
const props = withDefaults(defineProps<{ title: string; squadNames?: string[] }>(), {
  squadNames: () => [],
})
const model = defineModel<Animation>({ required: true })

// Local working copy: several edits in one handler (add a ball, then attach it) must build on
// each other; a v-model value only updates after the parent re-renders.
const draft = ref<Animation>(model.value)
watch(model, (value) => {
  if (value !== draft.value) draft.value = value
})
watch(draft, (value) => (model.value = value), { flush: 'sync' })

const { t } = useI18n()
const uid = useId()

const keyframeIndex = ref(0)
const selectedId = ref<string | null>(null)
type Tool = 'move' | ArrowStyle | 'erase'
const tool = ref<Tool>('move')
const playerColor = ref<string>(PLAYER_COLORS[0].hex)
const preview = ref(false)
// Below the field: "add" shows the material bar, "steps" the timeline (one at a time on phones).
const dockTab = ref<'add' | 'steps'>('add')
const propsOpen = ref(false)
watch(selectedId, (id) => {
  if (!id) propsOpen.value = false
})
const announcement = ref('')
const sceneRef = ref<InstanceType<typeof BoardScene> | null>(null)

// A different animation (e.g. after loading) starts at the first step.
watch(
  () => draft.value.keyframes.length,
  (length) => {
    if (keyframeIndex.value >= length) keyframeIndex.value = length - 1
  },
)

const resolved = computed(() => resolveKeyframes(draft.value))
const positions = computed(() => resolved.value[keyframeIndex.value]?.positions ?? {})
const holders = computed(() => holdersAt(draft.value, keyframeIndex.value))
const currentKeyframe = computed(() => draft.value.keyframes[keyframeIndex.value])
const selected = computed(() => draft.value.objects.find((o) => o.id === selectedId.value) ?? null)

function objectName(o: Pick<BoardObject, 'type' | 'label' | 'name' | 'text'>) {
  const type = t(`board.objects.${o.type}`)
  if (o.name) return `${type} ${o.name}`
  if (o.label) return `${type} ${o.label}`
  return type
}

// ---------------------------------------------------------------------------
// Pointer interaction on the field
// ---------------------------------------------------------------------------

const dragging = ref<{ id: string; pointerId: number; released: boolean; moved: boolean } | null>(
  null,
)
const arrowDraft = ref<Annotation | null>(null)

function onObjectDown(id: string, point: Point, event: PointerEvent) {
  if (tool.value === 'erase') {
    draft.value = removeObject(draft.value, id)
    selectedId.value = null
    announcement.value = t('board.removed')
    return
  }
  if (tool.value !== 'move') {
    startArrow(point, event)
    return
  }
  selectedId.value = id
  dragging.value = { id, pointerId: event.pointerId, released: false, moved: false }
  capture(event.currentTarget, event.pointerId)
}

/** Keeps receiving pointer events while dragging outside the object (no-op if not possible). */
function capture(target: EventTarget | null, pointerId: number) {
  try {
    ;(target as Element | null)?.closest('svg')?.setPointerCapture(pointerId)
  } catch {
    // Synthetic or already released pointers cannot be captured.
  }
}

function startArrow(point: Point, event: PointerEvent) {
  if (tool.value === 'move' || tool.value === 'erase') return
  arrowDraft.value = { type: 'arrow', from: point, to: point, style: tool.value }
  capture(event.target, event.pointerId)
}

function onFieldDown(point: Point, event: PointerEvent) {
  selectedId.value = null
  startArrow(point, event)
}

function onMove(point: Point, event: PointerEvent) {
  const drag = dragging.value
  if (drag && drag.pointerId === event.pointerId) {
    // Dragging a carried ball takes it off the player.
    if (!drag.released && holders.value[drag.id]) {
      draft.value = setHolder(draft.value, drag.id, null, keyframeIndex.value, point)
      drag.released = true
    }
    drag.moved = true
    draft.value = moveObject(draft.value, drag.id, point, keyframeIndex.value)
  } else if (arrowDraft.value) {
    arrowDraft.value = { ...arrowDraft.value, to: point }
  }
}

function onUp(point: Point) {
  const drag = dragging.value
  dragging.value = null
  const object = drag && draft.value.objects.find((o) => o.id === drag.id)
  // A ball dropped at a player sticks to them.
  if (object?.type === 'ball' && drag?.moved) {
    const carrier = carrierNear(draft.value, positions.value, point)
    if (carrier && holders.value[object.id] !== carrier) {
      draft.value = setHolder(draft.value, object.id, carrier, keyframeIndex.value)
      announcement.value = t('board.ballTo', { name: carrierName(carrier) })
    }
  }
  const arrow = arrowDraft.value
  arrowDraft.value = null
  // Ignore taps that were not meant as arrows.
  if (arrow && distance(arrow.from, arrow.to) > 3) {
    draft.value = { ...draft.value, annotations: [...draft.value.annotations, arrow] }
    announcement.value = t('board.arrowAdded')
  }
}

function onArrowDown(index: number) {
  if (tool.value !== 'erase') return
  draft.value = {
    ...draft.value,
    annotations: draft.value.annotations.filter((_, i) => i !== index),
  }
  announcement.value = t('board.removed')
}

/** Keyboard: arrows move the focused object (Shift = bigger steps), Delete removes it. */
function onObjectKey(id: string, event: KeyboardEvent) {
  const step = event.shiftKey ? 5 : 1
  const delta: Record<string, Point> = {
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
    ArrowUp: [0, -step],
    ArrowDown: [0, step],
  }
  if (event.key === 'Enter' || event.key === ' ') {
    selectedId.value = selectedId.value === id ? null : id
    event.preventDefault()
    return
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    remove(id)
    event.preventDefault()
    return
  }
  const d = delta[event.key]
  const current = positions.value[id]
  if (!d || !current) return
  event.preventDefault()
  const to: Point = [
    Math.min(100, Math.max(0, current[0] + d[0])),
    Math.min(100, Math.max(0, current[1] + d[1])),
  ]
  if (holders.value[id]) draft.value = setHolder(draft.value, id, null, keyframeIndex.value, to)
  draft.value = moveObject(draft.value, id, to, keyframeIndex.value)
  selectedId.value = id
}

// ---------------------------------------------------------------------------
// Palette: tap to add in the middle, or drag onto the field
// ---------------------------------------------------------------------------

type PaletteItem = { key: string; type: ObjectType; preset?: Partial<BoardObject> }
type PaletteTab = 'people' | 'equipment' | 'zones'
const paletteTab = ref<PaletteTab>('people')
const PALETTE: Record<PaletteTab, PaletteItem[]> = {
  people: [
    { key: 'player', type: 'player' },
    { key: 'goalkeeper', type: 'goalkeeper' },
    { key: 'coach', type: 'coach' },
    { key: 'ball', type: 'ball' },
  ],
  equipment: [
    { key: 'cone', type: 'cone' },
    { key: 'disc', type: 'disc' },
    { key: 'pole', type: 'pole' },
    { key: 'dummy', type: 'dummy' },
    { key: 'minigoal', type: 'minigoal' },
    { key: 'goal', type: 'goal' },
    { key: 'ladder', type: 'ladder' },
    { key: 'ring', type: 'ring' },
  ],
  zones: [
    { key: 'zoneRect', type: 'zone', preset: { shape: 'rect' } },
    { key: 'zoneCircle', type: 'zone', preset: { shape: 'circle', w: 18, h: 18 } },
    { key: 'text', type: 'text' },
  ],
}
const tabs = computed(() =>
  (['people', 'equipment', 'zones'] as const).map((value) => ({
    value,
    label: t(`board.palette.${value}`),
  })),
)

function itemObject(item: PaletteItem): Omit<BoardObject, 'id'> {
  return { ...newObject(draft.value, item.type, playerColor.value), ...item.preset }
}

/** Small preview in the palette (zones and ladders scaled to fit the icon). */
function previewObject(item: PaletteItem): BoardObject {
  const object = { ...itemObject(item), id: 'preview' }
  if (object.type === 'zone') return { ...object, w: 6, h: object.shape === 'circle' ? 6 : 4.5 }
  if (object.type === 'ladder') return { ...object, rotation: 90 }
  if (object.type === 'text') return { ...object, text: 'Aa' }
  return object
}

function addItem(item: PaletteItem, at?: Point) {
  // Without a drop point, spread new objects a little so they don't stack exactly.
  const n = draft.value.objects.length
  const point: Point = at ?? [40 + (n % 5) * 5, 45 + Math.floor(n / 5) * 5]
  const result = addObject(draft.value, itemObject(item), point, keyframeIndex.value)
  if (!result) {
    announcement.value = t('board.limitReached')
    return
  }
  draft.value = result.animation
  selectedId.value = result.id
  tool.value = 'move'
  announcement.value = t('board.added', { what: t(`board.palette.items.${item.key}`) })
  // A ball dropped at a player's feet sticks to them.
  if (item.type === 'ball') {
    const carrier = carrierNear(draft.value, positions.value, point)
    if (carrier) {
      draft.value = setHolder(draft.value, result.id, carrier, keyframeIndex.value)
      announcement.value = t('board.ballTo', { name: carrierName(carrier) })
    }
  }
}

const paletteDrag = ref<{
  item: PaletteItem
  pointerId: number
  startX: number
  startY: number
  x: number
  y: number
  active: boolean
} | null>(null)
let suppressClick = false

function onPaletteDown(item: PaletteItem, event: PointerEvent) {
  if (event.button !== 0) return
  paletteDrag.value = {
    item,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    x: event.clientX,
    y: event.clientY,
    active: false,
  }
}

useEventListener(window, 'pointermove', (event: PointerEvent) => {
  const drag = paletteDrag.value
  if (!drag || drag.pointerId !== event.pointerId) return
  drag.x = event.clientX
  drag.y = event.clientY
  if (!drag.active && Math.hypot(drag.x - drag.startX, drag.y - drag.startY) > 6) drag.active = true
})

useEventListener(window, 'pointerup', (event: PointerEvent) => {
  const drag = paletteDrag.value
  if (!drag || drag.pointerId !== event.pointerId) return
  paletteDrag.value = null
  if (!drag.active) return
  // The click that may follow a drag must not add a second object.
  suppressClick = true
  setTimeout(() => (suppressClick = false), 0)
  const point = sceneRef.value?.clientToField(event.clientX, event.clientY)
  if (point) addItem(drag.item, point)
})

useEventListener(window, 'pointercancel', () => (paletteDrag.value = null))

function onPaletteClick(item: PaletteItem) {
  if (suppressClick) return
  addItem(item)
}

// ---------------------------------------------------------------------------
// Selected object
// ---------------------------------------------------------------------------

function patchSelected(patch: Partial<Omit<BoardObject, 'id' | 'type'>>) {
  if (selectedId.value) draft.value = updateObject(draft.value, selectedId.value, patch)
}

function remove(id: string) {
  draft.value = removeObject(draft.value, id)
  if (selectedId.value === id) selectedId.value = null
  announcement.value = t('board.removed')
}

function duplicate() {
  const id = selectedId.value
  const at = id ? positions.value[id] : null
  if (!id || !at) return
  const result = duplicateObject(draft.value, id, at, keyframeIndex.value)
  if (!result) {
    announcement.value = t('board.limitReached')
    return
  }
  draft.value = result.animation
  selectedId.value = result.id
}

function rotate(by: number) {
  const current = selected.value?.rotation ?? 0
  patchSelected({ rotation: (((current + by) % 360) + 360) % 360 })
}

function carrierName(id: string) {
  const o = draft.value.objects.find((x) => x.id === id)
  return o ? objectName(o) : ''
}

const isCarrier = computed(() => !!selected.value && BALL_CARRIERS.includes(selected.value.type))
const hasBall = computed(() => draft.value.objects.some((o) => o.type === 'ball'))
const carriesBall = computed(() =>
  Object.values(holders.value).some((carrier) => carrier === selectedId.value),
)
const selectedHeld = computed(() => !!selectedId.value && !!holders.value[selectedId.value])

function giveBall() {
  const id = selectedId.value
  const at = id ? positions.value[id] : null
  if (!id || !at) return
  const ball = nearestBall(draft.value, positions.value, at)
  if (!ball) return
  draft.value = setHolder(draft.value, ball, id, keyframeIndex.value)
  announcement.value = t('board.ballTo', { name: carrierName(id) })
}

function releaseBall() {
  const id = selectedId.value
  const at = id ? positions.value[id] : null
  if (!id || !at) return
  draft.value = setHolder(draft.value, id, null, keyframeIndex.value, at)
}

const colorOptions = computed(() =>
  selected.value?.type === 'player' || selected.value?.type === 'goalkeeper'
    ? PLAYER_COLORS.map((c) => ({ hex: c.hex, label: t(`groups.colors.${c.key}`) }))
    : EQUIPMENT_COLORS.map((hex) => ({ hex, label: hex })),
)

function numberInput(event: Event, min: number, max: number): number | null {
  const value = Number((event.target as HTMLInputElement).value)
  return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : null
}

// ---------------------------------------------------------------------------
// Steps (keyframes), duration and field
// ---------------------------------------------------------------------------

function newKeyframe() {
  const result = addKeyframe(draft.value, keyframeIndex.value)
  if (!result) {
    announcement.value = t('board.limitReached')
    return
  }
  draft.value = result.animation
  keyframeIndex.value = result.index
  announcement.value = t('board.keyframeAdded')
}

function deleteKeyframe() {
  if (keyframeIndex.value === 0) return
  draft.value = removeKeyframe(draft.value, keyframeIndex.value)
  keyframeIndex.value = Math.max(0, keyframeIndex.value - 1)
}

const keyframeSeconds = computed({
  get: () => ((currentKeyframe.value?.t ?? 0) / 1000).toString(),
  set: (value: string) => {
    const next = setKeyframeTime(draft.value, keyframeIndex.value, Number(value) * 1000)
    if (next) draft.value = next
  },
})
const durationSeconds = computed({
  get: () => (draft.value.durationMs / 1000).toString(),
  set: (value: string) => {
    if (value !== '' && Number.isFinite(Number(value))) {
      draft.value = setDuration(draft.value, Number(value) * 1000)
    }
  },
})

const field = computed({
  get: () => draft.value.field,
  set: (value: FieldType | FieldType[] | undefined) => {
    if (typeof value === 'string') draft.value = { ...draft.value, field: value }
  },
})
const fieldOptions = computed(() =>
  FIELD_TYPES.map((f) => ({ value: f, label: t(`board.fields.${f}`) })),
)
const dockOptions = computed(() => [
  { value: 'add' as const, label: t('board.dock.add') },
  { value: 'steps' as const, label: t('board.dock.steps') },
])

const tools = computed<{ value: Tool; label: string; icon: string }[]>(() => [
  { value: 'move', label: t('board.tools.move'), icon: '✥' },
  { value: 'run', label: t('board.tools.run'), icon: '⇢' },
  { value: 'pass', label: t('board.tools.pass'), icon: '→' },
  { value: 'dribble', label: t('board.tools.dribble'), icon: '〰' },
  { value: 'line', label: t('board.tools.line'), icon: '／' },
  { value: 'erase', label: t('board.tools.erase'), icon: '✕' },
])

const seconds = (ms: number) => (ms / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })
</script>

<template>
  <div class="board-editor">
    <div class="board-editor__mode" role="group" :aria-label="t('board.mode')">
      <button
        type="button"
        :aria-pressed="!preview"
        class="board-editor__tab"
        :class="{ 'board-editor__tab--on': !preview }"
        @click="preview = false"
      >
        {{ t('board.edit') }}
      </button>
      <button
        type="button"
        :aria-pressed="preview"
        class="board-editor__tab"
        :class="{ 'board-editor__tab--on': preview }"
        @click="preview = true"
      >
        ▶ {{ t('board.preview') }}
      </button>
    </div>

    <AnimationPlayer v-if="preview" :animation="draft" :title="props.title" />

    <template v-else>
      <!-- Tools -->
      <div class="board-editor__tools" role="group" :aria-label="t('board.toolsLabel')">
        <button
          v-for="item in tools"
          :key="item.value"
          type="button"
          class="board-editor__tool"
          :class="{ 'board-editor__tool--on': tool === item.value }"
          :aria-pressed="tool === item.value"
          @click="tool = item.value"
        >
          <span aria-hidden="true">{{ item.icon }}</span>
          {{ item.label }}
        </button>
      </div>
      <p class="board-editor__hint">{{ t(`board.toolHints.${tool}`) }}</p>

      <BoardScene
        ref="sceneRef"
        :field="draft.field"
        :objects="draft.objects"
        :positions="positions"
        :annotations="draft.annotations"
        :draft-arrow="arrowDraft"
        :selected-id="selectedId"
        :title="t('board.sceneLabel', { n: keyframeIndex + 1 })"
        interactive
        @object-down="onObjectDown"
        @field-down="onFieldDown"
        @arrow-down="onArrowDown"
        @move="onMove"
        @up="onUp"
        @object-key="onObjectKey"
      />

      <!-- Dock: add material or edit the steps, always below the field -->
      <div class="board-editor__dock">
        <div
          v-if="selected"
          class="board-editor__context"
          role="group"
          :aria-label="t('board.props.label', { name: objectName(selected) })"
        >
          <strong class="board-editor__context-name">{{ objectName(selected) }}</strong>
          <UiButton variant="secondary" icon="settings" @click="propsOpen = true">
            {{ t('board.props.open') }}
          </UiButton>
          <div class="board-editor__actions board-editor__actions--inline">
            <template v-if="ROTATABLE.includes(selected.type)">
              <button
                type="button"
                class="board-editor__action"
                :aria-label="t('board.props.rotateLeft')"
                @click="rotate(-15)"
              >
                ⟲
              </button>
              <button
                type="button"
                class="board-editor__action"
                :aria-label="t('board.props.rotateRight')"
                @click="rotate(15)"
              >
                ⟳
              </button>
            </template>
            <button
              v-if="isCarrier && hasBall && !carriesBall"
              type="button"
              class="board-editor__action board-editor__action--text"
              @click="giveBall"
            >
              ⚽ {{ t('board.props.giveBall') }}
            </button>
            <button
              v-if="selected.type === 'ball' && selectedHeld"
              type="button"
              class="board-editor__action board-editor__action--text"
              @click="releaseBall"
            >
              {{ t('board.props.releaseBall') }}
            </button>
            <button
              type="button"
              class="board-editor__action board-editor__action--text"
              @click="duplicate"
            >
              {{ t('board.props.duplicate') }}
            </button>
            <button
              type="button"
              class="board-editor__action board-editor__action--danger"
              :aria-label="t('board.props.remove')"
              @click="remove(selected.id)"
            >
              ✕
            </button>
          </div>
          <UiIconButton
            icon="x"
            variant="ghost"
            :label="t('board.props.deselect')"
            @click="selectedId = null"
          />
        </div>

        <UiSegmented v-model="dockTab" :label="t('board.dock.label')" :options="dockOptions" />

        <section
          v-if="dockTab === 'add'"
          class="board-editor__palette"
          :aria-label="t('board.addLabel')"
        >
          <UiChipGroup
            v-model="paletteTab"
            :label="t('board.addLabel')"
            :options="tabs"
            :columns="3"
            hide-label
          />
          <div
            v-if="paletteTab === 'people'"
            class="board-editor__colors"
            role="group"
            :aria-label="t('board.playerColor')"
          >
            <button
              v-for="c in PLAYER_COLORS"
              :key="c.key"
              type="button"
              class="board-editor__color"
              :style="{ '--swatch': c.hex }"
              :class="{ 'board-editor__color--on': playerColor === c.hex }"
              :aria-pressed="playerColor === c.hex"
              :aria-label="t(`groups.colors.${c.key}`)"
              @click="playerColor = c.hex"
            />
          </div>
          <p class="board-editor__hint">{{ t('board.palette.hint') }}</p>
          <div class="board-editor__items" role="group" :aria-label="t('board.addLabel')">
            <button
              v-for="item in PALETTE[paletteTab]"
              :key="item.key"
              type="button"
              class="board-editor__item"
              :data-palette="item.key"
              @pointerdown="onPaletteDown(item, $event)"
              @click="onPaletteClick(item)"
            >
              <svg viewBox="-4 -4 8 8" aria-hidden="true" class="board-editor__icon">
                <BoardToken :object="previewObject(item)" :r="1.2" />
              </svg>
              <span>{{ t(`board.palette.items.${item.key}`) }}</span>
            </button>
          </div>
        </section>
        <div v-else class="board-editor__steps">
          <section class="board-editor__timeline" :aria-label="t('board.timeline')">
            <div class="board-editor__keyframes">
              <button
                v-for="(k, index) in draft.keyframes"
                :key="index"
                type="button"
                class="board-editor__keyframe"
                :class="{ 'board-editor__keyframe--on': index === keyframeIndex }"
                :aria-pressed="index === keyframeIndex"
                :aria-label="t('board.keyframeLabel', { n: index + 1, s: seconds(k.t) })"
                @click="keyframeIndex = index"
              >
                <span class="board-editor__keyframe-n">{{ index + 1 }}</span>
                <span>{{ seconds(k.t) }} s</span>
              </button>
              <button
                type="button"
                class="board-editor__keyframe board-editor__keyframe--add"
                @click="newKeyframe"
              >
                + {{ t('board.addKeyframe') }}
              </button>
            </div>
            <div class="board-editor__timing">
              <label v-if="keyframeIndex > 0">
                {{ t('board.keyframeTime') }}
                <input v-model.lazy="keyframeSeconds" type="number" step="0.1" min="0" />
              </label>
              <label>
                {{ t('board.duration') }}
                <input v-model.lazy="durationSeconds" type="number" step="0.5" min="0.5" max="60" />
              </label>
              <UiButton v-if="keyframeIndex > 0" variant="ghost" @click="deleteKeyframe">
                {{ t('board.removeKeyframe') }}
              </UiButton>
            </div>
            <p class="board-editor__hint">{{ t('board.keyframeHint') }}</p>
          </section>

          <UiChipGroup v-model="field" :label="t('board.field')" :options="fieldOptions" />
        </div>
      </div>

      <BottomSheet
        v-model:open="propsOpen"
        :title="selected ? objectName(selected) : t('board.props.open')"
      >
        <div v-if="selected" class="board-editor__props">
          <div
            v-if="COLORED.includes(selected.type)"
            class="board-editor__colors"
            role="group"
            :aria-label="t('board.props.color')"
          >
            <button
              v-for="c in colorOptions"
              :key="c.hex"
              type="button"
              class="board-editor__color"
              :style="{ '--swatch': c.hex }"
              :class="{ 'board-editor__color--on': selected.color === c.hex }"
              :aria-pressed="selected.color === c.hex"
              :aria-label="c.label"
              @click="patchSelected({ color: c.hex })"
            />
          </div>

          <div
            v-if="selected.type === 'player' || selected.type === 'goalkeeper'"
            class="board-editor__row"
          >
            <label class="board-editor__field board-editor__field--short">
              {{ t('board.props.number') }}
              <input
                :value="selected.label ?? ''"
                maxlength="3"
                inputmode="numeric"
                @input="
                  patchSelected({ label: ($event.target as HTMLInputElement).value || undefined })
                "
              />
            </label>
            <label class="board-editor__field">
              {{ t('board.props.name') }}
              <input
                :value="selected.name ?? ''"
                maxlength="16"
                :list="squadNames.length ? `${uid}-squad` : undefined"
                :placeholder="t('board.props.namePlaceholder')"
                @input="
                  patchSelected({ name: ($event.target as HTMLInputElement).value || undefined })
                "
              />
            </label>
            <datalist v-if="squadNames.length" :id="`${uid}-squad`">
              <option v-for="n in squadNames" :key="n" :value="n" />
            </datalist>
          </div>

          <label v-if="selected.type === 'text'" class="board-editor__field">
            {{ t('board.props.text') }}
            <input
              :value="selected.text ?? ''"
              maxlength="40"
              @input="patchSelected({ text: ($event.target as HTMLInputElement).value })"
            />
          </label>

          <div v-if="selected.type === 'zone'" class="board-editor__row">
            <label class="board-editor__field board-editor__field--short">
              {{ t('board.props.width') }}
              <input
                type="number"
                min="1"
                max="105"
                :value="selected.w ?? 10"
                @change="patchSelected({ w: numberInput($event, 1, 105) ?? selected.w })"
              />
            </label>
            <label class="board-editor__field board-editor__field--short">
              {{ t('board.props.height') }}
              <input
                type="number"
                min="1"
                max="105"
                :value="selected.h ?? 10"
                @change="patchSelected({ h: numberInput($event, 1, 105) ?? selected.h })"
              />
            </label>
            <UiButton
              variant="secondary"
              @click="patchSelected({ shape: selected.shape === 'circle' ? 'rect' : 'circle' })"
            >
              {{
                selected.shape === 'circle' ? t('board.props.toRect') : t('board.props.toCircle')
              }}
            </UiButton>
          </div>
        </div>
      </BottomSheet>
    </template>

    <p class="visually-hidden" aria-live="polite">{{ announcement }}</p>

    <!-- Item following the finger while dragging from the palette -->
    <Teleport to="body">
      <div
        v-if="paletteDrag?.active"
        class="board-editor__ghost"
        :style="{ left: `${paletteDrag.x}px`, top: `${paletteDrag.y}px` }"
        aria-hidden="true"
      >
        <svg viewBox="-4 -4 8 8">
          <BoardToken :object="previewObject(paletteDrag.item)" :r="1.2" />
        </svg>
      </div>
    </Teleport>
  </div>
</template>

<style scoped lang="scss">
.board-editor {
  display: flex;
  flex-direction: column;
  gap: $space-3;

  // Field and palette must fit on a phone screen together to drag between them.
  :deep(.board--interactive) {
    max-height: 50dvh;
  }

  &__mode {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2px;
    padding: 2px;
    border-radius: $radius-md;
    background: var(--color-surface-muted);
  }

  &__tab {
    @include touch-target;
    @include focus-visible;

    border: 0;
    border-radius: $radius-sm;
    background: transparent;
    color: var(--color-text);
    font-weight: 700;

    &--on {
      background: var(--color-surface);
      box-shadow: var(--shadow-sm);
    }
  }

  // One swipeable row, so the field starts high on the screen.
  &__tools {
    display: flex;
    gap: $space-1;
    margin-inline: -$space-4;
    padding: 2px $space-4;
    overflow-x: auto;
    scrollbar-width: none;
  }

  &__tool {
    @include touch-target;
    @include focus-visible;

    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    gap: $space-1;
    padding: $space-1 $space-3;
    border: 2px solid var(--color-border);
    border-radius: $radius-full;
    background: var(--color-surface);
    color: var(--color-text);
    font-size: $font-sm;
    font-weight: 700;

    span {
      font-size: $font-md;
    }

    &--on {
      border-color: var(--color-primary);
      background: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface));
    }
  }

  &__hint {
    font-size: $font-sm;
    color: var(--color-text-muted);
  }

  // Directly below the field (never on top of it, so drops always land on the field).
  &__dock {
    @include safe-area-padding(bottom, $space-3);

    display: flex;
    flex-direction: column;
    gap: $space-2;
    margin-inline: -$space-4;
    padding-top: $space-3;
    padding-inline: $space-4;
    border-top: 1px solid var(--color-border);
    border-radius: 22px 22px 0 0;
    background: var(--color-bar);
    box-shadow: 0 -8px 24px rgb(0 0 0 / 12%);
  }

  &__context {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: $space-2;
    padding-bottom: $space-2;
    border-bottom: 1px dashed var(--color-chalk);
  }

  &__context-name {
    flex: 1 1 auto;
    max-width: 140px;
    font-family: var(--font-display);
    font-size: $font-lg;

    @include truncate;
  }

  &__actions--inline {
    display: flex;
    flex-wrap: wrap;
    gap: $space-1;
  }

  &__palette,
  &__steps,
  &__props {
    display: flex;
    flex-direction: column;
    gap: $space-2;
  }

  &__props-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__close {
    @include touch-target;
    @include focus-visible;

    border: 0;
    background: transparent;
    color: var(--color-text-muted);
  }

  &__row {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: $space-2;
  }

  &__field {
    display: flex;
    flex: 1 1 8rem;
    flex-direction: column;
    gap: 2px;
    font-size: $font-sm;
    font-weight: 600;

    &--short {
      flex: 0 0 5rem;
    }

    input {
      width: 100%;
      min-height: $touch-target;
      padding: $space-1 $space-2;
      border: 2px solid var(--color-border);
      border-radius: $radius-md;
      background: var(--color-surface);
      color: var(--color-text);
      font-size: $font-md;

      &:focus-visible {
        @include focus-ring;
      }
    }
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    gap: $space-1;
  }

  &__action {
    @include touch-target;
    @include focus-visible;

    padding: 0 $space-3;
    border: 1px solid var(--color-border);
    border-radius: $radius-md;
    background: var(--color-surface);
    color: var(--color-text);
    font-size: $font-lg;
    font-weight: 700;

    &--text {
      font-size: $font-sm;
    }

    &--danger {
      margin-left: auto;
      color: var(--color-danger);
    }
  }

  &__colors {
    display: flex;
    flex-wrap: wrap;
    gap: $space-2;
  }

  &__color {
    @include touch-target;
    @include focus-visible;

    border: 3px solid var(--color-border);
    border-radius: $radius-full;
    background: var(--swatch);

    &--on {
      border-color: var(--color-text);
      box-shadow: 0 0 0 3px var(--color-surface) inset;
    }
  }

  &__items {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: $space-1;
  }

  &__item {
    @include focus-visible;

    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-width: 0;
    padding: $space-1;
    border: 1px solid var(--color-border);
    border-radius: $radius-md;
    background: #2f7d32;
    color: #fff;
    font-size: $font-xs;
    font-weight: 700;
    text-align: center;
    overflow-wrap: anywhere;
    cursor: grab;
    // Dragging an item must not scroll the page.
    touch-action: none;
    user-select: none;
  }

  &__icon {
    width: 32px;
    height: 32px;
  }

  &__ghost {
    position: fixed;
    z-index: 1000;
    width: 56px;
    height: 56px;
    border-radius: $radius-full;
    background: rgb(47 125 50 / 70%);
    transform: translate(-50%, -50%);
    pointer-events: none;

    svg {
      width: 100%;
      height: 100%;
    }
  }

  &__timeline {
    display: flex;
    flex-direction: column;
    gap: $space-2;
  }

  &__keyframes {
    display: flex;
    gap: $space-1;
    overflow-x: auto;
    padding-bottom: $space-1;
  }

  &__keyframe {
    @include focus-visible;

    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    align-items: center;
    min-width: 56px;
    min-height: $touch-target;
    padding: $space-1 $space-2;
    border: 2px solid var(--color-border);
    border-radius: $radius-md;
    background: var(--color-surface);
    color: var(--color-text);
    font-size: $font-xs;
    font-variant-numeric: tabular-nums;

    &--on {
      border-color: var(--color-primary);
      background: var(--color-primary);
      color: var(--color-primary-contrast);
    }

    &--add {
      justify-content: center;
      border-style: dashed;
      font-weight: 700;
    }
  }

  &__keyframe-n {
    font-weight: 800;
    font-size: $font-sm;
  }

  &__timing {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: $space-3;

    label {
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: $font-sm;
      font-weight: 600;
    }

    input {
      width: 88px;
      min-height: $touch-target;
      padding: $space-1 $space-2;
      border: 2px solid var(--color-border);
      border-radius: $radius-md;
      background: var(--color-surface);
      color: var(--color-text);
      font-size: $font-md;

      &:focus-visible {
        @include focus-ring;
      }
    }
  }
}
</style>
