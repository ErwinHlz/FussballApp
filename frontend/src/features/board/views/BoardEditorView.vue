<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/components/BaseButton.vue'
import BaseChipGroup from '@/components/BaseChipGroup.vue'
import { useActiveTeam } from '@/features/teams/composables/useActiveTeam'
import { useDrill, useSaveDrillAnimation } from '@/features/drills/composables/useDrills'
import type { Json } from '@/types/database'
import AnimationPlayer from '../components/AnimationPlayer.vue'
import BoardScene from '../components/BoardScene.vue'
import { distance } from '../geometry'
import { resolveKeyframes } from '../interpolate'
import {
  addKeyframe,
  addObject,
  moveObject,
  nextLabel,
  PLAYER_COLORS,
  removeKeyframe,
  removeObject,
  setDuration,
  setKeyframeTime,
} from '../editor'
import {
  animationSchema,
  emptyAnimation,
  FIELD_TYPES,
  parseAnimation,
  type Animation,
  type Annotation,
  type ArrowStyle,
  type BoardObject,
  type FieldType,
  type Point,
} from '../schema'

const props = defineProps<{ drillId: string }>()

const { t } = useI18n()
const router = useRouter()
const drill = useDrill(() => props.drillId)
const save = useSaveDrillAnimation()
const { myTeams } = useActiveTeam()

const canEdit = computed(() => {
  const team = myTeams.data.value?.find((x) => x.team_id === drill.data.value?.team_id)
  return !!team && (team.team_role === 'coach' || team.is_club_admin)
})

// ---------------------------------------------------------------------------
// Draft state
// ---------------------------------------------------------------------------

const draft = ref<Animation>(emptyAnimation())
const savedJson = ref(JSON.stringify(draft.value))
const keyframeIndex = ref(0)
const selectedId = ref<string | null>(null)
type Tool = 'move' | ArrowStyle | 'erase'
const tool = ref<Tool>('move')
const playerColor = ref<string>(PLAYER_COLORS[0].hex)
const preview = ref(false)
const announcement = ref('')
const validationError = ref<string | null>(null)

watch(
  () => drill.data.value,
  (d) => {
    if (!d) return
    draft.value = parseAnimation(d.animation) ?? emptyAnimation()
    savedJson.value = JSON.stringify(draft.value)
    keyframeIndex.value = 0
  },
  { immediate: true },
)

const dirty = computed(() => JSON.stringify(draft.value) !== savedJson.value)
const resolved = computed(() => resolveKeyframes(draft.value))
const positions = computed(() => resolved.value[keyframeIndex.value]?.positions ?? {})
const currentKeyframe = computed(() => draft.value.keyframes[keyframeIndex.value])

// ---------------------------------------------------------------------------
// Pointer interaction
// ---------------------------------------------------------------------------

const dragging = ref<{ id: string; pointerId: number } | null>(null)
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
  dragging.value = { id, pointerId: event.pointerId }
  ;(event.currentTarget as Element | null)?.closest('svg')?.setPointerCapture(event.pointerId)
}

function startArrow(point: Point, event: PointerEvent) {
  if (tool.value === 'move' || tool.value === 'erase') return
  arrowDraft.value = { type: 'arrow', from: point, to: point, style: tool.value }
  ;(event.target as Element | null)?.closest('svg')?.setPointerCapture(event.pointerId)
}

function onFieldDown(point: Point, event: PointerEvent) {
  selectedId.value = null
  startArrow(point, event)
}

function onMove(point: Point, event: PointerEvent) {
  if (dragging.value && dragging.value.pointerId === event.pointerId) {
    draft.value = moveObject(draft.value, dragging.value.id, point, keyframeIndex.value)
  } else if (arrowDraft.value) {
    arrowDraft.value = { ...arrowDraft.value, to: point }
  }
}

function onUp() {
  dragging.value = null
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
    draft.value = removeObject(draft.value, id)
    announcement.value = t('board.removed')
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
  draft.value = moveObject(draft.value, id, to, keyframeIndex.value)
  selectedId.value = id
}

// ---------------------------------------------------------------------------
// Toolbar actions
// ---------------------------------------------------------------------------

