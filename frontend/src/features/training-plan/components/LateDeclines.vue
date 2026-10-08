<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TeamMember } from '@/features/teams/api'
import type { TeamEvent } from '@/features/events/logic'
import { lateDeclines } from '../logic'

const props = defineProps<{ event: TeamEvent; members: TeamMember[] }>()

const { t } = useI18n()
const declines = computed(() => lateDeclines(props.event, props.event.attendances, props.members))
</script>

<template>
  <div v-if="declines.length" class="late" role="status">
    <span class="late__icon" aria-hidden="true">!</span>
    <div>
      <p class="late__title">{{ t('plan.lateDeclines', declines.length) }}</p>
      <ul class="late__list" role="list">
        <li v-for="{ member, attendance } in declines" :key="member.id">
          {{ member.display_name
          }}<template v-if="attendance.reason">
            ({{ t(`events.reasons.${attendance.reason}`) }})</template
          >
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped lang="scss">
.late {
  display: flex;
  gap: $space-3;
  padding: $space-3;
  border: 2px solid var(--color-warning);
  border-radius: $radius-lg;
  background: color-mix(in srgb, var(--color-warning) 10%, var(--color-surface));

  &__icon {
    display: grid;
    flex-shrink: 0;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: $radius-full;
    background: var(--color-warning);
    color: #fff;
    font-weight: 800;
  }

  &__title {
    font-weight: 700;
  }

  &__list {
    font-size: $font-sm;
  }
}
</style>
