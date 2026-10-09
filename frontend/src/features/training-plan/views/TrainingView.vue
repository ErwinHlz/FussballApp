<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/AppIcon.vue'
import BaseBadge from '@/components/BaseBadge.vue'
import BaseButton from '@/components/BaseButton.vue'
import BaseCard from '@/components/BaseCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import { useActiveTeam } from '@/features/teams/composables/useActiveTeam'
import { useEventFormat } from '@/features/events/format'
import { useUpcomingTrainings } from '../composables/usePlan'

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
    <h1>{{ t('training.title') }}</h1>

    <section class="training__section" aria-labelledby="training-upcoming">
      <h2 id="training-upcoming" class="training__subtitle">{{ t('training.upcoming') }}</h2>
      <p v-if="trainings.isPending.value" class="training__muted">{{ t('common.loading') }}</p>
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
            <span class="training__main">
              <span class="training__date">{{ fmt.longDay(training.starts_at) }}</span>
              <span class="training__muted">
                {{ fmt.timeRange(training) }}
                <template v-if="training.location"> · {{ training.location }}</template>
              </span>
            </span>
            <BaseBadge v-if="training.is_cancelled" tone="danger">{{
              t('events.cancelled')
            }}</BaseBadge>
            <BaseBadge v-else-if="training.plan_status === 'published'" tone="success">
              {{ isCoach ? t('plan.published') : t('plan.available') }}
            </BaseBadge>
            <BaseBadge v-else-if="isCoach && training.drillCount" tone="warning">
              {{ t('plan.draftCount', training.drillCount) }}
            </BaseBadge>
            <BaseBadge v-else-if="isCoach" tone="neutral">{{ t('plan.none') }}</BaseBadge>
            <AppIcon name="chevronRight" :size="18" class="training__chevron" />
          </RouterLink>
        </li>
      </ul>
      <EmptyState
        v-else
        icon="calendar"
        :title="t('training.empty')"
        :text="t('training.emptyHint')"
      />
    </section>

    <BaseCard class="training__library">
      <h2 class="training__subtitle">{{ t('training.libraryTitle') }}</h2>
      <p class="training__muted">{{ t('training.libraryText') }}</p>
      <RouterLink v-slot="{ navigate }" custom :to="{ name: 'drills' }">
        <BaseButton variant="secondary" block @click="navigate">
          <template #icon><AppIcon name="whistle" :size="18" /></template>
          {{ t('training.openLibrary') }}
        </BaseButton>
      </RouterLink>
    </BaseCard>

    <BaseCard v-if="isCoach" class="training__library">
      <h2 class="training__subtitle">{{ t('templates.title') }}</h2>
      <p class="training__muted">{{ t('templates.teaser') }}</p>
      <RouterLink v-slot="{ navigate }" custom :to="{ name: 'templates' }">
        <BaseButton variant="secondary" block @click="navigate">
          <template #icon><AppIcon name="copy" :size="18" /></template>
          {{ t('templates.open') }}
        </BaseButton>
      </RouterLink>
    </BaseCard>

    <BaseCard v-if="activeTeam" class="training__library">
      <h2 class="training__subtitle">{{ t('schedule.open') }}</h2>
      <p class="training__muted">{{ t('schedule.openHint') }}</p>
      <RouterLink
        v-slot="{ navigate }"
        custom
        :to="{ name: 'club-schedule', params: { clubId: activeTeam.club_id } }"
      >
        <BaseButton variant="secondary" block @click="navigate">
          <template #icon><AppIcon name="calendar" :size="18" /></template>
          {{ t('schedule.title') }}
        </BaseButton>
      </RouterLink>
    </BaseCard>
  </section>
</template>

<style scoped lang="scss">
.training {
  display: flex;
  flex-direction: column;
  gap: $space-4;

  &__section,
  &__library {
    display: flex;
    flex-direction: column;
    gap: $space-3;
  }

  &__subtitle {
    font-size: $font-lg;
  }

  &__list {
    overflow: hidden;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-left: 6px solid var(--color-training);
    border-radius: $radius-lg;

    > li + li {
      border-top: 1px solid var(--color-border);
    }
  }

  &__item {
    @include focus-visible;

    display: flex;
    align-items: center;
    gap: $space-2;
    min-height: 64px;
    padding: $space-2 $space-3;
    color: inherit;
    text-decoration: none;

    &:hover {
      background: var(--color-surface-muted);
    }

    &--cancelled .training__date {
      text-decoration: line-through;
    }
  }

  &__main {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }

  &__date {
    font-weight: 700;
  }

  &__chevron {
    flex-shrink: 0;
    color: var(--color-text-muted);
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
