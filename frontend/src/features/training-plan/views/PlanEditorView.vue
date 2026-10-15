<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { VueDraggable } from 'vue-draggable-plus'
import ActionBar from '@/ui/ActionBar.vue'
import BottomSheet from '@/ui/BottomSheet.vue'
import OverflowMenu, { type OverflowItem } from '@/ui/OverflowMenu.vue'
import UiButton from '@/ui/UiButton.vue'
import UiIcon from '@/ui/UiIcon.vue'
import UiSkeleton from '@/ui/UiSkeleton.vue'
import UiStepper from '@/ui/UiStepper.vue'
import { useSnackbar } from '@/ui/useSnackbar'
import { useActiveTeam } from '@/features/teams/composables/useActiveTeam'
import type { Drill } from '@/features/drills/logic'
import EventCoachNav from '@/features/events/components/EventCoachNav.vue'
import { useEventFormat } from '@/features/events/format'
import { useEvent, useMyMember } from '@/features/events/composables/useEvents'
import { useEventGroups } from '@/features/groups/composables/useGroups'
import SaveAsTemplateModal from '@/features/templates/components/SaveAsTemplateModal.vue'
import TemplatePickerModal from '@/features/templates/components/TemplatePickerModal.vue'
import CopyPlanModal from '../components/CopyPlanModal.vue'
import DrillPickerModal from '../components/DrillPickerModal.vue'
import LateDeclines from '../components/LateDeclines.vue'
import {
  durationFit,
  eventMinutes,
  itemMinutes,
  moveItem,
  planTotalMinutes,
  type PlanItem,
} from '../logic'
import {
  useAddPlanDrill,
  usePlan,
  useRemovePlanItem,
  useReorderPlan,
  useSetPlanStatus,
  useUpdatePlanItem,
} from '../composables/usePlan'

/**
 * Plan editor (layout "A" in the tactics board look): total time with bar on top, compact
 * drill rows with drag handle, minute stepper and "⋯", one main action "Übung hinzufügen",
 * and "Veröffentlichen" in a fixed bar that is always in reach.
 */
const props = defineProps<{ eventId: string }>()

const { t } = useI18n()
const router = useRouter()
const fmt = useEventFormat()
const snackbar = useSnackbar()
const event = useEvent(() => props.eventId)
const plan = usePlan(() => props.eventId)
const teamId = computed(() => event.data.value?.team_id ?? null)
const { members } = useMyMember(teamId)
const { myTeams } = useActiveTeam()

const addDrill = useAddPlanDrill()
const updateItem = useUpdatePlanItem()
const removeItem = useRemovePlanItem()
const reorder = useReorderPlan(() => props.eventId)
const setStatus = useSetPlanStatus()

const isCoach = computed(() => {
  const team = myTeams.data.value?.find((x) => x.team_id === teamId.value)
  return !!team && (team.team_role === 'coach' || team.is_club_admin)
})
const groups = useEventGroups(() => props.eventId, isCoach)
const groupColors = computed(
  () => new Map((groups.data.value ?? []).map((ed) => [ed.id, ed.groups.map((g) => g.color)])),
)

const pickerOpen = ref(false)
const copyOpen = ref(false)
const templateOpen = ref(false)
const saveTemplateOpen = ref(false)
const announcement = ref('')

// Local copy for drag & drop and instant minute changes; refreshed from the server.
// Shallow: the list is always replaced as a whole (and drill animations are deep JSON).
const items = shallowRef<PlanItem[]>([])
watch(
  () => plan.data.value,
  (data) => {
    items.value = data ? [...data] : []
  },
  { immediate: true },
)

