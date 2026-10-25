<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { VueDraggable } from 'vue-draggable-plus'
import UiIcon from '@/ui/UiIcon.vue'
import UiButton from '@/ui/UiButton.vue'
import UiCard from '@/ui/UiCard.vue'
import UiInput from '@/ui/UiInput.vue'
import UiTextarea from '@/ui/UiTextarea.vue'
import type { Drill } from '@/features/drills/logic'
import { useActiveTeam } from '@/features/teams/composables/useActiveTeam'
import DrillPickerModal from '@/features/training-plan/components/DrillPickerModal.vue'
import { moveItem } from '@/features/training-plan/logic'
import type { TemplateItem } from '../api'
import ApplyTemplateModal from '../components/ApplyTemplateModal.vue'
import {
  useAddTemplateDrill,
  useDeleteTemplate,
  useRemoveTemplateItem,
  useReorderTemplate,
  useTemplate,
  useTemplateItems,
  useUpdateTemplate,
  useUpdateTemplateItem,
} from '../composables/useTemplates'
import PageProblem from '@/ui/PageProblem.vue'

const props = defineProps<{ templateId: string }>()

const { t } = useI18n()
const router = useRouter()
const { activeTeam, myTeams, isCoach } = useActiveTeam()
const template = useTemplate(() => props.templateId)
const itemsQuery = useTemplateItems(() => props.templateId)

const updateTemplate = useUpdateTemplate()
const deleteTemplate = useDeleteTemplate()
const addDrill = useAddTemplateDrill()
const updateItem = useUpdateTemplateItem()
const removeItem = useRemoveTemplateItem()
const reorder = useReorderTemplate()

const tpl = computed(() => template.data.value)
/** Coaches of the owning team edit; coaches of other club teams only use shared templates. */
const canEdit = computed(() => {
  const team = myTeams.data.value?.find((x) => x.team_id === tpl.value?.team_id)
  return !!team && (team.team_role === 'coach' || team.is_club_admin)
})

// Meta form
const title = ref('')
const description = ref('')
const shared = ref(false)
const titleError = ref<string | undefined>()
const metaSaved = ref(false)
// Server values fill the form, but a background refetch (e.g. after adding a drill) must not
// overwrite what the coach is typing: only untouched fields follow the server.
let loaded: { title: string; description: string; shared: boolean } | null = null
watch(
  tpl,
  (value) => {
    if (!value) return
    const untouched = (key: 'title' | 'description' | 'shared', current: unknown) =>
      !loaded || current === loaded[key]
    if (untouched('title', title.value)) title.value = value.title
    if (untouched('description', description.value)) description.value = value.description
    if (untouched('shared', shared.value)) shared.value = value.shared
    loaded = { title: value.title, description: value.description, shared: value.shared }
  },
  { immediate: true },
)
const metaDirty = computed(
  () =>
    !!tpl.value &&
    (title.value.trim() !== tpl.value.title ||
      description.value.trim() !== tpl.value.description ||
      shared.value !== tpl.value.shared),
)

async function saveMeta() {
  const value = title.value.trim()
  if (value.length < 2 || value.length > 80) {
    titleError.value = value.length < 2 ? t('validation.minLength2') : t('validation.maxLength80')
    return
  }
  titleError.value = undefined
  metaSaved.value = false
  await updateTemplate.mutateAsync({
    templateId: props.templateId,
    patch: { title: value, description: description.value.trim(), shared: shared.value },
  })
  metaSaved.value = true
}

// Items: local copy for drag & drop.
const items = ref<TemplateItem[]>([])
watch(
  () => itemsQuery.data.value,
  (data) => {
    items.value = data ? [...data] : []
  },
  { immediate: true },
)
const minutes = (item: TemplateItem) => item.duration_min ?? item.drill_duration_min ?? 0
const total = computed(() => items.value.reduce((sum, item) => sum + minutes(item), 0))
const openNotes = ref<string | null>(null)
const pickerOpen = ref(false)
const applyOpen = ref(false)
const confirmDelete = ref(false)
const announcement = ref('')
const anyPending = computed(
  () => addDrill.isPending.value || removeItem.isPending.value || reorder.isPending.value,
)
const anyError = computed(
  () =>
    addDrill.isError.value ||
    updateItem.isError.value ||
    removeItem.isError.value ||
    reorder.isError.value ||
    updateTemplate.isError.value,
)
/** Drills of other teams are not readable here; they are copied when applying. */
const foreignDrills = computed(() =>
  items.value.some(
    (item) => item.drill_team_id && item.drill_team_id !== activeTeam.value?.team_id,
  ),
)

function saveOrder() {
  reorder.mutate({ templateId: props.templateId, ids: items.value.map((i) => i.id) })
}

function move(index: number, direction: -1 | 1) {
  const target = index + direction
  const moved = items.value[index]
  items.value = moveItem(items.value, index, target)
  if (moved && items.value[target] === moved) {
    announcement.value = t('plan.moved', { title: moved.drill_title, position: target + 1 })
    saveOrder()
  }
}