function add(type: BoardObject['type']) {
  const object: Omit<BoardObject, 'id'> =
    type === 'player'
      ? { type, color: playerColor.value, label: nextLabel(draft.value, playerColor.value) }
      : type === 'cone'
        ? { type, color: '#f97316' }
        : { type }
  // Spread new objects a little so they don't stack exactly.
  const n = draft.value.objects.length
  const at: Point = [40 + (n % 5) * 5, 45 + Math.floor(n / 5) * 5]
  const result = addObject(draft.value, object, at, keyframeIndex.value)
  if (!result) {
    announcement.value = t('board.limitReached')
    return
  }
  draft.value = result.animation
  selectedId.value = result.id
  tool.value = 'move'
  announcement.value = t('board.added', { what: t(`board.objects.${type}`) })
}

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
const tools = computed<{ value: Tool; label: string; icon: string }[]>(() => [
  { value: 'move', label: t('board.tools.move'), icon: '✥' },
  { value: 'run', label: t('board.tools.run'), icon: '⇢' },
  { value: 'pass', label: t('board.tools.pass'), icon: '→' },
  { value: 'dribble', label: t('board.tools.dribble'), icon: '〰' },
  { value: 'erase', label: t('board.tools.erase'), icon: '✕' },
])

// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------

async function saveDraft() {
  const result = animationSchema.safeParse(draft.value)
  if (!result.success) {
    validationError.value = t('board.invalid')
    return
  }
  validationError.value = null
  await save.mutateAsync({ drillId: props.drillId, animation: result.data as unknown as Json })
  savedJson.value = JSON.stringify(draft.value)
  announcement.value = t('board.saved')
}

async function removeAnimation() {
  await save.mutateAsync({ drillId: props.drillId, animation: null })
  draft.value = emptyAnimation()
  savedJson.value = JSON.stringify(draft.value)
  await router.replace({ name: 'drill', params: { drillId: props.drillId } })
}

onBeforeRouteLeave(() => !dirty.value || window.confirm(t('board.unsavedConfirm')))

const seconds = (ms: number) => (ms / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })
</script>

