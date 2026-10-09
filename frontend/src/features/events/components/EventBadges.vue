<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import BaseBadge from '@/components/BaseBadge.vue'
import type { EventRow } from '../logic'

/**
 * Type badges: matches get "Spiel" + Heim/Auswärts (+ competition), trainings none — their
 * title already says "Training" and the green color marks them.
 */
withDefaults(
  defineProps<{
    event: Pick<EventRow, 'type' | 'is_home' | 'competition' | 'is_cancelled'>
    showCompetition?: boolean
  }>(),
  { showCompetition: false },
)

const { t } = useI18n()
</script>

<template>
  <span v-if="event.type === 'match' || event.is_cancelled" class="event-badges">
    <BaseBadge v-if="event.is_cancelled" tone="danger">{{ t('events.cancelled') }}</BaseBadge>
    <template v-if="event.type === 'match'">
      <BaseBadge tone="match">{{ t('events.match') }}</BaseBadge>
      <BaseBadge tone="neutral">
        {{ event.is_home === false ? t('events.away') : t('events.home') }}
      </BaseBadge>
      <BaseBadge v-if="showCompetition && event.competition" tone="neutral">
        {{ t(`events.competition.${event.competition}`) }}
      </BaseBadge>
    </template>
  </span>
</template>

<style scoped lang="scss">
.event-badges {
  display: inline-flex;
  flex-wrap: wrap;
  gap: $space-1;
}
</style>
