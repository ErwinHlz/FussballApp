<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { VueDraggable } from 'vue-draggable-plus'
import AppIcon from '@/components/AppIcon.vue'
import BaseBadge from '@/components/BaseBadge.vue'
import BaseButton from '@/components/BaseButton.vue'
import BaseCard from '@/components/BaseCard.vue'
import { useActiveTeam } from '@/features/teams/composables/useActiveTeam'
import type { Drill } from '@/features/drills/logic'
import { useEventFormat } from '@/features/events/format'
import { useEvent, useMyMember } from '@/features/events/composables/useEvents'
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

const props = defineProps<{ eventId: string }>()

const { t } = useI18n()
const fmt = useEventFormat()
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

const pickerOpen = ref(false)
const copyOpen = ref(false)
const openNotes = ref<string | null>(null)
const announcement = ref('')

const isCoach = computed(() => {
  const team = myTeams.data.value?.find((x) => x.team_id === teamId.value)
  return !!team && (team.team_role === 'coach' || team.is_club_admin)
})

// Local copy for drag & drop; refreshed whenever the server data changes.
const items = ref<PlanItem[]>([])
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
const anyError = computed(
  () =>
    addDrill.isError.value ||
    updateItem.isError.value ||
    removeItem.isError.value ||
    reorder.isError.value ||
    setStatus.isError.value,
)

function saveOrder() {
  reorder.mutate(items.value)
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
  addDrill.mutate({
    eventId: props.eventId,
    drillId: drill.id,
    position: (items.value.at(-1)?.position ?? 0) + 1,
    durationMin: null,
  })
}

function onDurationChange(item: PlanItem, value: string) {
  const minutes = value.trim() === '' ? null : Math.min(180, Math.max(1, Number(value)))
  if (Number.isNaN(minutes)) return
  updateItem.mutate({ itemId: item.id, patch: { duration_min: minutes } })
}

function onNotesBlur(item: PlanItem, value: string) {
  const notes = value.trim() || null
  if (notes !== item.coach_notes)
    updateItem.mutate({ itemId: item.id, patch: { coach_notes: notes } })
}

function togglePublish() {
  setStatus.mutate({ eventId: props.eventId, status: isPublished.value ? 'draft' : 'published' })
}
</script>