<template>
  <section class="editor">
    <p v-if="drill.isPending.value">{{ t('common.loading') }}</p>
    <p v-else-if="drill.isError.value || !drill.data.value" class="editor__error" role="alert">
      {{ t('drills.loadFailedOne') }}
    </p>
    <p v-else-if="!canEdit" role="alert">{{ t('board.coachOnly') }}</p>

    <template v-else>
      <header>
        <RouterLink :to="{ name: 'drill', params: { drillId } }" class="editor__back">
          ‹ {{ drill.data.value.title }}
        </RouterLink>
        <h1>{{ t('board.title') }}</h1>
      </header>

      <div class="editor__mode" role="group" :aria-label="t('board.mode')">
        <button
          type="button"
          :aria-pressed="!preview"
          class="editor__tab"
          :class="{ 'editor__tab--on': !preview }"
          @click="preview = false"
        >
          {{ t('board.edit') }}
        </button>
        <button
          type="button"
          :aria-pressed="preview"
          class="editor__tab"
          :class="{ 'editor__tab--on': preview }"
          @click="preview = true"
        >
          ▶ {{ t('board.preview') }}
        </button>
      </div>

      <AnimationPlayer v-if="preview" :animation="draft" :title="drill.data.value.title" />

      <template v-else>
        <!-- Tools -->
        <div class="editor__tools" role="group" :aria-label="t('board.toolsLabel')">
          <button
            v-for="item in tools"
            :key="item.value"
            type="button"
            class="editor__tool"
            :class="{ 'editor__tool--on': tool === item.value }"
            :aria-pressed="tool === item.value"
            @click="tool = item.value"
          >
            <span aria-hidden="true">{{ item.icon }}</span>
            {{ item.label }}
          </button>
        </div>
        <p class="editor__hint">{{ t(`board.toolHints.${tool}`) }}</p>

        <BoardScene
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

        <!-- Timeline -->
        <section class="editor__timeline" :aria-label="t('board.timeline')">
          <div class="editor__keyframes">
            <button
              v-for="(k, index) in draft.keyframes"
              :key="index"
              type="button"
              class="editor__keyframe"
              :class="{ 'editor__keyframe--on': index === keyframeIndex }"
              :aria-pressed="index === keyframeIndex"
              :aria-label="t('board.keyframeLabel', { n: index + 1, s: seconds(k.t) })"
              @click="keyframeIndex = index"
            >
              <span class="editor__keyframe-n">{{ index + 1 }}</span>
              <span>{{ seconds(k.t) }} s</span>
            </button>
            <button
              type="button"
              class="editor__keyframe editor__keyframe--add"
              @click="newKeyframe"
            >
              + {{ t('board.addKeyframe') }}
            </button>
          </div>
          <div class="editor__timing">
            <label v-if="keyframeIndex > 0">
              {{ t('board.keyframeTime') }}
              <input v-model.lazy="keyframeSeconds" type="number" step="0.1" min="0" />
            </label>
            <label>
              {{ t('board.duration') }}
              <input v-model.lazy="durationSeconds" type="number" step="0.5" min="0.5" max="60" />
            </label>
            <BaseButton v-if="keyframeIndex > 0" variant="ghost" @click="deleteKeyframe">
              {{ t('board.removeKeyframe') }}
            </BaseButton>
          </div>
          <p class="editor__hint">{{ t('board.keyframeHint') }}</p>
        </section>

        <!-- Add objects -->
        <section class="editor__add" :aria-label="t('board.addLabel')">
          <div class="editor__colors" role="group" :aria-label="t('board.playerColor')">
            <button
              v-for="c in PLAYER_COLORS"
              :key="c.key"
              type="button"
              class="editor__color"
              :style="{ '--swatch': c.hex }"
              :class="{ 'editor__color--on': playerColor === c.hex }"
              :aria-pressed="playerColor === c.hex"
              :aria-label="t(`groups.colors.${c.key}`)"
              @click="playerColor = c.hex"
            />
          </div>
          <div class="editor__add-buttons">
            <BaseButton @click="add('player')">+ {{ t('board.objects.player') }}</BaseButton>
            <BaseButton variant="secondary" @click="add('ball')"
              >+ {{ t('board.objects.ball') }}</BaseButton
            >
            <BaseButton variant="secondary" @click="add('cone')"
              >+ {{ t('board.objects.cone') }}</BaseButton
            >
            <BaseButton variant="secondary" @click="add('goal')"
              >+ {{ t('board.objects.goal') }}</BaseButton
            >
          </div>
        </section>

        <BaseChipGroup v-model="field" :label="t('board.field')" :options="fieldOptions" />
      </template>

      <p class="visually-hidden" aria-live="polite">{{ announcement }}</p>
      <p v-if="validationError" class="editor__error" role="alert">{{ validationError }}</p>
      <p v-if="save.isError.value" class="editor__error" role="alert">
        {{ t('board.saveFailed') }}
      </p>

      <div class="editor__savebar">
        <BaseButton
          size="lg"
          block
          :disabled="!dirty"
          :loading="save.isPending.value"
          @click="saveDraft"
        >
          {{ dirty ? t('board.save') : `✓ ${t('groups.savedState')}` }}
        </BaseButton>
        <BaseButton
          v-if="drill.data.value.animation"
          variant="ghost"
          block
          :loading="save.isPending.value"
          @click="removeAnimation"
        >
          {{ t('board.removeAnimation') }}
        </BaseButton>
      </div>
    </template>
  </section>
</template>

<style scoped lang="scss">
.editor {
  display: flex;
  flex-direction: column;
  gap: $space-3;

  &__back {
    @include focus-visible;

    display: inline-flex;
    align-items: center;
    min-height: $touch-target;
    font-weight: 600;
    text-decoration: none;
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
    font-weight: 700;

    &--on {
      background: var(--color-surface);
      box-shadow: var(--shadow-sm);
    }
  }

  &__tools {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: $space-1;
  }

  &__tool {
    @include touch-target;
    @include focus-visible;

    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: $space-1;
    border: 2px solid var(--color-border);
    border-radius: $radius-md;
    background: var(--color-surface);
    font-size: $font-xs;
    font-weight: 700;

    span {
      font-size: $font-lg;
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
      font-size: $font-md;

      &:focus-visible {
        @include focus-ring;
      }
    }
  }

  &__add {
    display: flex;
    flex-direction: column;
    gap: $space-2;
  }

  &__colors {
    display: flex;
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

  &__add-buttons {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: $space-2;

    @include from($bp-sm) {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  &__savebar {
    display: flex;
    flex-direction: column;
    gap: $space-2;
    margin-top: $space-2;
  }

  &__error {
    color: var(--color-danger);
  }
}

.visually-hidden {
  @include visually-hidden;
}
</style>
