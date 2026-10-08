<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseBadge from '@/components/BaseBadge.vue'
import BaseButton from '@/components/BaseButton.vue'
import BaseCard from '@/components/BaseCard.vue'
import type { TeamMember } from '@/features/teams/api'
import type { TeamEvent } from '@/features/events/logic'
import LateDeclines from './LateDeclines.vue'
import { itemMinutes, planTotalMinutes } from '../logic'
import { usePlan } from '../composables/usePlan'

/** Training plan block on the event detail page: summary for coaches, the plan for players. */
const props = defineProps<{ event: TeamEvent; isCoach: boolean; members: TeamMember[] }>()

const { t } = useI18n()
const isPublished = computed(() => props.event.plan_status === 'published')
// Players can only read published plans (RLS), so don't even ask otherwise.
const plan = usePlan(
  () => props.event.id,
  () => props.isCoach || isPublished.value,
)
const items = computed(() => plan.data.value ?? [])
const total = computed(() => planTotalMinutes(items.value))
</script>

<template>
  <BaseCard v-if="isCoach || isPublished" class="plan-section">
    <header class="plan-section__header">
      <h2 class="plan-section__title">{{ t('plan.title') }}</h2>
      <BaseBadge v-if="isCoach" :tone="isPublished ? 'success' : 'warning'">
        {{ isPublished ? t('plan.published') : t('plan.draft') }}
      </BaseBadge>
    </header>

    <LateDeclines v-if="isCoach" :event="event" :members="members" />

    <ol v-if="items.length" class="plan-section__list">
      <li v-for="(item, index) in items" :key="item.id" class="plan-section__item">
        <span class="plan-section__index">{{ index + 1 }}</span>
        <RouterLink
          :to="{ name: 'drill', params: { drillId: item.drill.id } }"
          class="plan-section__drill"
        >
          {{ item.drill.title }}
        </RouterLink>
        <span class="plan-section__minutes">{{
          t('plan.minutesShort', { n: itemMinutes(item) })
        }}</span>
      </li>
    </ol>
    <p v-else-if="plan.isSuccess.value" class="plan-section__muted">
      {{ t('plan.empty') }}
    </p>
    <p v-if="items.length" class="plan-section__muted">{{ t('plan.total', { n: total }) }}</p>

    <RouterLink
      v-if="isCoach"
      v-slot="{ navigate }"
      custom
      :to="{ name: 'event-plan', params: { eventId: event.id } }"
    >
      <BaseButton :variant="items.length ? 'secondary' : 'primary'" block @click="navigate">
        {{ items.length ? t('plan.edit') : t('plan.create') }}
      </BaseButton>
    </RouterLink>
  </BaseCard>
</template>

<style scoped lang="scss">
.plan-section {
  display: flex;
  flex-direction: column;
  gap: $space-3;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $space-2;
  }

  &__title {
    font-size: $font-lg;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: $space-1;
    padding: 0;
    list-style: none;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: $space-2;
    min-height: $touch-target;
  }

  &__index {
    display: grid;
    flex-shrink: 0;
    place-items: center;
    width: 26px;
    height: 26px;
    border-radius: $radius-full;
    background: var(--color-training);
    color: #fff;
    font-size: $font-sm;
    font-weight: 800;
  }

  &__drill {
    flex: 1;
    font-weight: 600;
    color: inherit;
  }

  &__minutes,
  &__muted {
    font-size: $font-sm;
    color: var(--color-text-muted);
  }
}
</style>