<template>
  <section class="plan">
    <p v-if="event.isPending.value || plan.isPending.value">{{ t('common.loading') }}</p>
    <p v-else-if="event.isError.value || !e" class="plan__error" role="alert">
      {{ t('events.loadFailedOne') }}
    </p>
    <p v-else-if="!isCoach" role="alert">{{ t('plan.coachOnly') }}</p>

    <template v-else>
      <header class="plan__header">
        <RouterLink :to="{ name: 'event', params: { eventId } }" class="plan__back">
          ‹ {{ t('plan.backToEvent') }}
        </RouterLink>
        <h1>{{ t('plan.title') }}</h1>
        <p class="plan__when">{{ fmt.longDay(e.starts_at) }} · {{ fmt.timeRange(e) }}</p>
      </header>

      <BaseCard class="plan__status">
        <div class="plan__status-row">
          <BaseBadge :tone="isPublished ? 'success' : 'warning'">
            {{ isPublished ? t('plan.published') : t('plan.draft') }}
          </BaseBadge>
          <span v-if="isPublished && e.plan_published_at" class="plan__muted">
            {{ t('plan.publishedAt', { date: fmt.dateTime(e.plan_published_at) }) }}
          </span>
        </div>
        <p class="plan__muted">{{ isPublished ? t('plan.publishedHint') : t('plan.draftHint') }}</p>
        <BaseButton
          :variant="isPublished ? 'secondary' : 'primary'"
          block
          :disabled="!items.length"
          :loading="setStatus.isPending.value"
          @click="togglePublish"
        >
          {{ isPublished ? t('plan.unpublish') : t('plan.publish') }}
        </BaseButton>
      </BaseCard>

      <LateDeclines v-if="members.data.value" :event="e" :members="members.data.value" />

      <div class="plan__duration" :class="`plan__duration--${fit}`">
        <div class="plan__duration-text">
          <strong>{{ t('plan.total', { n: total }) }}</strong>
          <span v-if="available !== null">
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
          <div class="plan-item__row">
            <span class="plan-item__handle" :title="t('plan.dragHandle')" aria-hidden="true"
              >⋮⋮</span
            >
            <span class="plan-item__index">{{ index + 1 }}</span>
            <span class="plan-item__main">
              <RouterLink
                :to="{ name: 'drill', params: { drillId: item.drill.id } }"
                class="plan-item__title"
              >
                {{ item.drill.title }}
              </RouterLink>
              <span class="plan__muted">{{ t(`drills.categories.${item.drill.category}`) }}</span>
            </span>
            <label class="plan-item__minutes">
              <span class="visually-hidden">{{
                t('plan.minutesFor', { title: item.drill.title })
              }}</span>
              <input
                type="number"
                inputmode="numeric"
                min="1"
                max="180"
                :value="item.duration_min ?? ''"
                :placeholder="String(item.drill.duration_min ?? '')"
                @change="onDurationChange(item, ($event.target as HTMLInputElement).value)"
              />
              <span aria-hidden="true">{{ t('plan.min') }}</span>
            </label>
          </div>

          <div class="plan-item__actions">
            <button
              type="button"
              class="plan-item__action"
              :disabled="index === 0 || anyPending"
              :aria-label="t('plan.moveUp', { title: item.drill.title })"
              @click="move(index, -1)"
            >
              ↑
            </button>
            <button
              type="button"
              class="plan-item__action"
              :disabled="index === items.length - 1 || anyPending"
              :aria-label="t('plan.moveDown', { title: item.drill.title })"
              @click="move(index, 1)"
            >
              ↓
            </button>
            <button
              type="button"
              class="plan-item__action plan-item__action--text"
              :aria-expanded="openNotes === item.id"
              @click="openNotes = openNotes === item.id ? null : item.id"
            >
              {{ item.coach_notes ? t('plan.notesEdit') : t('plan.notesAdd') }}
            </button>
            <RouterLink
              class="plan-item__action plan-item__action--text plan-item__action--link"
              :to="{ name: 'event-groups', params: { eventId }, query: { drill: item.id } }"
            >
              {{ t('groups.short') }}
            </RouterLink>
            <span class="plan__muted plan-item__effective">
              {{ t('plan.minutesShort', { n: itemMinutes(item) }) }}
            </span>
            <button
              type="button"
              class="plan-item__action plan-item__action--danger"
              :aria-label="t('plan.remove', { title: item.drill.title })"
              :disabled="anyPending"
              @click="removeItem.mutate(item.id)"
            >
              <AppIcon name="x" :size="18" />
            </button>
          </div>

          <label v-if="openNotes === item.id" class="plan-item__notes">
            <span class="visually-hidden">{{ t('plan.notesLabel') }}</span>
            <textarea
              rows="3"
              maxlength="1000"
              :value="item.coach_notes ?? ''"
              :placeholder="t('plan.notesPlaceholder')"
              @blur="onNotesBlur(item, ($event.target as HTMLTextAreaElement).value)"
            />
          </label>
          <p v-else-if="item.coach_notes" class="plan-item__note-preview">{{ item.coach_notes }}</p>
        </li>
      </VueDraggable>

      <p v-else class="plan__muted plan__empty">{{ t('plan.empty') }}</p>

      <p class="visually-hidden" aria-live="polite">{{ announcement }}</p>
      <p v-if="anyError" class="plan__error" role="alert">{{ t('plan.saveFailed') }}</p>

      <div class="plan__add">
        <BaseButton block :loading="addDrill.isPending.value" @click="pickerOpen = true">
          <template #icon><AppIcon name="plus" :size="18" /></template>
          {{ t('plan.addDrill') }}
        </BaseButton>
        <BaseButton variant="secondary" block @click="copyOpen = true">
          <template #icon><AppIcon name="copy" :size="18" /></template>
          {{ t('plan.copyFrom') }}
        </BaseButton>
      </div>

      <DrillPickerModal
        v-if="teamId"
        v-model:open="pickerOpen"
        :team-id="teamId"
        :used-drill-ids="items.map((i) => i.drill.id)"
        @pick="onPick"
      />
      <CopyPlanModal
        v-if="teamId"
        v-model:open="copyOpen"
        :team-id="teamId"
        :target-event-id="eventId"
        @copied="(n) => (announcement = t('plan.copied', n))"
      />
    </template>
  </section>
