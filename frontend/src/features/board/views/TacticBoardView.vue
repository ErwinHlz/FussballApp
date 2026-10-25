<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import UiButton from '@/ui/UiButton.vue'
import UiInput from '@/ui/UiInput.vue'
import BottomSheet from '@/ui/BottomSheet.vue'
import type { Json } from '@/types/database'
import { useActiveTeam } from '@/features/teams/composables/useActiveTeam'
import { useDrills, useSaveDrillAnimation } from '@/features/drills/composables/useDrills'
import BoardEditor from '../components/BoardEditor.vue'
import { useSquadNames } from '../composables/useSquadNames'
import { useBoard, useDeleteBoard, useSaveBoard } from '../boards'
import { animationSchema, emptyAnimation, parseAnimation, type Animation } from '../schema'
import PageProblem from '@/ui/PageProblem.vue'

/** A standalone tactics board (set plays, ideas) that can be attached to drills. */
const props = defineProps<{ boardId: string }>()

const { t } = useI18n()
const router = useRouter()
const board = useBoard(() => props.boardId)
const save = useSaveBoard()
const remove = useDeleteBoard()
const { myTeams } = useActiveTeam()
const teamId = computed(() => board.data.value?.team_id ?? null)
const squadNames = useSquadNames(teamId)

const canEdit = computed(() => {
  const team = myTeams.data.value?.find((x) => x.team_id === teamId.value)
  return !!team && (team.team_role === 'coach' || team.is_club_admin)
})

const draft = ref<Animation>(emptyAnimation())
const title = ref('')
const saved = ref('')
const notice = ref<string | null>(null)
const error = ref<string | null>(null)
const confirmDelete = ref(false)

watch(
  () => board.data.value,
  (value) => {
    if (!value) return
    draft.value = parseAnimation(value.animation) ?? emptyAnimation()
    title.value = value.title
    saved.value = JSON.stringify([value.title, draft.value])
  },
  { immediate: true },
)

const dirty = computed(() => JSON.stringify([title.value.trim(), draft.value]) !== saved.value)

function validAnimation(): Animation | null {
  const result = animationSchema.safeParse(draft.value)
  if (!result.success) {
    error.value = t('board.invalid')
    return null
  }
  if (title.value.trim().length < 2) {
    error.value = t('validation.minLength2')
    return null
  }
  error.value = null
  return result.data
}

async function onSave() {
  const animation = validAnimation()
  if (!animation) return
  const updated = await save.mutateAsync({ boardId: props.boardId, title: title.value, animation })
  saved.value = JSON.stringify([updated.title, draft.value])
  notice.value = t('board.saved')
}

async function onDelete() {
  if (!confirmDelete.value) {
    confirmDelete.value = true
    return
  }
  await remove.mutateAsync(props.boardId)
  saved.value = JSON.stringify([title.value.trim(), draft.value])
  await router.replace({ name: 'tactic-boards' })
}

// Attach to a drill of the team (players see it there).
const attachOpen = ref(false)
const drills = useDrills(() => teamId.value ?? '')
const ownDrills = computed(() =>
  (drills.data.value ?? []).filter((d) => d.team_id && d.team_id === teamId.value),
)
const attach = useSaveDrillAnimation()

async function attachTo(drillId: string, drillTitle: string) {
  const animation = validAnimation()
  if (!animation) return
  await attach.mutateAsync({ drillId, animation: animation as unknown as Json })
  attachOpen.value = false
  notice.value = t('boards.attached', { title: drillTitle })
}

onBeforeRouteLeave(() => !dirty.value || window.confirm(t('board.unsavedConfirm')))
</script>

<template>
  <section class="tactic">
    <p v-if="board.isPending.value">{{ t('common.loading') }}</p>
    <PageProblem
      v-else-if="board.isError.value || !board.data.value"
      :title="t('boards.loadFailedOne')"
      :text="t('problem.hint')"
      :to="{ name: 'tactic-boards' }"
      :action="t('problem.toBoards')"
    />
    <PageProblem
      v-else-if="!canEdit"
      icon="lock"
      :title="t('plan.coachOnly')"
      :to="{ name: 'tactic-boards' }"
      :action="t('problem.toBoards')"
    />

    <template v-else>
      <header>
        <p class="tactic__eyebrow">{{ t('boards.eyebrow') }}</p>
        <h1>{{ board.data.value.title }}</h1>
      </header>

      <UiInput v-model="title" :label="t('boards.name')" required />

      <BoardEditor v-model="draft" :title="title" :squad-names="squadNames" />

      <p v-if="notice && !dirty" class="tactic__notice" role="status">✓ {{ notice }}</p>
      <p v-if="error" class="tactic__error" role="alert">{{ error }}</p>
      <p v-if="save.isError.value || attach.isError.value" class="tactic__error" role="alert">
        {{ t('boards.saveFailed') }}
      </p>

      <div class="tactic__savebar">
        <UiButton
          size="lg"
          block
          :disabled="!dirty"
          :loading="save.isPending.value"
          @click="onSave"
        >
          {{ dirty ? t('boards.save') : `✓ ${t('groups.savedState')}` }}
        </UiButton>
        <UiButton variant="secondary" block @click="attachOpen = true">
          {{ t('boards.attach') }}
        </UiButton>
        <UiButton
          :variant="confirmDelete ? 'danger' : 'ghost'"
          block
          :loading="remove.isPending.value"
          @click="onDelete"
        >
          {{ confirmDelete ? t('schedule.confirmDelete') : t('boards.delete') }}
        </UiButton>
      </div>

      <BottomSheet v-model:open="attachOpen" :title="t('boards.attachTitle')">
        <p class="tactic__muted">{{ t('boards.attachHint') }}</p>
        <p v-if="drills.isPending.value" class="tactic__muted">{{ t('common.loading') }}</p>
        <p v-else-if="!ownDrills.length" class="tactic__muted">{{ t('boards.noDrills') }}</p>
        <ul v-else class="tactic__list" role="list">
          <li v-for="drill in ownDrills" :key="drill.id">
            <button
              type="button"
              class="tactic__item"
              :disabled="attach.isPending.value"
              @click="attachTo(drill.id, drill.title)"
            >
              <span class="tactic__name">{{ drill.title }}</span>
              <span v-if="drill.animation" class="tactic__muted">
                {{ t('boards.replacesAnimation') }}
              </span>
            </button>
          </li>
        </ul>
      </BottomSheet>
    </template>
  </section>
</template>

<style scoped lang="scss">
.tactic {
  display: flex;
  flex-direction: column;
  gap: $space-3;

  &__eyebrow {
    font-size: $font-sm;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-text-muted);
  }

  &__savebar {
    display: flex;
    flex-direction: column;
    gap: $space-2;
    margin-top: $space-2;
  }

  &__list {
    display: flex;
    flex-direction: column;
    margin-top: $space-3;
  }

  &__item {
    @include focus-visible;

    display: flex;
    flex-direction: column;
    align-items: flex-start;
    width: 100%;
    min-height: 52px;
    padding: $space-2;
    border: 0;
    border-bottom: 1px solid var(--color-border);
    background: transparent;
    color: var(--color-text);
    text-align: left;

    &:hover {
      background: var(--color-surface-muted);
    }
  }

  &__name {
    font-weight: 700;
  }

  &__muted {
    font-size: $font-sm;
    color: var(--color-text-muted);
  }

  &__notice {
    color: var(--color-success);
    font-weight: 600;
  }

  &__error {
    color: var(--color-danger);
  }
}
</style>
