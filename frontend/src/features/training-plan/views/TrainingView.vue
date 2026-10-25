<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import DateBlock from '@/ui/DateBlock.vue'
import UiBadge from '@/ui/UiBadge.vue'
import UiEmptyState from '@/ui/UiEmptyState.vue'
import UiIcon from '@/ui/UiIcon.vue'
import UiSkeleton from '@/ui/UiSkeleton.vue'
import { useActiveTeam } from '@/features/teams/composables/useActiveTeam'
import { useEventFormat } from '@/features/events/format'
import TrainingNav from '../components/TrainingNav.vue'
import { useUpcomingTrainings } from '../composables/usePlan'

/** Training tab start for coaches: the next sessions with their plan state. */
const { t } = useI18n()
const fmt = useEventFormat()
const { activeTeam, isCoach } = useActiveTeam()
const trainings = useUpcomingTrainings(() => activeTeam.value?.team_id ?? null)

// Players find their trainings under "Termine"; the training tab is the drills for them.
const router = useRouter()
watchEffect(() => {
  if (activeTeam.value && !isCoach.value) void router.replace({ name: 'drills' })
})

const list = computed(() =>
  (trainings.data.value ?? []).map((e) => ({ ...e, drillCount: e.event_drills[0]?.count ?? 0 })),
)
</script>

<template>
  <section class="training">
    <TrainingNav active="training" />
    <!-- The area tab above names the page already: the heading is for screen readers. -->
    <h1 class="visually-hidden">{{ t('training.title') }}</h1>

    <section class="training__section" aria-labelledby="training-upcoming">
      <h2 id="training-upcoming">{{ t('training.upcoming') }}</h2>
      <div v-if="trainings.isPending.value" aria-busy="true" class="training__list">
        <UiSkeleton v-for="n in 3" :key="n" shape="block" height="72px" />
      </div>
      <p v-else-if="trainings.isError.value" class="training__error" role="alert">
        {{ t('events.loadFailed') }}
      </p>
      <ul v-else-if="list.length" class="training__list" role="list">
        <li v-for="training in list" :key="training.id">
          <RouterLink
            :to="
              isCoach
                ? { name: 'event-plan', params: { eventId: training.id } }
                : { name: 'event', params: { eventId: training.id } }
            "
            class="training__item"
            :class="{ 'training__item--cancelled': training.is_cancelled }"
          >
            <DateBlock
              :date="training.starts_at"
              :tone="training.is_cancelled ? 'neutral' : 'training'"
            />
            <span class="training__main">
              <span class="training__time">{{ fmt.timeRange(training) }}</span>
              <span v-if="training.location" class="training__muted">{{ training.location }}</span>
              <!-- Below the time, so the time never wraps next to a long badge. -->
              <span class="training__badge">
                <UiBadge v-if="training.is_cancelled" tone="no">{{
                  t('events.cancelled')
                }}</UiBadge>
                <UiBadge v-else-if="training.plan_status === 'published'" tone="yes">
                  {{ isCoach ? t('plan.published') : t('plan.available') }}
                </UiBadge>
                <UiBadge v-else-if="isCoach && training.drillCount" tone="maybe">
                  {{ t('plan.draftCount', training.drillCount) }}
                </UiBadge>
                <UiBadge v-else-if="isCoach">{{ t('plan.none') }}</UiBadge>
              </span>
            </span>
            <UiIcon name="chevronRight" :size="20" class="training__chevron" />
          </RouterLink>
        </li>
      </ul>
      <UiEmptyState
        v-else
        icon="calendar"
        :title="t('training.empty')"
        :text="t('training.emptyHint')"
      />
    </section>
  </section>
</template>

<style scoped lang="scss">
.training {
  display: flex;
  flex-direction: column;
  gap: $space-4;

  &__section {
    display: flex;
    flex-direction: column;
    gap: $space-2;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: $space-2;
    margin: 0;
  }

  &__item {
    @include focus-visible;

    display: flex;
    align-items: center;
    gap: $space-3;
    min-height: 72px;
    padding: $space-3;
    border-radius: $radius-xl;
    background: var(--color-surface);
    color: var(--color-text);
    text-decoration: none;

    &--cancelled .training__time {
      text-decoration: line-through;
    }
  }

  &__main {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }

  &__time {
    font-weight: 800;
    white-space: nowrap;
  }

  &__badge {
    display: flex;
    margin-top: $space-1;

    &:empty {
      display: none;
    }
  }

  &__muted {
    color: var(--color-text-muted);
    font-size: $font-sm;

    @include truncate;
  }

  &__chevron {
    color: var(--color-text-muted);
  }

  &__error {
    color: var(--color-danger);
  }
}
</style>