const e = computed(() => event.data.value)
const total = computed(() => planTotalMinutes(items.value))
const available = computed(() => (e.value ? eventMinutes(e.value) : null))
const fit = computed(() => durationFit(total.value, available.value))
const fillPercent = computed(() =>
  available.value ? Math.min(100, Math.round((total.value / available.value) * 100)) : 0,
)
const isPublished = computed(() => e.value?.plan_status === 'published')
const anyPending = computed(
  () => addDrill.isPending.value || removeItem.isPending.value || reorder.isPending.value,
)

function failed() {
  snackbar.show({ text: t('plan.saveFailed'), tone: 'error' })
}

function saveOrder() {
  reorder.mutate(items.value, { onError: failed })
}

function move(index: number, direction: -1 | 1) {
  const target = index + direction
  const moved = items.value[index]
  items.value = moveItem(items.value, index, target)
  if (moved && items.value[target] === moved) {
    announcement.value = t('plan.moved', { title: moved.drill.title, position: target + 1 })
    saveOrder()
  }
}

function onPick(drill: Drill) {
  addDrill.mutate(
    {
      eventId: props.eventId,
      drillId: drill.id,
      position: (items.value.at(-1)?.position ?? 0) + 1,
      durationMin: null,
    },
    { onError: failed },
  )
}

// Minutes: the stepper changes the number at once, saving waits for a short pause.
const timers = new Map<string, ReturnType<typeof setTimeout>>()
function setMinutes(item: PlanItem, minutes: number) {
  items.value = items.value.map((i) => (i.id === item.id ? { ...i, duration_min: minutes } : i))
  clearTimeout(timers.get(item.id))
  timers.set(
    item.id,
    setTimeout(() => {
      updateItem.mutate({ itemId: item.id, patch: { duration_min: minutes } }, { onError: failed })
    }, 600),
  )
}

// Notes in a sheet.
const notesFor = ref<PlanItem | null>(null)
const notesText = ref('')
const notesOpen = computed({
  get: () => !!notesFor.value,
  set: (value) => {
    if (!value) notesFor.value = null
  },
})
function openNotes(item: PlanItem) {
  notesFor.value = item
  notesText.value = item.coach_notes ?? ''
}
function saveNotes() {
  const item = notesFor.value
  if (!item) return
  const notes = notesText.value.trim() || null
  notesFor.value = null
  if (notes !== item.coach_notes)
    updateItem.mutate({ itemId: item.id, patch: { coach_notes: notes } }, { onError: failed })
}

function remove(item: PlanItem) {
  removeItem.mutate(item.id, {
    onError: failed,
    onSuccess: () =>
      snackbar.show({
        text: t('plan.removed', { title: item.drill.title }),
        action: {
          label: t('ui.undo'),
          run: () =>
            addDrill.mutate(
              {
                eventId: props.eventId,
                drillId: item.drill.id,
                position: item.position,
                durationMin: item.duration_min,
              },
              { onError: failed },
            ),
        },
      }),
  })
}

type RowAction = 'up' | 'down' | 'notes' | 'groups' | 'open' | 'remove'
function rowActions(item: PlanItem, index: number): OverflowItem<RowAction>[] {
  return [
    {
      key: 'up',
      label: t('plan.moveUpShort'),
      icon: 'arrowUp',
      disabled: index === 0 || anyPending.value,
    },
    {
      key: 'down',
      label: t('plan.moveDownShort'),
      icon: 'chevronDown',
      disabled: index === items.value.length - 1 || anyPending.value,
    },
    {
      key: 'notes',
      label: item.coach_notes ? t('plan.notesEdit') : t('plan.notesAdd'),
      icon: 'note',
    },
    { key: 'groups', label: t('groups.assign'), icon: 'shirt' },
    { key: 'open', label: t('plan.openDrill'), icon: 'play' },
    { key: 'remove', label: t('plan.removeShort'), icon: 'trash', danger: true },
  ]
}
function onRowAction(item: PlanItem, index: number, action: RowAction) {
  if (action === 'up') move(index, -1)
  else if (action === 'down') move(index, 1)
  else if (action === 'notes') openNotes(item)
  else if (action === 'groups')
    void router.push({
      name: 'event-groups',
      params: { eventId: props.eventId },
      query: { drill: item.id },
    })
  else if (action === 'open')
    void router.push({ name: 'drill', params: { drillId: item.drill.id } })
  else remove(item)
}

