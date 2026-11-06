<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useEventListener } from '@vueuse/core'
import BottomSheet from '@/ui/BottomSheet.vue'
import UiButton from '@/ui/UiButton.vue'
import UiIcon from '@/ui/UiIcon.vue'
import UiIconButton from '@/ui/UiIconButton.vue'
import type { SquadPlayer } from '../composables/useBoardSquad'
import { boardPng, canShareFile, downloadFile, exportFileName } from '../export'
import AnimationPlayer from './AnimationPlayer.vue'
import BoardScene from './BoardScene.vue'
import BoardToken from './BoardToken.vue'
import { distance, toSvg } from '../geometry'
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
  scaleObject,
  setDuration,
  setHolder,
  setKeyframeTime,
  updateObject,
} from '../editor'
import {
  BALL_CARRIERS,
  COLORED,
  FIELD_TYPES,
  MAX_SCALE,
  MIN_SCALE,
  ROTATABLE,
  SCALABLE,
  type Animation,
  type Annotation,
  type ArrowStyle,
  type BoardObject,
  type FieldType,
  type ObjectType,
  type Point,
} from '../schema'

/**
 * Tactics board editor, full screen in phone format (a centered portrait column on wide
 * screens): the whole page is the field, equipment is dragged in from the palette at the
 * bottom edge, tools sit on top, steps above the palette. Used for drill animations and
 * standalone boards.
 * Slots: `actions` (top bar, e.g. save), `settings` (settings sheet), `status` (messages).
 */
const props = withDefaults(
  defineProps<{
    title: string
    heading: string
    eyebrow?: string
    /** The team's players: squad bar (drag onto the field) and name suggestions. */
    squad?: SquadPlayer[]
    /** `@back`: replaces the default (previous page), e.g. to close a builder. */
    onBack?: () => void
  }>(),
  { eyebrow: undefined, squad: () => [], onBack: undefined },
)
const squadNames = computed(() => props.squad.map((p) => p.name))
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
const route = useRoute()
const router = useRouter()

/** The app's header is covered, so the editor brings its own back button (same rules). */
function goBack() {
  if (props.onBack) props.onBack()
  else if (window.history.state?.back) router.back()
  else if (route.meta.back) void router.push({ name: route.meta.back })
}

const keyframeIndex = ref(0)
const selectedId = ref<string | null>(null)
type Tool = 'move' | ArrowStyle | 'erase'
const tool = ref<Tool>('move')
const playerColor = ref<string>(PLAYER_COLORS[0].hex)
const preview = ref(false)
const propsOpen = ref(false)
const settingsOpen = ref(false)
const colorOpen = ref(false)
watch(selectedId, (id) => {
  if (!id) propsOpen.value = false
  colorOpen.value = false
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
  // Zoomed in: one finger on free grass moves the view.
  if (tool.value === 'move' && zoom.value > 1) {
    panning.value = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      center: viewCenter(),
    }
    capture(event.target, event.pointerId)
    return
  }
  startArrow(point, event)
}

// ---------------------------------------------------------------------------
// Zoom: two fingers (or Ctrl + wheel / trackpad pinch) zoom the field, not the page. With an
// object selected they make the object bigger or smaller instead.
// ---------------------------------------------------------------------------

const MAX_ZOOM = 4
const zoom = ref(1)
const center = ref<[number, number] | null>(null)
const panning = ref<{ pointerId: number; x: number; y: number; center: [number, number] } | null>(
  null,
)
const zoomPercent = computed(() => Math.round(zoom.value * 100))

function resetZoom() {
  zoom.value = 1
  center.value = null
}

/** Field box (meters), screen box of the SVG and its pixels per meter at zoom 1. */
function metrics() {
  const svg = sceneRef.value?.svg
  const base = sceneRef.value?.base
  if (!svg || !base) return null
  const rect = svg.getBoundingClientRect()
  if (!rect.width || !rect.height) return null
  return { base, rect, perMeter: Math.min(rect.width / base.w, rect.height / base.h) }
}

function viewCenter(): [number, number] {
  const m = metrics()
  if (center.value) return center.value
  return m ? [m.base.x + m.base.w / 2, m.base.y + m.base.h / 2] : [0, 0]
}

/** Field point (meters) under a screen point at the current zoom. */
function meterAt(x: number, y: number): [number, number] | null {
  const m = metrics()
  if (!m) return null
  const [cx, cy] = viewCenter()
  const scale = zoom.value * m.perMeter
  return [
    cx + (x - (m.rect.left + m.rect.width / 2)) / scale,
    cy + (y - (m.rect.top + m.rect.height / 2)) / scale,
  ]
}

/** Zooms so that the field point `anchor` lies under the screen point (x, y). */
function zoomTo(factor: number, anchor: [number, number], x: number, y: number) {
  const m = metrics()
  if (!m) return
  const z = Math.min(MAX_ZOOM, Math.max(1, factor))
  if (z === 1) return resetZoom()
  const scale = z * m.perMeter
  setCenter(
    z,
    anchor[0] - (x - (m.rect.left + m.rect.width / 2)) / scale,
    anchor[1] - (y - (m.rect.top + m.rect.height / 2)) / scale,
  )
}

/** Keeps the view inside the field. */
function setCenter(z: number, cx: number, cy: number) {
  const m = metrics()
  if (!m) return
  const { x, y, w, h } = m.base
  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
  zoom.value = z
  center.value = [
    clamp(cx, x + w / z / 2, x + w - w / z / 2),
    clamp(cy, y + h / z / 2, y + h - h / z / 2),
  ]
}

/** Size of the selected object by a factor of its size at the start of the gesture. */
function resizeSelected(
  start: Pick<BoardObject, 'scale' | 'w' | 'h'>,
  factor: number,
  object: BoardObject,
) {
  if (object.type === 'zone') {
    const meters = (v: number) => Math.min(105, Math.max(1, Math.round(v * factor * 2) / 2))
    draft.value = updateObject(draft.value, object.id, {
      w: meters(start.w ?? 10),
      h: meters(start.h ?? 10),
    })
  } else {
    draft.value = scaleObject(draft.value, object.id, (start.scale ?? 1) * factor)
  }
}

