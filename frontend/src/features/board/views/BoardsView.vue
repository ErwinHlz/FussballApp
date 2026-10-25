<script setup lang="ts">
import { computed, ref } from 'vue'
import TrainingNav from '@/features/training-plan/components/TrainingNav.vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import UiIcon from '@/ui/UiIcon.vue'
import UiButton from '@/ui/UiButton.vue'
import UiCard from '@/ui/UiCard.vue'
import UiInput from '@/ui/UiInput.vue'
import UiEmptyState from '@/ui/UiEmptyState.vue'
import { formatDate } from '@/lib/date'
import { useActiveTeam } from '@/features/teams/composables/useActiveTeam'
import BoardScene from '../components/BoardScene.vue'
import { useBoards, useCreateBoard } from '../boards'
import { resolveKeyframes } from '../interpolate'
import { emptyAnimation, parseAnimation } from '../schema'

const { t, locale } = useI18n()
const router = useRouter()
const { activeTeam, isCoach } = useActiveTeam()
const teamId = computed(() => activeTeam.value?.team_id ?? null)
const boards = useBoards(teamId, isCoach)
const create = useCreateBoard()

/** First step of each board as a thumbnail. */
const items = computed(() =>
  (boards.data.value ?? []).map((board) => {
    const animation = parseAnimation(board.animation) ?? emptyAnimation()
    return {
      board,
      animation,
      positions: resolveKeyframes(animation)[0]?.positions ?? {},
      steps: animation.keyframes.length,
    }
  }),
)

const title = ref('')
const titleError = ref<string | undefined>()

async function onCreate() {
  const value = title.value.trim()
  if (value.length < 2 || value.length > 80) {
    titleError.value = value.length < 2 ? t('validation.minLength2') : t('validation.maxLength80')
    return
  }
  titleError.value = undefined
  const board = await create.mutateAsync({ teamId: teamId.value!, title: value })
  title.value = ''
  await router.push({ name: 'tactic-board', params: { boardId: board.id } })
}
</script>

<template>
  <section class="boards">
    <TrainingNav active="tactic-boards" />
    <header>
      <!-- The area tab above names the page already: the heading is for screen readers. -->
      <h1 class="visually-hidden">{{ t('boards.title') }}</h1>
      <p class="boards__muted">{{ t('boards.intro') }}</p>
    </header>

    <p v-if="!isCoach" role="alert">{{ t('plan.coachOnly') }}</p>

    <template v-else>
      <UiCard>
        <form class="boards__form" novalidate @submit.prevent="onCreate">
          <UiInput
            v-model="title"
            :label="t('boards.name')"
            :placeholder="t('boards.namePlaceholder')"
            required
            :error="titleError"
          />
          <p v-if="create.isError.value" class="boards__error" role="alert">
            {{ t('boards.saveFailed') }}
          </p>
          <UiButton type="submit" block :loading="create.isPending.value">
            <template #icon><UiIcon name="plus" :size="18" /></template>
            {{ t('boards.create') }}
          </UiButton>
        </form>
      </UiCard>

      <p v-if="boards.isPending.value" class="boards__muted">{{ t('common.loading') }}</p>
      <p v-else-if="boards.isError.value" class="boards__error" role="alert">
        {{ t('boards.loadFailed') }}
      </p>
      <UiEmptyState
        v-else-if="!items.length"
        icon="edit"
        :title="t('boards.emptyTitle')"
        :text="t('boards.emptyText')"
      />
      <ul v-else class="boards__grid" role="list">
        <li v-for="item in items" :key="item.board.id">
          <RouterLink
            class="boards__item"
            :to="{ name: 'tactic-board', params: { boardId: item.board.id } }"
          >
            <BoardScene
              class="boards__thumb"
              :field="item.animation.field"
              :objects="item.animation.objects"
              :positions="item.positions"
              :annotations="item.animation.annotations"
              :title="item.board.title"
            />
            <span class="boards__name">{{ item.board.title }}</span>
            <span class="boards__muted">
              {{ t('boards.steps', item.steps) }} ·
              {{ formatDate(item.board.updated_at, locale, 'P') }}
            </span>
          </RouterLink>
        </li>
      </ul>
    </template>
  </section>
</template>

<style scoped lang="scss">
.boards {
  display: flex;
  flex-direction: column;
  gap: $space-4;

  &__form {
    display: flex;
    flex-direction: column;
    gap: $space-3;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: $space-3;
  }

  &__item {
    @include focus-visible;

    display: flex;
    flex-direction: column;
    gap: $space-1;
    padding: $space-2;
    border: 1px solid var(--color-border);
    border-radius: $radius-lg;
    background: var(--color-surface);
    color: var(--color-text);
    text-decoration: none;
  }

  &__thumb {
    max-height: 180px;
    pointer-events: none;
  }

  &__name {
    font-weight: 700;
    overflow-wrap: anywhere;
  }

  &__muted {
    font-size: $font-sm;
    color: var(--color-text-muted);
  }

  &__error {
    color: var(--color-danger);
  }
}
</style>