function onPick(drill: Drill) {
  addDrill.mutate({
    templateId: props.templateId,
    drillId: drill.id,
    position: (items.value.at(-1)?.item_position ?? 0) + 1,
  })
}

function onDurationChange(item: TemplateItem, value: string) {
  const parsed = value.trim() === '' ? null : Math.min(180, Math.max(1, Number(value)))
  if (Number.isNaN(parsed)) return
  updateItem.mutate({ itemId: item.id, patch: { duration_min: parsed } })
}

function onNotesBlur(item: TemplateItem, value: string) {
  const notes = value.trim() || null
  if (notes !== item.coach_notes)
    updateItem.mutate({ itemId: item.id, patch: { coach_notes: notes } })
}

async function onDelete() {
  if (!confirmDelete.value) {
    confirmDelete.value = true
    return
  }
  await deleteTemplate.mutateAsync(props.templateId)
  await router.replace({ name: 'templates' })
}

async function onApplied(eventId: string) {
  await router.push({ name: 'event-plan', params: { eventId } })
}
</script>

<template>
  <section class="template">
    <p v-if="template.isPending.value">{{ t('common.loading') }}</p>
    <PageProblem
      v-else-if="template.isError.value || !tpl"
      :title="t('templates.loadFailedOne')"
      :text="t('problem.hint')"
      :to="{ name: 'templates' }"
      :action="t('problem.toTemplates')"
    />

    <template v-else>
      <header>
        <p class="template__eyebrow">{{ t('templates.eyebrow') }}</p>
        <h1>{{ tpl.title }}</h1>
        <p v-if="!canEdit && tpl.description" class="template__description">
          {{ tpl.description }}
        </p>
      </header>

      <!-- Name, description, sharing -->
      <UiCard v-if="canEdit">
        <form class="template__form" novalidate @submit.prevent="saveMeta">
          <UiInput
            v-model="title"
            :label="t('templates.name')"
            required
            :error="titleError"
            @update:model-value="metaSaved = false"
          />
          <UiTextarea
            v-model="description"
            :label="t('templates.description')"
            :placeholder="t('templates.descriptionPlaceholder')"
            :rows="3"
            :maxlength="2000"
            @update:model-value="metaSaved = false"
          />
          <label class="template__check">
            <input v-model="shared" type="checkbox" class="template__box" />
            <span>
              {{ t('templates.shareLabel') }}
              <span class="template__muted">{{ t('templates.shareHint') }}</span>
            </span>
          </label>
          <p v-if="metaSaved" class="template__saved" role="status">✓ {{ t('profile.saved') }}</p>
          <UiButton
            type="submit"
            variant="secondary"
            block
            :disabled="!metaDirty"
            :loading="updateTemplate.isPending.value"
          >
            {{ t('common.save') }}
          </UiButton>
        </form>
      </UiCard>

      <div class="template__total">
        <strong>{{ t('plan.total', { n: total }) }}</strong>
        <span>{{ t('plan.drillCount', items.length) }}</span>
      </div>

      <!-- Drills -->
      <p v-if="itemsQuery.isPending.value" class="template__muted">{{ t('common.loading') }}</p>
      <VueDraggable
        v-else-if="items.length"
        v-model="items"
        tag="ol"
        class="template__list"
        handle=".item__handle"
        :animation="150"
        :disabled="!canEdit"
        @end="saveOrder"
      >
        <li v-for="(item, index) in items" :key="item.id" class="item">
          <div class="item__row">
            <span
              v-if="canEdit"
              class="item__handle"
              :title="t('plan.dragHandle')"
              aria-hidden="true"
            >
              ⋮⋮
            </span>
            <span class="item__index">{{ index + 1 }}</span>
            <span class="item__main">
              <RouterLink
                v-if="!item.drill_team_id || item.drill_team_id === activeTeam?.team_id"
                :to="{ name: 'drill', params: { drillId: item.drill_id } }"
                class="item__title"
              >
                {{ item.drill_title }}
              </RouterLink>
              <span v-else class="item__title">{{ item.drill_title }}</span>
              <span class="template__muted">{{
                t(`drills.categories.${item.drill_category}`)
              }}</span>
            </span>
            <label v-if="canEdit" class="item__minutes">
              <span class="visually-hidden">
                {{ t('plan.minutesFor', { title: item.drill_title }) }}
              </span>
              <input
                type="number"
                inputmode="numeric"
                min="1"
                max="180"
                :value="item.duration_min ?? ''"
                :placeholder="String(item.drill_duration_min ?? '')"
                @change="onDurationChange(item, ($event.target as HTMLInputElement).value)"
              />
              <span aria-hidden="true">{{ t('plan.min') }}</span>
            </label>
            <span v-else class="template__muted">
              {{ t('plan.minutesShort', { n: minutes(item) }) }}
            </span>
          </div>

          <div v-if="canEdit" class="item__actions">
            <button
              type="button"
              class="item__action"
              :disabled="index === 0 || anyPending"
              :aria-label="t('plan.moveUp', { title: item.drill_title })"
              @click="move(index, -1)"
            >
              ↑
            </button>
            <button
              type="button"
              class="item__action"
              :disabled="index === items.length - 1 || anyPending"
              :aria-label="t('plan.moveDown', { title: item.drill_title })"
              @click="move(index, 1)"
            >
              ↓
            </button>
            <button
              type="button"
              class="item__action item__action--text"
              :aria-expanded="openNotes === item.id"
              @click="openNotes = openNotes === item.id ? null : item.id"
            >
              {{ item.coach_notes ? t('plan.notesEdit') : t('plan.notesAdd') }}
            </button>
            <button
              type="button"
              class="item__action item__action--danger"
              :aria-label="t('plan.remove', { title: item.drill_title })"
              :disabled="anyPending"
              @click="removeItem.mutate(item.id)"
            >
              <UiIcon name="x" :size="18" />
            </button>
          </div>

          <label v-if="canEdit && openNotes === item.id" class="item__notes">
            <span class="visually-hidden">{{ t('plan.notesLabel') }}</span>
            <textarea
              rows="3"
              maxlength="1000"
              :value="item.coach_notes ?? ''"
              :placeholder="t('plan.notesPlaceholder')"
              @blur="onNotesBlur(item, ($event.target as HTMLTextAreaElement).value)"
            />
          </label>
          <p v-else-if="item.coach_notes" class="item__note-preview">{{ item.coach_notes }}</p>
        </li>
      </VueDraggable>
      <p v-else class="template__muted template__empty">{{ t('templates.noDrills') }}</p>

      <p class="visually-hidden" aria-live="polite">{{ announcement }}</p>
      <p v-if="anyError" class="template__error" role="alert">{{ t('templates.saveFailed') }}</p>
      <p v-if="foreignDrills && !canEdit" class="template__muted">{{ t('templates.copyHint') }}</p>

      <div class="template__actions">
        <UiButton
          v-if="canEdit"
          variant="secondary"
          block
          :loading="addDrill.isPending.value"
          @click="pickerOpen = true"
        >
          <template #icon><UiIcon name="plus" :size="18" /></template>
          {{ t('plan.addDrill') }}
        </UiButton>
        <UiButton
          v-if="isCoach && activeTeam"
          block
          :disabled="!items.length"
          @click="applyOpen = true"
        >
          <template #icon><UiIcon name="calendar" :size="18" /></template>
          {{ t('templates.apply') }}
        </UiButton>
        <UiButton
          v-if="canEdit"
          :variant="confirmDelete ? 'danger' : 'ghost'"
          block
          :loading="deleteTemplate.isPending.value"
          @click="onDelete"
        >
          {{ confirmDelete ? t('schedule.confirmDelete') : t('templates.delete') }}
        </UiButton>
      </div>

      <DrillPickerModal
        v-if="canEdit"
        v-model:open="pickerOpen"
        :team-id="tpl.team_id"
        :used-drill-ids="items.map((i) => i.drill_id)"
        @pick="onPick"
      />
      <ApplyTemplateModal
        v-if="activeTeam"
        v-model:open="applyOpen"
        :team-id="activeTeam.team_id"
        :template-id="templateId"
        @applied="onApplied"
      />
    </template>
  </section>
