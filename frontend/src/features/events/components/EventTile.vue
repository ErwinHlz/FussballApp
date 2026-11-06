<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AnswerControl from '@/ui/AnswerControl.vue'
import type { TeamMember } from '@/features/teams/api'
import { useEventFormat } from '../format'
import {
  answerCounts,
  canRespond,
  responseState,
  type AttendanceStatus,
  type TeamEvent,
} from '../logic'

/**
 * One date in a list (start page, "Termine"): slim and rectangular. A block in the event's
 * color with the date on the left, title and details in the middle, the own answer (players)
 * or the team's counts (coaches) on the right. The whole tile opens the event (card-link); the answer sits above it.
 */
const props = defineProps<{
  event: TeamEvent
  /** Own squad entry; null hides the answer (e.g. past dates). */
  myMember: TeamMember | null
  isCoach: boolean
  /** Squad players (coaches are not counted as missing answers). */
  playerIds: string[]
}>()
const emit = defineEmits<{ answer: [AttendanceStatus] }>()

const { t } = useI18n()
const fmt = useEventFormat()

const title = computed(() => fmt.title(props.event))
const meta = computed(() =>
  [
    props.event.is_cancelled ? t('events.cancelled') : null,
    fmt.timeRange(props.event),
    props.event.location,
    props.event.type === 'match'
      ? props.event.is_home === false
        ? t('events.away')
        : t('events.home')
      : null,
  ]
    .filter(Boolean)
    .join(' · '),
)
const myAttendance = computed(
  () => props.event.attendances.find((a) => a.member_id === props.myMember?.id) ?? null,
)
const canAnswer = computed(() => canRespond(props.event, props.isCoach))
const groupLabel = computed(
  () => `${t('ui.answer.question')} ${title.value}, ${fmt.dayMonth(props.event.starts_at)}`,
)
/** Only what the buttons cannot say: closed answers, automatic declines. */
const note = computed(() => {
  if (!props.myMember || props.event.is_cancelled) return null
  const parts: string[] = []
  const a = myAttendance.value
  if (a?.status === 'no' && a.source_absence_id) parts.push(t('events.state.absence'))
  else if (a?.status === 'no' && a.reason === 'injured' && !a.updated_by)
    parts.push(t('events.state.injured'))
  if (!canAnswer.value) {
    const state = responseState(props.event)
    if (state === 'deadlinePassed' || state === 'started')
      parts.push(t(`events.locked.short.${state}`))
  }
  return parts.length ? parts.join(' · ') : null
})
const counts = computed(() => answerCounts(props.event.attendances, props.playerIds))
</script>

<template>
  <article class="tile" :class="[`tile--${event.type}`, { 'tile--cancelled': event.is_cancelled }]">
    <span class="tile__date" aria-hidden="true">
      <span class="tile__weekday">{{ fmt.weekdayShort(event.starts_at) }}</span>
      <span class="tile__day">{{ fmt.dayMonth(event.starts_at) }}</span>
    </span>
    <RouterLink :to="{ name: 'event', params: { eventId: event.id } }" class="tile__link card-link">
      <span class="visually-hidden">
        {{ fmt.weekdayShort(event.starts_at) }} {{ fmt.dayMonth(event.starts_at) }}:
      </span>
      <span class="tile__title">{{ title }}</span>
      <span class="tile__meta">{{ meta }}</span>
      <span v-if="note" class="tile__note">{{ note }}</span>
    </RouterLink>
    <template v-if="!event.is_cancelled">
      <AnswerControl
        v-if="myMember && !isCoach"
        variant="compact"
        :status="myAttendance?.status ?? null"
        :disabled="!canAnswer"
        :label="groupLabel"
        class="tile__answer card-link-above"
        @answer="emit('answer', $event)"
      />
      <span
        v-else-if="isCoach"
        class="tile__counts"
        role="img"
        :aria-label="t('events.countsLabel', counts)"
      >
        <span class="tile__count tile__count--yes">✓ {{ counts.yes }}</span>
        <span class="tile__count tile__count--no">✗ {{ counts.no }}</span>
        <span class="tile__count">– {{ counts.none }}</span>
      </span>
    </template>
  </article>
</template>

<style scoped lang="scss">
.tile {
  --type: var(--color-training);

  position: relative;
  display: flex;
  align-items: center;
  gap: $space-3;
  min-height: 64px;
  padding-right: $space-2;
  overflow: hidden;
  border-radius: $radius-sm;
  background: var(--color-surface);

  &--match {
    --type: var(--color-match);
  }

  &--event {
    --type: var(--color-event);
  }

  &--cancelled {
    --type: var(--color-text-muted);
  }

  &__date {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    align-self: stretch;
    flex-shrink: 0;
    width: 60px;
    background: var(--type);
    color: #ffffff;
    line-height: 1.1;
  }

  &__weekday {
    font-size: $font-xs;
    font-weight: 800;
    text-transform: uppercase;
  }

  &__day {
    font-family: var(--font-display);
    font-size: $font-lg;
    font-weight: 800;
  }

  &__link {
    @include focus-visible;

    display: flex;
    flex: 1;
    flex-direction: column;
    justify-content: center;
    min-width: 0;
    min-height: $touch-target;
    padding: $space-2 0;
    color: inherit;
    text-decoration: none;
  }

  &__title {
    display: -webkit-box;
    overflow: hidden;
    font-weight: 800;
    line-height: 1.2;
    overflow-wrap: anywhere;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  &__meta,
  &__note {
    overflow: hidden;
    font-size: $font-sm;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__meta {
    color: var(--color-text-muted);
  }

  &__note {
    color: var(--color-maybe-text);
    font-weight: 700;
  }

  &--cancelled &__title {
    text-decoration: line-through;
  }

  &__answer {
    flex-shrink: 0;
  }

  &__counts {
    display: flex;
    flex-shrink: 0;
    gap: $space-2;
    font-size: $font-sm;
    font-weight: 800;
  }

  &__count--yes {
    color: var(--color-yes-text);
  }

  &__count--no {
    color: var(--color-no-text);
  }
}
</style>
