<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TeamMember } from '@/features/teams/api'
import { summarizeAttendance, type AttendanceGroup, type TeamEvent } from '../logic'
import AttendanceControl from './AttendanceControl.vue'

const props = defineProps<{
  event: TeamEvent
  members: TeamMember[]
}>()

const { t } = useI18n()

const summary = computed(() => summarizeAttendance(props.members, props.event.attendances))
const groups: { key: AttendanceGroup; icon: string }[] = [
  { key: 'yes', icon: '✓' },
  { key: 'maybe', icon: '?' },
  { key: 'no', icon: '✗' },
  { key: 'none', icon: '–' },
]

function reasonText(entry: (typeof summary.value)['no'][number]) {
  const a = entry.attendance
  if (!a?.reason && !a?.reason_note) return null
  const text = [a.reason ? t(`events.reasons.${a.reason}`) : null, a.reason_note]
    .filter(Boolean)
    .join(': ')
  return a.source_absence_id ? `${text} · ${t('absences.auto')}` : text
}
</script>

<template>
  <section class="overview" aria-labelledby="overview-title">
    <h2 id="overview-title" class="overview__title">
      {{ t('events.overview.title') }}
      <span class="overview__live">● {{ t('events.overview.live') }}</span>
    </h2>

    <div class="overview__totals">
      <span
        v-for="group in groups"
        :key="group.key"
        class="overview__total"
        :class="`overview__total--${group.key}`"
      >
        <span class="overview__total-count">
          <span aria-hidden="true">{{ group.icon }}</span> {{ summary[group.key].length }}
        </span>
        <span class="overview__total-label">{{ t(`events.overview.${group.key}`) }}</span>
      </span>
    </div>

    <template v-for="group in groups" :key="group.key">
      <div v-if="summary[group.key].length" class="overview__group">
        <h3 class="overview__group-title">
          {{ t(`events.overview.${group.key}`) }} ({{ summary[group.key].length }})
        </h3>
        <ul class="overview__list" role="list">
          <li v-for="entry in summary[group.key]" :key="entry.member.id" class="overview__row">
            <span class="overview__name">
              {{ entry.member.display_name }}
              <span v-if="entry.member.user_id === null" class="overview__muted">
                ({{ t('squad.noAccount') }})
              </span>
              <span v-if="reasonText(entry)" class="overview__reason">{{ reasonText(entry) }}</span>
            </span>
            <AttendanceControl
              :event="event"
              :member-id="entry.member.id"
              :attendance="entry.attendance"
              :member-name="entry.member.display_name"
              as-coach
              compact
            />
          </li>
        </ul>
      </div>
    </template>
  </section>
</template>

<style scoped lang="scss">
.overview {
  display: flex;
  flex-direction: column;
  gap: $space-3;

  &__title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: $font-lg;
  }

  &__live {
    font-size: $font-xs;
    font-weight: 700;
    color: var(--color-success);
  }

  &__totals {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: $space-2;
  }

  &__total {
    --total-color: var(--color-text-muted);
    --total-text: var(--color-text-muted);

    display: flex;
    flex-direction: column;
    align-items: center;
    padding: $space-2 $space-1;
    border-radius: $radius-md;
    background: color-mix(in srgb, var(--total-color) 10%, var(--color-surface));
    color: var(--total-text);

    &--yes {
      --total-color: var(--color-yes);
      --total-text: var(--color-yes-text);
    }

    &--maybe {
      --total-color: var(--color-maybe);
      --total-text: var(--color-maybe-text);
    }

    &--no {
      --total-color: var(--color-no);
      --total-text: var(--color-no-text);
    }
  }

  &__total-count {
    font-size: $font-xl;
    font-weight: 800;
  }

  &__total-label {
    @include truncate;

    max-width: 100%;
    font-size: $font-xs;
    font-weight: 700;
  }

  &__group {
    display: flex;
    flex-direction: column;
    gap: $space-2;
  }

  &__group-title {
    font-size: $font-md;
  }

  &__list {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: $radius-lg;
  }

  &__row {
    display: flex;
    align-items: center;
    gap: $space-2;
    padding: $space-2 $space-2 $space-2 $space-3;

    & + & {
      border-top: 1px solid var(--color-border);
    }
  }

  &__name {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  &__reason,
  &__muted {
    font-size: $font-sm;
    font-weight: 400;
    color: var(--color-text-muted);
  }
}
</style>