// Two-finger gesture, seen before the field's own handlers (capture phase on the stage).
const touches = new Map<number, { x: number; y: number }>()
const pinch = ref<{
  distance: number
  zoom: number
  anchor: [number, number] | null
  target: BoardObject | null
} | null>(null)

function fingers() {
  const [a, b] = [...touches.values()]
  if (!a || !b) return null
  return {
    distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  }
}

// The first finger on free grass clears the selection before the second one arrives; a pinch
// keeps it (or the object the first finger grabbed).
let selectedAtFirstTouch: string | null = null

function onStageDown(event: PointerEvent) {
  if (event.pointerType === 'mouse') return
  touches.set(event.pointerId, { x: event.clientX, y: event.clientY })
  if (touches.size === 1) selectedAtFirstTouch = selectedId.value
  if (touches.size === 2) {
    if (!selectedId.value && selectedAtFirstTouch) selectedId.value = selectedAtFirstTouch
    const f = fingers()!
    // The first finger may have started a drag or an arrow: the gesture replaces it.
    dragging.value = null
    resizing.value = null
    panning.value = null
    arrowDraft.value = null
    overTrash.value = false
    pinch.value = {
      distance: f.distance,
      zoom: zoom.value,
      anchor: selected.value ? null : meterAt(f.x, f.y),
      target: selected.value ? { ...selected.value } : null,
    }
  }
  if (pinch.value) event.stopPropagation()
}

function onStageMove(event: PointerEvent) {
  if (!touches.has(event.pointerId)) return
  touches.set(event.pointerId, { x: event.clientX, y: event.clientY })
  const gesture = pinch.value
  const f = fingers()
  if (!gesture || !f) return
  event.stopPropagation()
  const factor = f.distance / gesture.distance
  const object = gesture.target && draft.value.objects.find((o) => o.id === gesture.target!.id)
  if (gesture.target && object) resizeSelected(gesture.target, factor, object)
  else if (gesture.anchor) zoomTo(gesture.zoom * factor, gesture.anchor, f.x, f.y)
}

function onStageUp(event: PointerEvent) {
  if (!touches.delete(event.pointerId)) return
  if (!pinch.value) return
  event.stopPropagation()
  if (touches.size < 2) {
    if (pinch.value.target) announceSize()
    pinch.value = null
  }
}

// Ctrl + wheel is also how trackpads report a pinch. Inside the editor it never zooms the page.
useEventListener(
  window,
  'wheel',
  (event: WheelEvent) => {
    if (!event.ctrlKey) return
    event.preventDefault()
    const stage = (event.target as Element | null)?.closest?.('.board-editor__stage')
    if (!stage || preview.value) return
    const factor = Math.exp(-event.deltaY * 0.01)
    if (selected.value) resizeSelected({ ...selected.value }, factor, selected.value)
    else {
      const anchor = meterAt(event.clientX, event.clientY)
      if (anchor) zoomTo(zoom.value * factor, anchor, event.clientX, event.clientY)
    }
  },
  { passive: false },
)
// Safari's own pinch events: the page must not zoom while the editor is open.
for (const name of ['gesturestart', 'gesturechange']) {
  useEventListener(document, name, (event: Event) => event.preventDefault(), { passive: false })
}

// Resize handle: people and equipment scale with the distance from their center, zones get
// width and height from the handle's position in the zone's own (rotated) frame.
const resizing = ref<{
  id: string
  pointerId: number
  startScale: number
  startDist: number
} | null>(null)

function onResizeDown(id: string, point: Point, event: PointerEvent) {
  const center = positions.value[id]
  const object = draft.value.objects.find((o) => o.id === id)
  if (!center || !object) return
  const [cx, cy] = toSvg(draft.value.field, center)
  const [px, py] = toSvg(draft.value.field, point)
  resizing.value = {
    id,
    pointerId: event.pointerId,
    startScale: object.scale ?? 1,
    startDist: Math.max(0.5, Math.hypot(px - cx, py - cy)),
  }
  capture(event.currentTarget, event.pointerId)
}

function resizeTo(point: Point) {
  const resize = resizing.value
  const center = resize && positions.value[resize.id]
  const object = resize && draft.value.objects.find((o) => o.id === resize.id)
  if (!resize || !center || !object) return
  const [cx, cy] = toSvg(draft.value.field, center)
  const [px, py] = toSvg(draft.value.field, point)
  if (object.type !== 'zone') {
    const scale = (resize.startScale * Math.hypot(px - cx, py - cy)) / resize.startDist
    draft.value = scaleObject(draft.value, object.id, scale)
    return
  }
  const angle = (-(object.rotation ?? 0) * Math.PI) / 180
  const dx = (px - cx) * Math.cos(angle) - (py - cy) * Math.sin(angle)
  const dy = (px - cx) * Math.sin(angle) + (py - cy) * Math.cos(angle)
  const f = object.shape === 'circle' ? 0.71 : 1
  const size = (d: number) =>
    Math.min(105, Math.max(1, Math.round(((2 * Math.abs(d)) / f) * 2) / 2))
  draft.value = updateObject(draft.value, object.id, { w: size(dx), h: size(dy) })
}

function onMove(point: Point, event: PointerEvent) {
  const drag = dragging.value
  const pan = panning.value
  if (pan?.pointerId === event.pointerId) {
    const m = metrics()
    if (m) {
      const scale = zoom.value * m.perMeter
      setCenter(
        zoom.value,
        pan.center[0] - (event.clientX - pan.x) / scale,
        pan.center[1] - (event.clientY - pan.y) / scale,
      )
    }
  } else if (resizing.value?.pointerId === event.pointerId) {
    resizeTo(point)
  } else if (drag && drag.pointerId === event.pointerId) {
    // Dragging a carried ball takes it off the player.
    if (!drag.released && holders.value[drag.id]) {
      draft.value = setHolder(draft.value, drag.id, null, keyframeIndex.value, point)
      drag.released = true
    }
    drag.moved = true
    overTrash.value = isOverTrash(event)
    draft.value = moveObject(draft.value, drag.id, point, keyframeIndex.value)
  } else if (arrowDraft.value) {
    arrowDraft.value = { ...arrowDraft.value, to: point }
  }
}