type PlanAction = 'copy' | 'template' | 'saveTemplate'
const planActions = computed<OverflowItem<PlanAction>[]>(() => [
  { key: 'copy', label: t('plan.copyFrom'), icon: 'copy' },
  { key: 'template', label: t('templates.fromTemplate'), icon: 'note' },
  ...(items.value.length
    ? [{ key: 'saveTemplate' as const, label: t('templates.saveAs'), icon: 'star' as const }]
    : []),
])
function onPlanAction(action: PlanAction) {
  if (action === 'copy') copyOpen.value = true
  else if (action === 'template') templateOpen.value = true
  else saveTemplateOpen.value = true
}

function togglePublish() {
  setStatus.mutate(
    { eventId: props.eventId, status: isPublished.value ? 'draft' : 'published' },
    { onError: failed },
  )
}
</script>

<template>
  <section class="plan">
    <div
      v-if="event.isPending.value || plan.isPending.value"
      aria-busy="true"
      class="plan__loading"
    >
      <h1 class="visually-hidden">{{ t('plan.title') }}</h1>
      <UiSkeleton shape="block" height="48px" />
      <UiSkeleton v-for="n in 3" :key="n" shape="block" height="72px" />
    </div>
    <p v-else-if="event.isError.value || !e" class="plan__error" role="alert">
      {{ t('events.loadFailedOne') }}
    </p>
    <p v-else-if="!isCoach" role="alert">{{ t('plan.coachOnly') }}</p>

    <template v-else>
      <EventCoachNav :event-id="eventId" active="event-plan" />

      <header class="plan__head">
        <div class="plan__titles">
          <p class="plan__eyebrow">
            {{ t('events.training') }} · {{ fmt.weekdayShort(e.starts_at) }}
            {{ fmt.dayMonth(e.starts_at) }}
          </p>
          <h1 class="plan__title">{{ t('plan.title') }}</h1>
        </div>
        <OverflowMenu
          :items="planActions"
          :title="t('plan.moreTitle')"
          :label="t('plan.moreTitle')"
          @select="onPlanAction"
        />
      </header>

      <LateDeclines v-if="members.data.value" :event="e" :members="members.data.value" />

      <div class="plan__duration" :class="`plan__duration--${fit}`">
        <div class="plan__duration-text">
          <strong class="plan__total">{{ t('plan.total', { n: total }) }}</strong>
          <span v-if="available !== null" class="plan__fit">
            {{ t('plan.ofAvailable', { n: available }) }} · {{ t(`plan.fit.${fit}`) }}
          </span>
        </div>
        <div
          v-if="available !== null"
          class="plan__bar"
          role="progressbar"
          :aria-valuenow="total"
          aria-valuemin="0"
          :aria-valuemax="available"
          :aria-label="t('plan.durationLabel')"
        >
          <span class="plan__bar-fill" :style="{ width: `${fillPercent}%` }" />
        </div>
      </div>

      <VueDraggable
        v-if="items.length"
        v-model="items"
        tag="ol"
        class="plan__list"
        handle=".plan-item__handle"
        :animation="150"
        @end="saveOrder"
      >
        <li v-for="(item, index) in items" :key="item.id" class="plan-item">
          <span class="plan-item__handle" :title="t('plan.dragHandle')" aria-hidden="true">
            <UiIcon name="grip" :size="20" />
          </span>
          <div class="plan-item__main">
            <span class="plan-item__title">
              <span class="plan-item__index">{{ index + 1 }}.</span> {{ item.drill.title }}
            </span>
            <span class="plan-item__meta">
              {{ t(`drills.categories.${item.drill.category}`) }}
              <span
                v-if="groupColors.get(item.id)?.length"
                class="plan-item__groups"
                role="img"
                :aria-label="t('groups.groupCount', groupColors.get(item.id)!.length)"
              >
                <span
                  v-for="(color, i) in groupColors.get(item.id)"
                  :key="i"
                  class="plan-item__swatch"
                  :style="{ background: `var(--bib-${color})` }"
                />
              </span>
            </span>
            <span v-if="item.coach_notes" class="plan-item__note">
              <UiIcon name="note" :size="14" />{{ item.coach_notes }}
            </span>
          </div>
          <UiStepper
            :model-value="itemMinutes(item)"
            :label="t('plan.minutesFor', { title: item.drill.title })"
            :min="5"
            :max="180"
            @update:model-value="setMinutes(item, $event)"
          />
          <OverflowMenu
            :items="rowActions(item, index)"
            :title="item.drill.title"
            :label="t('plan.actionsFor', { title: item.drill.title })"
            @select="onRowAction(item, index, $event)"
          />
        </li>
      </VueDraggable>

      <p v-else class="plan__empty">{{ t('plan.empty') }}</p>

      <button
        type="button"
        class="plan__add"
        :disabled="addDrill.isPending.value"
        @click="pickerOpen = true"
      >
        <UiIcon name="plus" :size="22" :stroke-width="2.6" />
        {{ t('plan.addDrill') }}
      </button>
      <p class="plan__hint">{{ t('plan.moreHint') }}</p>

      <p class="visually-hidden" aria-live="polite">{{ announcement }}</p>

      <ActionBar :label="t('plan.statusLabel')">
        <span class="plan__status">
          <span class="plan__status-title">
            <span class="plan__dot" :class="{ 'plan__dot--on': isPublished }" aria-hidden="true" />
            {{ isPublished ? t('plan.published') : t('plan.draft') }}
          </span>
          <span class="plan__status-hint">
            {{ isPublished ? t('plan.publishedShort') : t('plan.draftShort') }}
          </span>
        </span>
        <UiButton
          :variant="isPublished ? 'secondary' : 'primary'"
          :disabled="!items.length"
          :loading="setStatus.isPending.value"
          @click="togglePublish"
        >
          {{ isPublished ? t('plan.unpublish') : t('plan.publish') }}
        </UiButton>
      </ActionBar>

      <BottomSheet
        v-model:open="notesOpen"
        :title="t('plan.notesFor', { title: notesFor?.drill.title ?? '' })"
      >
        <label class="plan__notes">
          <span class="visually-hidden">{{ t('plan.notesLabel') }}</span>
          <textarea
            v-model="notesText"
            rows="4"
            maxlength="1000"
            :placeholder="t('plan.notesPlaceholder')"
          />
        </label>
        <template #footer>
          <UiButton variant="secondary" @click="notesFor = null">{{ t('common.cancel') }}</UiButton>
          <UiButton @click="saveNotes">{{ t('common.save') }}</UiButton>
        </template>
      </BottomSheet>

      <DrillPickerModal
        v-if="teamId"
        v-model:open="pickerOpen"
        :team-id="teamId"
        :used-drill-ids="items.map((i) => i.drill.id)"
        @pick="onPick"
      />
      <TemplatePickerModal
        v-if="teamId"
        v-model:open="templateOpen"
        :team-id="teamId"
        :event-id="eventId"
        @applied="(n) => snackbar.show({ text: t('plan.copied', n) })"
      />
      <SaveAsTemplateModal
        v-model:open="saveTemplateOpen"
        :event-id="eventId"
        @created="snackbar.show({ text: t('templates.savedAs') })"
      />
      <CopyPlanModal
        v-if="teamId"
        v-model:open="copyOpen"
        :team-id="teamId"
        :target-event-id="eventId"
        @copied="(n) => snackbar.show({ text: t('plan.copied', n) })"
      />
    </template>
  </section>
