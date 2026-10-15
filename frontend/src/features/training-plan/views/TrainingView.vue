<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import DateBlock from '@/ui/DateBlock.vue'
import UiBadge from '@/ui/UiBadge.vue'
import UiEmptyState from '@/ui/UiEmptyState.vue'
import UiIcon from '@/ui/UiIcon.vue'
import UiListRow from '@/ui/UiListRow.vue'
import UiSkeleton from '@/ui/UiSkeleton.vue'
import { useActiveTeam } from '@/features/teams/composables/useActiveTeam'
import { useEventFormat } from '@/features/events/format'
import TrainingNav from '../components/TrainingNav.vue'
import { useUpcomingTrainings } from '../composables/usePlan'

/** Training tab start: the next sessions with their plan state; library and more above. */
const { t } = useI18n()
const fmt = useEventFormat()
const { activeTeam, isCoach } = useActiveTeam()
const trainings = useUpcomingTrainings(() => activeTeam.value?.team_id ?? null)

const list = computed(() =>
  (trainings.data.value ?? []).map((e) => ({ ...e, drillCount: e.event_drills[0]?.count ?? 0 })),
)
</script>

<template>
  <section class="training">
    <TrainingNav active="training" />
    <h1>{{ t('training.title') }}</h1>

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
            </span>
            <UiBadge v-if="training.is_cancelled" tone="no">{{ t('events.cancelled') }}</UiBadge>
            <UiBadge v-else-if="training.plan_status === 'published'" tone="yes">
              {{ isCoach ? t('plan.published') : t('plan.available') }}
            </UiBadge>
            <UiBadge v-else-if="isCoach && training.drillCount" tone="maybe">
              {{ t('plan.draftCount', training.drillCount) }}
            </UiBadge>
            <UiBadge v-else-if="isCoach">{{ t('plan.none') }}</UiBadge>
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

    <UiListRow
      v-if="activeTeam"
      :title="t('schedule.title')"
      :subtitle="t('schedule.openHint')"
      :to="{ name: 'club-schedule', params: { clubId: activeTeam.club_id } }"
      chevron
    >
      <template #leading><UiIcon name="calendar" :size="24" /></template>
    </UiListRow>
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
