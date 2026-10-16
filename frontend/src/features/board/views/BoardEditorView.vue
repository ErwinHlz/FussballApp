<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import UiButton from '@/ui/UiButton.vue'
import { useActiveTeam } from '@/features/teams/composables/useActiveTeam'
import { useDrill, useSaveDrillAnimation } from '@/features/drills/composables/useDrills'
import type { Json } from '@/types/database'
import BoardEditor from '../components/BoardEditor.vue'
import { useSquadNames } from '../composables/useSquadNames'
import { animationSchema, emptyAnimation, parseAnimation, type Animation } from '../schema'

/** Animation of a drill (stored in drills.animation). */
const props = defineProps<{ drillId: string }>()

const { t } = useI18n()
const router = useRouter()
const drill = useDrill(() => props.drillId)
const save = useSaveDrillAnimation()
const { myTeams } = useActiveTeam()
const squadNames = useSquadNames(() => drill.data.value?.team_id ?? null)

const canEdit = computed(() => {
  const team = myTeams.data.value?.find((x) => x.team_id === drill.data.value?.team_id)
  return !!team && (team.team_role === 'coach' || team.is_club_admin)
})

const draft = ref<Animation>(emptyAnimation())
const savedJson = ref(JSON.stringify(draft.value))
const announcement = ref('')
const validationError = ref<string | null>(null)

watch(
  () => drill.data.value,
  (d) => {
    if (!d) return
    draft.value = parseAnimation(d.animation) ?? emptyAnimation()
    savedJson.value = JSON.stringify(draft.value)
  },
  { immediate: true },
)

const dirty = computed(() => JSON.stringify(draft.value) !== savedJson.value)

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

      <BoardEditor v-model="draft" :title="drill.data.value.title" :squad-names="squadNames" />

      <p class="visually-hidden" aria-live="polite">{{ announcement }}</p>
      <p v-if="validationError" class="editor__error" role="alert">{{ validationError }}</p>
      <p v-if="save.isError.value" class="editor__error" role="alert">
        {{ t('board.saveFailed') }}
      </p>

      <div class="editor__savebar">
        <UiButton
          size="lg"
          block
          :disabled="!dirty"
          :loading="save.isPending.value"
          @click="saveDraft"
        >
          {{ dirty ? t('board.save') : `✓ ${t('groups.savedState')}` }}
        </UiButton>
        <UiButton
          v-if="drill.data.value.animation"
          variant="ghost"
          block
          :loading="save.isPending.value"
          @click="removeAnimation"
        >
          {{ t('board.removeAnimation') }}
        </UiButton>
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
</style>