</template>

<style scoped lang="scss">
.plan {
  display: flex;
  flex-direction: column;
  gap: $space-4;

  &__loading {
    display: flex;
    flex-direction: column;
    gap: $space-2;
  }

  &__head {
    display: flex;
    align-items: flex-start;
    gap: $space-2;
  }

  &__titles {
    flex: 1;
  }

  &__eyebrow {
    color: var(--color-training-text);
    font-size: $font-sm;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  &__duration {
    --fit-color: var(--color-text-muted);

    display: flex;
    flex-direction: column;
    gap: $space-2;

    &--under {
      --fit-color: var(--color-maybe);
    }

    &--fits {
      --fit-color: var(--color-yes);
    }

    &--over {
      --fit-color: var(--color-no);
    }
  }

  &__duration-text {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: $space-1 $space-3;
  }

  &__total {
    font-family: var(--font-display);
    font-size: $font-3xl;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }

  &__fit {
    color: var(--color-text-muted);
    font-size: $font-sm;
    font-weight: 700;
  }

  &__bar {
    height: 10px;
    overflow: hidden;
    border-radius: $radius-full;
    background: var(--color-surface-muted);
  }

  &__bar-fill {
    display: block;
    height: 100%;
    border-radius: $radius-full;
    background: var(--fit-color);
    transition: width var(--duration-medium) var(--ease-out);
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: $space-2;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__empty,
  &__hint {
    color: var(--color-text-muted);
    font-size: $font-sm;
    text-align: center;
  }

  &__add {
    @include focus-visible;

    display: flex;
    align-items: center;
    justify-content: center;
    gap: $space-2;
    min-height: 60px;
    border: 2px dashed var(--color-chalk);
    border-radius: $radius-xl;
    background: transparent;
    color: var(--color-text);
    font-size: $font-md;
    font-weight: 800;

    :deep(.ui-icon) {
      color: var(--color-primary);
    }

    &:disabled {
      opacity: 0.6;
    }
  }

  &__status {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    line-height: 1.25;
  }

  &__status-title {
    display: flex;
    align-items: center;
    gap: $space-2;
    font-weight: 800;
  }

  &__status-hint {
    color: var(--color-text-muted);
    font-size: $font-sm;
  }

  &__dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--color-maybe);

    &--on {
      background: var(--color-yes);
    }
  }

  &__notes textarea {
    width: 100%;
    padding: $space-3;
    border: 2px solid var(--color-border);
    border-radius: $radius-lg;
    background: var(--color-surface);
    color: var(--color-text);
    font: inherit;
    resize: vertical;

    &:focus-visible {
      @include focus-ring;
    }
  }

  &__error {
    color: var(--color-danger);
  }
}

.plan-item {
  display: flex;
  align-items: center;
  gap: $space-1;
  padding: $space-2 $space-1 $space-2 0;
  border-radius: $radius-lg;
  background: var(--color-surface);

  &__handle {
    display: grid;
    flex-shrink: 0;
    place-items: center;
    width: 32px;
    height: $touch-target;
    color: var(--color-text-muted);
    cursor: grab;
    touch-action: none;
  }

  &__main {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  &__title {
    font-weight: 800;
    line-height: 1.2;
  }

  &__index {
    color: var(--color-text-muted);
  }

  &__meta {
    display: flex;
    align-items: center;
    gap: $space-2;
    color: var(--color-text-muted);
    font-size: $font-sm;
  }

  &__groups {
    display: inline-flex;
    gap: 3px;
  }

  &__swatch {
    width: 12px;
    height: 12px;
    border: 1px solid var(--color-text);
    border-radius: 3px;
  }

  &__note {
    display: flex;
    align-items: center;
    gap: $space-1;
    color: var(--color-text-muted);
    font-size: $font-xs;

    @include truncate;
  }
}
</style>