</template>

<style scoped lang="scss">
.plan {
  display: flex;
  flex-direction: column;
  gap: $space-4;

  &__back {
    @include focus-visible;

    display: inline-flex;
    align-items: center;
    min-height: $touch-target;
    font-weight: 600;
    text-decoration: none;
  }

  &__when {
    font-weight: 600;
    color: var(--color-text-muted);
  }

  &__status {
    display: flex;
    flex-direction: column;
    gap: $space-2;
  }

  &__status-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: $space-2;
  }

  &__duration {
    --fit-color: var(--color-text-muted);

    display: flex;
    flex-direction: column;
    gap: $space-2;

    &--fits {
      --fit-color: var(--color-success);
    }

    &--under {
      --fit-color: var(--color-warning);
    }

    &--over {
      --fit-color: var(--color-danger);
    }
  }

  &__duration-text {
    display: flex;
    flex-wrap: wrap;
    gap: $space-2;
    align-items: baseline;

    span {
      font-size: $font-sm;
      font-weight: 600;
      color: var(--fit-color);
    }
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
    background: var(--fit-color);
    transition: width 0.2s ease;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: $space-2;
    padding: 0;
    list-style: none;
  }

  &__empty {
    padding: $space-5 0;
    text-align: center;
  }

  &__add {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: $space-2;
  }

  &__muted {
    font-size: $font-sm;
    color: var(--color-text-muted);
  }

  &__error {
    color: var(--color-danger);
  }
}

.plan-item {
  display: flex;
  flex-direction: column;
  gap: $space-2;
  padding: $space-2 $space-3;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: $radius-lg;
  box-shadow: var(--shadow-sm);

  &__row {
    display: flex;
    align-items: center;
    gap: $space-2;
  }

  &__handle {
    display: grid;
    place-items: center;
    width: 32px;
    min-height: $touch-target;
    color: var(--color-text-muted);
    font-weight: 800;
    letter-spacing: -2px;
    cursor: grab;
    touch-action: none;
  }

  &__index {
    display: grid;
    flex-shrink: 0;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: $radius-full;
    background: var(--color-training);
    color: #fff;
    font-size: $font-sm;
    font-weight: 800;
  }

  &__main {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }

  &__title {
    font-weight: 700;
    color: inherit;
    overflow-wrap: anywhere;
  }

  &__minutes {
    display: flex;
    align-items: center;
    gap: $space-1;
    font-size: $font-sm;
    color: var(--color-text-muted);

    input {
      width: 56px;
      min-height: $touch-target;
      padding: $space-1;
      border: 2px solid var(--color-border);
      border-radius: $radius-md;
      font-size: $font-md;
      text-align: center;

      &:focus-visible {
        @include focus-ring;
      }
    }
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: $space-1;
  }

  &__action {
    @include touch-target;
    @include focus-visible;

    padding: 0 $space-2;
    border: 1px solid var(--color-border);
    border-radius: $radius-md;
    background: var(--color-surface);
    font-weight: 700;

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    &--text {
      font-size: $font-sm;
      font-weight: 600;
    }

    &--link {
      display: inline-flex;
      align-items: center;
      color: inherit;
      text-decoration: none;
    }

    &--danger {
      margin-left: auto;
      color: var(--color-danger);
    }
  }

  &__effective {
    margin-left: $space-2;
  }

  &__notes textarea {
    width: 100%;
    padding: $space-2;
    border: 2px solid var(--color-border);
    border-radius: $radius-md;
    font-size: $font-md;

    &:focus-visible {
      @include focus-ring;
    }
  }

  &__note-preview {
    font-size: $font-sm;
    color: var(--color-text-muted);
    white-space: pre-line;
  }
}

.visually-hidden {
  @include visually-hidden;
}
</style>