// Trash below the field while an object is dragged: dropping it there deletes the object.
const trashRef = ref<HTMLElement | null>(null)
const overTrash = ref(false)
function isOverTrash(event: PointerEvent) {
  const rect = trashRef.value?.getBoundingClientRect()
  if (!rect || !rect.width) return false
  const slack = 12
  return (
    event.clientX >= rect.left - slack &&
    event.clientX <= rect.right + slack &&
    event.clientY >= rect.top - slack &&
    event.clientY <= rect.bottom + slack
  )
}

function onUp(point: Point, event?: PointerEvent) {
  if (panning.value) {
    panning.value = null
    return
  }
  if (resizing.value) {
    resizing.value = null
    announceSize()
    return
  }
  const drag = dragging.value
  dragging.value = null
  const trashed = overTrash.value && event?.type === 'pointerup'
  overTrash.value = false
  if (drag?.moved && trashed) {
    remove(drag.id)
    return
  }
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
  if (event.key === '+' || event.key === '=' || event.key === '-') {
    selectedId.value = id
    resize(event.key === '-' ? -SCALE_STEP : SCALE_STEP)
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

/** `label`: what the announcement calls it (squad players by name). */
type PaletteItem = { key: string; type: ObjectType; preset?: Partial<BoardObject>; label?: string }
type PaletteGroup = 'people' | 'equipment' | 'zones'
const PALETTE: Record<PaletteGroup, PaletteItem[]> = {
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
const paletteGroups = ['people', 'equipment', 'zones'] as const
function pickColor(hex: string) {
  playerColor.value = hex
  colorOpen.value = false
}
const closeSettings = () => (settingsOpen.value = false)

// Squad bar (top left): the team's players, dragged onto the field with name and number.
const squadOpen = ref(false)
const squadItems = computed(() =>
  props.squad.map((player) => ({
    player,
    item: {
      key: 'player',
      type: 'player',
      label: player.name,
      preset: { name: player.name, ...(player.number ? { label: player.number } : {}) },
    } satisfies PaletteItem,
  })),
)
/** Squad player already on the field (matched by name), to select instead of adding twice. */
function placedObject(player: SquadPlayer) {
  return draft.value.objects.find(
    (o) => (o.type === 'player' || o.type === 'goalkeeper') && o.name === player.name,
  )
}
function onSquadClick(player: SquadPlayer, item: PaletteItem) {
  if (suppressClick) return
  const placed = placedObject(player)
  if (placed) {
    selectedId.value = placed.id
    tool.value = 'move'
  } else addItem(item)
}

// Picture of the current step: share sheet where possible, otherwise a PNG download.
const exportOpen = ref(false)
const exportFile = ref<File | null>(null)
const exportUrl = ref<string | null>(null)
const exportFailed = ref(false)
const canShare = computed(() => !!exportFile.value && canShareFile(exportFile.value))

async function openExport() {
  const svg = sceneRef.value?.svg
  if (!svg) return
  exportFailed.value = false
  exportFile.value = null
  try {
    const blob = await boardPng(svg)
    const name = exportFileName(
      props.title || props.heading,
      keyframeIndex.value + 1,
      t('board.export.stepWord'),
    )
    exportFile.value = new File([blob], name, { type: 'image/png' })
    exportUrl.value = URL.createObjectURL(blob)
  } catch {
    exportFailed.value = true
  }
  exportOpen.value = true
}
watch(exportOpen, (open) => {
  if (open || !exportUrl.value) return
  URL.revokeObjectURL(exportUrl.value)
  exportUrl.value = null
})

async function shareExport() {
  if (!exportFile.value) return
  try {
    await navigator.share({ files: [exportFile.value], title: props.title || props.heading })
  } catch (error) {
    // Closing the share sheet is no error; anything else falls back to the download.
    if ((error as DOMException).name !== 'AbortError') downloadFile(exportFile.value)
  }
}

/** A mouse wheel scrolls the palette sideways (it is one row). */
function onPaletteWheel(event: WheelEvent) {
  if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
  ;(event.currentTarget as HTMLElement).scrollLeft += event.deltaY
  event.preventDefault()
}
const playerColorName = computed(() =>
  t(`groups.colors.${PLAYER_COLORS.find((c) => c.hex === playerColor.value)?.key ?? 'red'}`),
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
  announcement.value = t('board.added', {
    what: item.label ?? t(`board.palette.items.${item.key}`),
  })
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
  // Dropped back on a bar: nothing is added.
  const target =
    typeof document.elementFromPoint === 'function'
      ? document.elementFromPoint(event.clientX, event.clientY)
      : null
  // The grass strip above the pitch counts as the field (the drop lands on its edge).
  if (target && !target.closest('svg.board') && !target.classList.contains('board-editor__stage'))
    return
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

const SCALE_STEP = 0.25
const sizePercent = computed(() => Math.round((selected.value?.scale ?? 1) * 100))
const canShrink = computed(() => {
  const o = selected.value
  if (!o) return false
  return o.type === 'zone' ? Math.min(o.w ?? 10, o.h ?? 10) > 1 : (o.scale ?? 1) > MIN_SCALE
})
const canGrow = computed(() => {
  const o = selected.value
  if (!o) return false
  return o.type === 'zone' ? Math.max(o.w ?? 10, o.h ?? 10) < 105 : (o.scale ?? 1) < MAX_SCALE
})

/** Bigger or smaller: people and equipment by their size factor, zones by width and height. */
function resize(by: number) {
  const o = selected.value
  if (!o) return
  if (o.type === 'zone') {
    const meters = (v: number) => Math.min(105, Math.max(1, Math.round(v * (1 + by) * 2) / 2))
    patchSelected({ w: meters(o.w ?? 10), h: meters(o.h ?? 10) })
  } else {
    draft.value = scaleObject(draft.value, o.id, (o.scale ?? 1) + by)
  }
  announceSize()
}

function setSize(event: Event) {
  const id = selectedId.value
  const percent = Number((event.target as HTMLInputElement).value)
  if (id && Number.isFinite(percent)) draft.value = scaleObject(draft.value, id, percent / 100)
}

function announceSize() {
  const o = selected.value
  if (!o) return
  announcement.value =
    o.type === 'zone'
      ? t('board.props.zoneSize', { w: o.w ?? 10, h: o.h ?? 10 })
      : t('board.props.sizeValue', { n: sizePercent.value })
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
  const n = keyframeIndex.value + 1
  draft.value = removeKeyframe(draft.value, keyframeIndex.value)
  keyframeIndex.value = Math.max(0, keyframeIndex.value - 1)
  announcement.value = t('board.keyframeRemoved', { n })
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

// Field size, switched at the top of the field. Positions are field percent, so objects keep
// their relative place.
function setField(value: FieldType) {
  if (value === draft.value.field) return
  resetZoom()
  draft.value = { ...draft.value, field: value }
  announcement.value = t(`board.fields.${value}`)
}
const fieldOptions = computed(() =>
  FIELD_TYPES.map((f) => ({
    value: f,
    label: t(`board.fields.${f}`),
    short: t(`board.fieldsShort.${f}`),
  })),
)

// One line over the field: what the drawing tool does, or how to start on an empty board.
const hint = computed(() => {
  if (tool.value !== 'move') return t(`board.toolHints.${tool.value}`)
  return draft.value.objects.length ? '' : t('board.palette.hint')
})

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
  <div class="board-editor" :class="{ 'board-editor--preview': preview }">
    <header class="board-editor__top">
      <UiIconButton icon="chevronLeft" variant="ghost" :label="t('common.back')" @click="goBack" />
      <div class="board-editor__heading">
        <p v-if="eyebrow" class="board-editor__eyebrow">{{ eyebrow }}</p>
        <h1 class="board-editor__title">{{ heading }}</h1>
      </div>
      <UiIconButton
        :icon="preview ? 'pause' : 'play'"
        variant="ghost"
        :label="t('board.preview')"
        :pressed="preview"
        @click="preview = !preview"
      />
      <UiIconButton
        icon="settings"
        variant="ghost"
        :label="t('board.settings')"
        aria-haspopup="dialog"
        @click="settingsOpen = true"
      />
      <slot name="actions" />
    </header>

    <!-- Tools: top edge -->
    <div
      v-if="!preview"
      class="board-editor__tools"
      role="group"
      :aria-label="t('board.toolsLabel')"
    >
      <button
        v-for="item in tools"
        :key="item.value"
        type="button"
        class="board-editor__tool"
        :class="{ 'board-editor__tool--on': tool === item.value }"
        :aria-pressed="tool === item.value"
        :title="item.label"
        @click="tool = item.value"
      >
        <span aria-hidden="true" class="board-editor__tool-icon">{{ item.icon }}</span>
        <span class="board-editor__tool-label">{{ item.label }}</span>
      </button>
    </div>

    <!-- The field fills everything between the bars -->
    <div
      class="board-editor__stage"
      @pointerdown.capture="onStageDown"
      @pointermove.capture="onStageMove"
      @pointerup.capture="onStageUp"
      @pointercancel.capture="onStageUp"
    >
      <AnimationPlayer
        v-if="preview"
        class="board-editor__player"
        :animation="draft"
        :title="props.title"
      />
      <template v-else>
        <BoardScene
          ref="sceneRef"
          :zoom="zoom"
          :center="center"
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
          @resize-down="onResizeDown"
        />
        <div class="board-editor__overlay">
          <!-- Squad (left), field size (middle), picture to share (right) -->
          <div class="board-editor__overlay-row">
            <button
              v-if="squad.length"
              type="button"
              class="board-editor__pill"
              :class="{ 'board-editor__pill--on': squadOpen }"
              :aria-expanded="squadOpen"
              @click="squadOpen = !squadOpen"
            >
              <UiIcon name="users" :size="18" />
              {{ t('board.squad.open') }}
            </button>
            <div class="board-editor__fields" role="group" :aria-label="t('board.field')">
              <button
                v-for="option in fieldOptions"
                :key="option.value"
                type="button"
                class="board-editor__field-size"
                :class="{ 'board-editor__field-size--on': draft.field === option.value }"
                :aria-pressed="draft.field === option.value"
                :aria-label="option.label"
                @click="setField(option.value)"
              >
                {{ option.short }}
              </button>
            </div>
            <button
              type="button"
              class="board-editor__pill board-editor__pill--icon"
              :aria-label="t('board.export.open')"
              aria-haspopup="dialog"
              @click="openExport"
            >
              <UiIcon name="share" :size="20" />
            </button>
          </div>
        </div>

        <!-- Squad bar: hidden (not removed) while dragging, so the whole field is free -->
        <section
          v-if="squadOpen && squad.length"
          class="board-editor__squad"
          :class="{ 'board-editor__squad--dragging': paletteDrag?.active }"
          :aria-label="t('board.squad.open')"
        >
          <p class="board-editor__squad-hint">{{ t('board.squad.hint') }}</p>
          <ul role="list" class="board-editor__squad-list">
            <li v-for="{ player, item } in squadItems" :key="player.id">
              <button
                type="button"
                class="board-editor__squad-player"
                :class="{ 'board-editor__squad-player--placed': placedObject(player) }"
                :data-squad="player.id"
                @pointerdown="!placedObject(player) && onPaletteDown(item, $event)"
                @click="onSquadClick(player, item)"
              >
                <span class="board-editor__squad-number" :style="{ '--swatch': playerColor }">
                  {{ player.number ?? '' }}
                </span>
                <span class="board-editor__squad-name">{{ player.name }}</span>
                <template v-if="placedObject(player)">
                  <UiIcon name="check" :size="16" />
                  <span class="visually-hidden">{{ t('board.squad.onField') }}</span>
                </template>
              </button>
            </li>
          </ul>
        </section>

        <!-- Bottom of the field: messages, the hint, then colors or the selected object -->
        <div class="board-editor__bottom">
          <div class="board-editor__status"><slot name="status" /></div>
          <button
            v-if="zoom > 1 && !selected && !colorOpen && !dragging?.moved"
            type="button"
            class="board-editor__pill board-editor__zoom"
            @click="resetZoom"
          >
            <UiIcon name="search" :size="18" />
            {{ t('board.zoomReset', { n: zoomPercent }) }}
          </button>
          <p
            v-else-if="hint && !selected && !colorOpen && !dragging?.moved"
            class="board-editor__hint"
          >
            {{ hint }}
          </p>
          <!-- While an object is dragged: drop it here to delete it -->
          <div
            v-if="dragging?.moved"
            ref="trashRef"
            class="board-editor__trash"
            :class="{ 'board-editor__trash--over': overTrash }"
            data-trash
          >
            <UiIcon name="trash" :size="22" />
            {{ t('board.trash') }}
          </div>
          <div
            v-else-if="colorOpen"
            class="board-editor__swatches"
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
              @click="pickColor(c.hex)"
            />
          </div>

          <!-- Selected object: floating over the bottom of the field -->
          <div
            v-else-if="selected"
            class="board-editor__context"
            role="group"
            :aria-label="t('board.props.label', { name: objectName(selected) })"
          >
            <strong class="board-editor__context-name">{{ objectName(selected) }}</strong>
            <UiIconButton
              icon="settings"
              variant="secondary"
              :label="t('board.props.open')"
              aria-haspopup="dialog"
              @click="propsOpen = true"
            />
            <button
              type="button"
              class="board-editor__action"
              :aria-label="t('board.props.smaller')"
              :disabled="!canShrink"
              @click="resize(-SCALE_STEP)"
            >
              −
            </button>
            <button
              type="button"
              class="board-editor__action"
              :aria-label="t('board.props.bigger')"
              :disabled="!canGrow"
              @click="resize(SCALE_STEP)"
            >
              +
            </button>
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
            <UiIconButton
              icon="x"
              variant="ghost"
              :label="t('board.props.deselect')"
              @click="selectedId = null"
            />
          </div>
        </div>
      </template>

      <div v-if="preview" class="board-editor__status board-editor__status--float">
        <slot name="status" />
      </div>
    </div>

    <!-- Steps (keyframes) -->
    <section v-if="!preview" class="board-editor__steps" :aria-label="t('board.timeline')">
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
        :aria-label="t('board.addKeyframeLabel')"
        @click="newKeyframe"
      >
        <span aria-hidden="true">+</span>
      </button>
      <!-- Deletes the chosen step; the first one is the start and stays -->
      <button
        type="button"
        class="board-editor__keyframe board-editor__keyframe--remove"
        :aria-label="t('board.removeKeyframeN', { n: keyframeIndex + 1 })"
        :disabled="keyframeIndex === 0"
        @click="deleteKeyframe"
      >
        <UiIcon name="trash" :size="20" />
      </button>
    </section>

    <!-- Material: drag from the edge onto the field (or tap to add in the middle) -->
    <section
      v-if="!preview"
      class="board-editor__palette"
      :aria-label="t('board.addLabel')"
      @wheel="onPaletteWheel"
    >
      <div
        v-for="group in paletteGroups"
        :key="group"
        class="board-editor__group"
        role="group"
        :aria-label="t(`board.palette.${group}`)"
      >
        <button
          v-if="group === 'people'"
          type="button"
          class="board-editor__item"
          :aria-label="`${t('board.playerColor')}: ${playerColorName}`"
          :aria-expanded="colorOpen"
          @click="colorOpen = !colorOpen"
        >
          <span class="board-editor__swatch" :style="{ '--swatch': playerColor }" />
          <span aria-hidden="true">{{ t('board.props.color') }}</span>
        </button>
        <button
          v-for="item in PALETTE[group]"
          :key="item.key"
          type="button"
          class="board-editor__item"
          :data-palette="item.key"
          @pointerdown="onPaletteDown(item, $event)"
          @click="onPaletteClick(item)"
        >
          <svg viewBox="-3.5 -3.5 7 7" aria-hidden="true" class="board-editor__icon">
            <BoardToken :object="previewObject(item)" :r="1.2" />
          </svg>
          <span>{{ t(`board.palette.items.${item.key}`) }}</span>
        </button>
      </div>
    </section>

    <BottomSheet
      v-model:open="exportOpen"
      :title="t('board.export.title', { n: keyframeIndex + 1 })"
    >
      <div class="board-editor__props">
        <p v-if="exportFailed" class="board-editor__error" role="alert">
          {{ t('board.export.failed') }}
        </p>
        <img
          v-if="exportUrl"
          :src="exportUrl"
          :alt="t('board.sceneLabel', { n: keyframeIndex + 1 })"
          class="board-editor__export-preview"
        />
        <UiButton v-if="canShare" icon="share" block @click="shareExport">
          {{ t('board.export.share') }}
        </UiButton>
        <UiButton
          v-if="exportFile"
          :variant="canShare ? 'secondary' : 'primary'"
          block
          @click="downloadFile(exportFile)"
        >
          {{ t('board.export.download') }}
        </UiButton>
      </div>
    </BottomSheet>

    <BottomSheet v-model:open="settingsOpen" :title="t('board.settings')">
      <div class="board-editor__props">
        <div class="board-editor__timing">
          <div v-if="keyframeIndex > 0" class="field field--compact board-editor__time">
            <label :for="`${uid}-keyframe-time`" class="field__label">{{
              t('board.keyframeTime')
            }}</label>
            <div class="field__box">
              <input
                :id="`${uid}-keyframe-time`"
                v-model.lazy="keyframeSeconds"
                class="field__control"
                type="number"
                step="0.1"
                min="0"
              />
              <fieldset class="field__outline" aria-hidden="true">
                <legend>{{ t('board.keyframeTime') }}</legend>
              </fieldset>
            </div>
          </div>
          <div class="field field--compact board-editor__time">
            <label :for="`${uid}-duration`" class="field__label">{{ t('board.duration') }}</label>
            <div class="field__box">
              <input
                :id="`${uid}-duration`"
                v-model.lazy="durationSeconds"
                class="field__control"
                type="number"
                step="0.5"
                min="0.5"
                max="60"
              />
              <fieldset class="field__outline" aria-hidden="true">
                <legend>{{ t('board.duration') }}</legend>
              </fieldset>
            </div>
          </div>
        </div>
        <p class="board-editor__muted">{{ t('board.keyframeHint') }}</p>
        <slot name="settings" :close="closeSettings" />
      </div>
    </BottomSheet>

    <BottomSheet
      v-model:open="propsOpen"
      :title="selected ? objectName(selected) : t('board.props.open')"
    >
      <div v-if="selected" class="board-editor__props">
        <div v-if="SCALABLE.includes(selected.type)" class="board-editor__size">
          <label :for="`${uid}-size`" class="board-editor__size-label">{{
            t('board.props.size')
          }}</label>
          <input
            :id="`${uid}-size`"
            class="board-editor__size-range"
            type="range"
            :min="MIN_SCALE * 100"
            :max="MAX_SCALE * 100"
            step="5"
            :value="sizePercent"
            :aria-valuetext="t('board.props.sizeValue', { n: sizePercent })"
            @input="setSize"
          />
          <span class="board-editor__size-value" aria-hidden="true">{{ sizePercent }} %</span>
        </div>
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
          <div class="field field--compact board-editor__field board-editor__field--short">
            <label :for="`${uid}-number`" class="field__label">{{ t('board.props.number') }}</label>
            <div class="field__box">
              <input
                :id="`${uid}-number`"
                class="field__control"
                :value="selected.label ?? ''"
                maxlength="3"
                inputmode="numeric"
                @input="
                  patchSelected({ label: ($event.target as HTMLInputElement).value || undefined })
                "
              />
              <fieldset class="field__outline" aria-hidden="true">
                <legend>{{ t('board.props.number') }}</legend>
              </fieldset>
            </div>
          </div>
          <div class="field field--compact board-editor__field">
            <label :for="`${uid}-name`" class="field__label">{{ t('board.props.name') }}</label>
            <div class="field__box">
              <input
                :id="`${uid}-name`"
                class="field__control"
                :value="selected.name ?? ''"
                maxlength="16"
                :list="squadNames.length ? `${uid}-squad` : undefined"
                :placeholder="t('board.props.namePlaceholder')"
                @input="
                  patchSelected({ name: ($event.target as HTMLInputElement).value || undefined })
                "
              />
              <fieldset class="field__outline" aria-hidden="true">
                <legend>{{ t('board.props.name') }}</legend>
              </fieldset>
            </div>
          </div>
          <datalist v-if="squadNames.length" :id="`${uid}-squad`">
            <option v-for="n in squadNames" :key="n" :value="n" />
          </datalist>
        </div>

        <div v-if="selected.type === 'text'" class="field field--compact board-editor__field">
          <label :for="`${uid}-text`" class="field__label">{{ t('board.props.text') }}</label>
          <div class="field__box">
            <input
              :id="`${uid}-text`"
              class="field__control"
              :value="selected.text ?? ''"
              maxlength="40"
              @input="patchSelected({ text: ($event.target as HTMLInputElement).value })"
            />
            <fieldset class="field__outline" aria-hidden="true">
              <legend>{{ t('board.props.text') }}</legend>
            </fieldset>
          </div>
        </div>

        <div v-if="selected.type === 'zone'" class="board-editor__row">
          <div class="field field--compact board-editor__field board-editor__field--short">
            <label :for="`${uid}-width`" class="field__label">{{ t('board.props.width') }}</label>
            <div class="field__box">
              <input
                :id="`${uid}-width`"
                class="field__control"
                type="number"
                min="1"
                max="105"
                :value="selected.w ?? 10"
                @change="patchSelected({ w: numberInput($event, 1, 105) ?? selected.w })"
              />
              <fieldset class="field__outline" aria-hidden="true">
                <legend>{{ t('board.props.width') }}</legend>
              </fieldset>
            </div>
          </div>
          <div class="field field--compact board-editor__field board-editor__field--short">
            <label :for="`${uid}-height`" class="field__label">{{ t('board.props.height') }}</label>
            <div class="field__box">
              <input
                :id="`${uid}-height`"
                class="field__control"
                type="number"
                min="1"
                max="105"
                :value="selected.h ?? 10"
                @change="patchSelected({ h: numberInput($event, 1, 105) ?? selected.h })"
              />
              <fieldset class="field__outline" aria-hidden="true">
                <legend>{{ t('board.props.height') }}</legend>
              </fieldset>
            </div>
          </div>
          <UiButton
            variant="secondary"
            @click="patchSelected({ shape: selected.shape === 'circle' ? 'rect' : 'circle' })"
          >
            {{ selected.shape === 'circle' ? t('board.props.toRect') : t('board.props.toCircle') }}
          </UiButton>
        </div>
      </div>
    </BottomSheet>

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
$grass: #2f7d32;
// Opaque: the page color behind the editor (::before) must not shine through.
$bar: #1d4f20;
$bar-line: rgb(255 255 255 / 18%);
// Bands above and below the pitch: the top row, and the bottom bar (44px buttons + padding).
$band-top: calc(#{$touch-target} + #{$space-2} * 2);
$band-bottom: calc(#{$touch-target} + #{$space-1} * 2 + #{$space-2} * 2);

// Same column as the rest of the app (AppLayout: header and main are 720px wide).
$editor-width: 720px;

// Over the app (header and tab bar), below sheets and snackbars. Always the phone layout; on
// wide screens it sits in the app's centered column, the rest is covered by the page color.
.board-editor {
  position: fixed;
  inset: 0;
  z-index: 60;
  width: min(100%, #{$editor-width});
  margin-inline: auto;
  display: grid;
  grid-template:
    'top' auto
    'tools' auto
    'stage' minmax(0, 1fr)
    'steps' auto
    'palette' auto
    / minmax(0, 1fr);
  background: $grass;
  color: #fff;
  overscroll-behavior: none;
  // No page zoom inside the editor (pinch and double tap); bars and lists still scroll. The
  // field handles two fingers itself.
  touch-action: pan-x pan-y;
  box-shadow: 0 0 40px rgb(0 0 0 / 20%);

  &::before {
    content: '';
    position: fixed;
    inset: 0;
    z-index: -1;
    background: var(--color-bg);
  }

  &--preview {
    grid-template:
      'top' auto
      'stage' minmax(0, 1fr)
      / minmax(0, 1fr);
  }
  // ---- Top bar -------------------------------------------------------------

  &__top {
    @include safe-area-padding(top, $space-1);

    grid-area: top;
    display: flex;
    align-items: center;
    gap: $space-1;
    padding-inline: $space-2;
    padding-bottom: $space-1;
    background: $bar;
    border-bottom: 1px solid $bar-line;

    :deep(.ui-button--icon.ui-button--ghost) {
      color: #fff;
    }

    :deep(.ui-button--icon[aria-pressed='true']) {
      border-color: #fff;
      background: #fff;
      color: $grass;
    }

    // Compact save button, so the title keeps room on phones.
    :deep(.ui-button:not(.ui-button--icon)) {
      flex-shrink: 0;
      padding-inline: $space-3;
    }
  }

  &__heading {
    flex: 1;
    min-width: 0;
    line-height: 1.1;
  }

  &__eyebrow {
    @include truncate;

    font-size: $font-xs;
    font-weight: 700;
    opacity: 0.8;
  }

  &__title {
    @include truncate;

    font-family: var(--font-display);
    font-size: $font-xl;
  }

  // ---- Tools ---------------------------------------------------------------

  &__tools {
    grid-area: tools;
    display: flex;
    justify-content: center;
    gap: $space-1;
    padding: $space-1 $space-2;
    background: $bar;
    overflow-x: auto;
    scrollbar-width: none;
  }

  &__tool {
    @include touch-target;
    @include focus-visible;

    display: flex;
    flex-shrink: 0;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-width: 52px;
    padding: 2px $space-1;
    border: 0;
    border-radius: $radius-md;
    background: transparent;
    color: #fff;
    font-size: 11px;
    font-weight: 700;

    &--on {
      background: #fff;
      color: $grass;
    }
  }

  &__tool-icon {
    font-size: $font-lg;
    line-height: 1;
  }

  // ---- Field ---------------------------------------------------------------

  &__stage {
    grid-area: stage;
    position: relative;
    min-height: 0;
    overflow: hidden;
    background: $grass;

    // The SVG takes the area between the top row (squad, field size, share) and the bottom
    // band (selected object, colors, hint), so nothing lies on the pitch and it never jumps
    // when a bar appears. The pitch is centered, grass fills the rest, and drops on the grass
    // land on the nearest point of the pitch.
    :deep(.board--interactive) {
      position: absolute;
      inset: $band-top 0 $band-bottom;
      width: 100%;
      height: calc(100% - #{$band-top} - #{$band-bottom});
      max-height: none;
      border-radius: 0;
    }
  }

  &__player {
    height: 100%;
    padding: $space-2;

    :deep(.board) {
      flex: 1;
      min-height: 0;
      max-height: none;
    }

    :deep(.player__controls),
    :deep(.player__options) {
      padding: $space-1 $space-2;
      border-radius: $radius-lg;
      background: var(--color-surface);
      color: var(--color-text);
    }
  }

  // Top of the field: field size switch, below it the hint. Only the switch takes pointers.
  &__overlay {
    position: absolute;
    top: $space-2;
    right: $space-2;
    left: $space-2;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: $space-2;
    pointer-events: none;
  }

  // Squad left, field size centered, share right (the middle stays centered without squad).
  &__overlay-row {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: $space-1;
    width: 100%;

    > :first-child:not(.board-editor__fields) {
      justify-self: start;
    }

    > .board-editor__fields {
      grid-column: 2;
    }

    > :last-child {
      grid-column: 3;
      justify-self: end;
    }
  }

  &__pill {
    @include touch-target;
    @include focus-visible;

    display: inline-flex;
    align-items: center;
    gap: $space-1;
    padding: 0 $space-3;
    border: 0;
    border-radius: $radius-full;
    background: $bar;
    color: #fff;
    font-size: $font-sm;
    font-weight: 700;
    pointer-events: auto;

    &--icon {
      justify-content: center;
      width: $touch-target;
      padding: 0;
    }

    &--on {
      background: #fff;
      color: $grass;
    }
  }

  &__squad {
    position: absolute;
    top: calc(#{$touch-target} + #{$space-3});
    left: $space-2;
    display: flex;
    flex-direction: column;
    width: min(210px, calc(100% - #{$space-4}));
    max-height: calc(100% - #{$touch-target} - #{$space-5});
    border-radius: $radius-lg;
    background: var(--color-surface);
    color: var(--color-text);
    box-shadow: var(--shadow-md, 0 6px 20px rgb(0 0 0 / 25%));
    transition: opacity var(--duration-fast, 120ms);

    &--dragging {
      opacity: 0;
      pointer-events: none;
    }
  }

  &__squad-hint {
    padding: $space-2 $space-3 $space-1;
    font-size: $font-xs;
    color: var(--color-text-muted);
  }

  &__squad-list {
    overflow-y: auto;
    padding: 0 $space-1 $space-1;
  }

  &__squad-player {
    @include focus-visible;

    display: flex;
    align-items: center;
    gap: $space-2;
    width: 100%;
    min-height: $touch-target;
    padding: 0 $space-2;
    border: 0;
    border-radius: $radius-md;
    background: transparent;
    color: inherit;
    font-weight: 700;
    text-align: left;
    cursor: grab;
    // Dragging a player must not scroll the list.
    touch-action: none;
    user-select: none;

    &:hover {
      background: var(--color-surface-muted);
    }

    &--placed {
      color: var(--color-text-muted);
      cursor: pointer;
    }
  }

  &__squad-number {
    display: grid;
    flex-shrink: 0;
    place-items: center;
    width: 30px;
    height: 30px;
    border: 2px solid rgb(0 0 0 / 25%);
    border-radius: $radius-full;
    background: var(--swatch);
    color: #fff;
    font-size: $font-xs;
    font-weight: 800;
    text-shadow: 0 1px 2px rgb(0 0 0 / 50%);
  }

  &__squad-name {
    flex: 1;
    min-width: 0;

    @include truncate;
  }

  &__export-preview {
    display: block;
    width: 100%;
    max-height: 50dvh;
    object-fit: contain;
    border-radius: $radius-md;
  }

  &__error {
    color: var(--color-danger);
  }

  &__fields {
    display: flex;
    gap: 2px;
    padding: 2px;
    border-radius: $radius-full;
    background: $bar;
    pointer-events: auto;
  }

  &__field-size {
    @include focus-visible;

    min-height: 36px;
    padding: 0 $space-3;
    border: 0;
    border-radius: $radius-full;
    background: transparent;
    color: #fff;
    font-size: $font-sm;
    font-weight: 700;
    white-space: nowrap;

    // 36px tall pill, but a 44px tap area.
    position: relative;

    &::after {
      content: '';
      position: absolute;
      inset: -4px 0;
    }

    &--on {
      background: #fff;
      color: $grass;
    }
  }

  &__hint {
    max-width: min(100%, 32rem);
    padding: $space-1 $space-3;
    border-radius: $radius-lg;
    background: $bar;
    font-size: $font-sm;
    text-align: center;
  }

  &__status {
    display: flex;
    gap: $space-1;
    flex-direction: column;
    align-items: center;
    pointer-events: none;

    :deep(> *) {
      padding: $space-1 $space-3;
      border-radius: $radius-lg;
      background: var(--color-surface);
      font-weight: 600;
      pointer-events: auto;
    }

    &--float {
      position: absolute;
      top: $space-2;
      right: $space-2;
      left: $space-2;
    }
  }

  // Floating column at the bottom of the field; only its bars take pointers.
  &__bottom {
    position: absolute;
    right: $space-2;
    bottom: $space-2;
    left: $space-2;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: $space-2;
    pointer-events: none;
  }

  &__zoom {
    font-variant-numeric: tabular-nums;
  }

  &__trash {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: $space-2;
    min-width: 12rem;
    min-height: calc(#{$touch-target} + #{$space-1} * 2);
    padding: 0 $space-4;
    border: 2px dashed rgb(255 255 255 / 70%);
    border-radius: $radius-lg;
    background: $bar;
    color: #fff;
    font-size: $font-sm;
    font-weight: 700;
    transition:
      background var(--duration-fast, 120ms),
      transform var(--duration-fast, 120ms);

    &--over {
      border-style: solid;
      border-color: #fff;
      background: var(--color-danger);
      transform: scale(1.06);
    }
  }

  &__context,
  &__swatches {
    display: flex;
    align-items: center;
    gap: $space-1;
    max-width: 100%;
    padding: $space-1 $space-2;
    pointer-events: auto;
    border-radius: $radius-lg;
    background: var(--color-surface);
    color: var(--color-text);
    box-shadow: var(--shadow-md, 0 6px 20px rgb(0 0 0 / 25%));
    overflow-x: auto;
    scrollbar-width: none;

    > * {
      flex-shrink: 0;
    }
  }

  &__context-name {
    max-width: 110px;
    font-family: var(--font-display);
    font-size: $font-lg;

    @include truncate;
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
      color: var(--color-danger);
    }

    &:disabled {
      opacity: 0.4;
    }
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

  // ---- Steps ---------------------------------------------------------------

  &__steps {
    grid-area: steps;
    display: flex;
    gap: $space-1;
    padding: $space-1 $space-2;
    background: $bar;
    border-top: 1px solid $bar-line;
    overflow-x: auto;
    scrollbar-width: none;
  }

  &__keyframe {
    @include focus-visible;

    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    // All steps and the "+" share one size.
    width: 56px;
    height: 48px;
    padding: 2px;
    border: 2px solid $bar-line;
    border-radius: $radius-md;
    background: transparent;
    color: #fff;
    font-size: $font-xs;
    font-variant-numeric: tabular-nums;
    line-height: 1.15;

    &--on {
      border-color: #fff;
      background: #fff;
      color: $grass;
    }

    &--add {
      border-style: dashed;
      border-color: rgb(255 255 255 / 60%);
      font-size: $font-xl;
      font-weight: 700;
    }

    // Right end of the row, apart from the steps.
    &--remove {
      margin-left: auto;
      border-color: rgb(255 255 255 / 60%);

      &:disabled {
        opacity: 0.35;
      }
    }
  }

  &__keyframe-n {
    font-weight: 800;
    font-size: $font-sm;
  }

  // ---- Palette (the edge things are dragged from) --------------------------

  &__palette {
    @include safe-area-padding(bottom, $space-1);

    grid-area: palette;
    display: flex;
    gap: $space-2;
    padding-top: $space-1;
    padding-inline: $space-2;
    background: $bar;
    border-top: 1px solid $bar-line;
    overflow-x: auto;
    scrollbar-width: none;

    // With a mouse, show that the row scrolls.
    @media (pointer: fine) {
      scrollbar-color: rgb(255 255 255 / 40%) transparent;
      scrollbar-width: thin;
    }
  }

  &__group {
    display: flex;
    flex-shrink: 0;
    gap: 2px;

    & + & {
      padding-left: $space-2;
      border-left: 1px solid $bar-line;
    }
  }

  &__item {
    @include focus-visible;

    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    width: 60px;
    min-height: 60px;
    padding: 2px;
    border: 0;
    border-radius: $radius-md;
    background: transparent;
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    text-align: center;
    cursor: grab;
    // Dragging an item must not scroll the page.
    touch-action: none;
    user-select: none;

    &:hover {
      background: rgb(255 255 255 / 10%);
    }
  }

  &__icon {
    width: 36px;
    height: 36px;
  }

  &__swatch {
    width: 26px;
    height: 26px;
    margin: 4px;
    border: 2px solid #fff;
    border-radius: $radius-full;
    background: var(--swatch);
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

  // ---- Sheets --------------------------------------------------------------

  &__props {
    display: flex;
    flex-direction: column;
    gap: $space-3;
    color: var(--color-text);
  }

  &__row,
  &__timing {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: $space-2;
  }

  &__colors {
    display: flex;
    flex-wrap: wrap;
    gap: $space-2;
  }

  &__field {
    flex: 1 1 8rem;

    &--short {
      flex: 0 0 7rem;
    }
  }

  &__time {
    width: 10rem;
  }

  &__size {
    display: flex;
    align-items: center;
    gap: $space-2;
  }

  &__size-label {
    font-weight: 700;
  }

  &__size-range {
    flex: 1;
    min-width: 0;
    min-height: $touch-target;
    accent-color: var(--color-primary);
  }

  &__size-value {
    width: 5ch;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  &__muted {
    font-size: $font-sm;
    color: var(--color-text-muted);
  }
}
</style>