</template>

<style scoped lang="scss">
.template {
  display: flex;
  flex-direction: column;
  gap: $space-4;

  &__eyebrow {
    font-size: $font-sm;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-text-muted);
  }

  &__description {
    margin-top: $space-2;
    white-space: pre-line;
  }

  &__form,
  &__actions {
    display: flex;
    flex-direction: column;
    gap: $space-3;
  }

  &__check {
    display: flex;
    align-items: flex-start;
    gap: $space-3;
  }

  &__box {
    @include focus-visible;

    flex: none;
    width: 22px;
    height: 22px;
    margin-top: 1px;
    accent-color: var(--color-primary);
  }

  &__total {
    display: flex;
    justify-content: space-between;
    gap: $space-2;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: $space-2;
    padding: 0;
    list-style: none;
  }

  &__empty {
    padding: $space-4 0;
    text-align: center;
  }

  &__muted {
    display: block;
    font-size: $font-sm;
    color: var(--color-text-muted);
  }

  &__saved {
    color: var(--color-success);
    font-weight: 600;
  }

  &__error {
    color: var(--color-danger);
  }
}

.item {
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
      background: var(--color-surface);
      color: var(--color-text);
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
    color: var(--color-text);
    font-weight: 700;

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    &--text {
      font-size: $font-sm;
      font-weight: 600;
    }

    &--danger {
      margin-left: auto;
      color: var(--color-danger);
    }
  }

  &__notes textarea {
    width: 100%;
    padding: $space-2;
    border: 2px solid var(--color-border);
    border-radius: $radius-md;
    background: var(--color-surface);
    color: var(--color-text);
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
</style>
