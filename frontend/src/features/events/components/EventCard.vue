<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseBadge from '@/components/BaseBadge.vue'
import type { TeamMember } from '@/features/teams/api'
import { useEventFormat } from '../format'
import type { TeamEvent } from '../logic'
import AttendanceControl from './AttendanceControl.vue'
import EventBadges from './EventBadges.vue'

const props = defineProps<{
  event: TeamEvent
  myMember: TeamMember | null
  isCoach: boolean
  /** Squad players (coaches are not counted as missing answers). */
  playerIds: string[]
}>()

const { t } = useI18n()
const fmt = useEventFormat()

const myAttendance = computed(
  () => props.event.attendances.find((a) => a.member_id === props.myMember?.id) ?? null,
)
const counts = computed(() => {
  const players = new Set(props.playerIds)
  const c = { yes: 0, maybe: 0, no: 0 }
  let answered = 0
  for (const a of props.event.attendances) {
    if (!players.has(a.member_id)) continue
    c[a.status]++
    answered++
  }
  return { ...c, none: Math.max(0, players.size - answered) }
})
const myNomination = computed(
  () => props.event.match_squad.find((s) => s.member_id === props.myMember?.id) ?? null,
)
</script>

<template>
  <article
    class="event-card"
    :class="[`event-card--${event.type}`, { 'event-card--cancelled': event.is_cancelled }]"
  >
    <RouterLink :to="{ name: 'event', params: { eventId: event.id } }" class="event-card__link">
      <span class="event-card__date">
        <span class="event-card__weekday">{{ fmt.weekdayShort(event.starts_at) }}</span>
        <span class="event-card__day">{{ fmt.dayMonth(event.starts_at) }}</span>
      </span>
      <span class="event-card__body">
        <span class="event-card__top">
          <EventBadges :event="event" />
          <BaseBadge v-if="!event.is_cancelled && myNomination" tone="info">
            {{ t(`events.squadRole.${myNomination.role}`) }}
          </BaseBadge>
        </span>
        <span class="event-card__title">{{ fmt.title(event) }}</span>
        <span class="event-card__meta">
          {{ fmt.timeRange(event)
          }}<template v-if="event.location"> · {{ event.location }}</template>
        </span>
        <span v-if="event.is_cancelled && event.cancel_reason" class="event-card__meta">
          {{ event.cancel_reason }}
        </span>
      </span>
    </RouterLink>

    <AttendanceControl
      v-if="myMember && !event.is_cancelled"
      :event="event"
      :member-id="myMember.id"
      :attendance="myAttendance"
      :as-coach="isCoach"
    />

    <p v-if="isCoach && !event.is_cancelled" class="event-card__counts">
      <span aria-hidden="true" class="event-card__count event-card__count--yes"
        >✓ {{ counts.yes }}</span
      >
      <span aria-hidden="true" class="event-card__count event-card__count--maybe"
        >? {{ counts.maybe }}</span
      >
      <span aria-hidden="true" class="event-card__count event-card__count--no"
        >✗ {{ counts.no }}</span
      >
      <span aria-hidden="true" class="event-card__count">– {{ counts.none }}</span>
      <span class="visually-hidden">
        {{ t('events.countsLabel', counts) }}
      </span>
    </p>
  </article>
</template>

<style scoped lang="scss">
.event-card {
  display: flex;
  flex-direction: column;
  gap: $space-3;
  padding: $space-3;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-left: 6px solid var(--event-color);
  border-radius: $radius-lg;
  box-shadow: var(--shadow-sm);

  &--training {
    --event-color: var(--color-training);
  }

  &--match {
    --event-color: var(--color-match);
  }

  &--event {
    --event-color: var(--color-event);
  }

  &--cancelled {
    --event-color: var(--color-border);

    opacity: 0.75;
  }

  &--cancelled &__title,
  &--cancelled &__meta:first-of-type {
    text-decoration: line-through;
  }

  &__link {
    @include focus-visible;

    display: flex;
    gap: $space-3;
    color: inherit;
    text-decoration: none;
  }

  &__date {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 52px;
    padding: $space-1;
    border-radius: $radius-md;
    background: color-mix(in srgb, var(--event-color) 12%, var(--color-surface));
    color: var(--event-color);
    line-height: 1.1;
  }

  &__weekday {
    font-size: $font-xs;
    font-weight: 700;
    text-transform: uppercase;
  }

  &__day {
    font-size: $font-md;
    font-weight: 800;
  }

  &__body {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  &__top {
    display: flex;
    flex-wrap: wrap;
    gap: $space-1;
  }

  &__title {
    font-size: $font-lg;
    font-weight: 800;
    overflow-wrap: anywhere;
  }

  &__meta {
    font-size: $font-sm;
    color: var(--color-text-muted);
    overflow-wrap: anywhere;
  }

  &__counts {
    display: flex;
    gap: $space-3;
    font-size: $font-sm;
    font-weight: 700;
    color: var(--color-text-muted);
  }

  &__count--yes {
    color: var(--color-yes);
  }

  &__count--maybe {
    color: var(--color-maybe);
  }

  &__count--no {
    color: var(--color-no);
  }
}
</style>
