<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AnswerControl from '@/ui/AnswerControl.vue'
import ChalkCard from '@/ui/ChalkCard.vue'
import UiIcon from '@/ui/UiIcon.vue'
import type { TeamMember } from '@/features/teams/api'
import { useEventFormat } from '@/features/events/format'
import {
  canRespond,
  responseState,
  type AttendanceStatus,
  type TeamEvent,
} from '@/features/events/logic'
import MyBibs from './MyBibs.vue'
import { relativeDay } from '../logic'

/**
 * "Up next" on the start page, readable in seconds: when (big), where, my bibs, my answer.
 * The match nomination is deliberately not shown here (only on the event page).
 */
const props = defineProps<{
  event: TeamEvent
  myMember: TeamMember | null
  isCoach: boolean
  playerIds: string[]
}>()
const emit = defineEmits<{ answer: [AttendanceStatus]; absence: [] }>()

const { t } = useI18n()
const fmt = useEventFormat()

const when = computed(() => {
  const rel = relativeDay(props.event.starts_at)
  if (rel.kind === 'today') return t('player.today')
  if (rel.kind === 'tomorrow') return t('player.tomorrow')
  if (rel.kind === 'inDays') return t('player.inDays', { n: rel.days })
  return fmt.weekdayShort(props.event.starts_at)
})
const typeLabel = computed(() =>
  props.event.type === 'training'
    ? t('events.training')
    : props.event.type === 'match'
      ? t('events.match')
      : t('events.event'),
)
const heading = computed(() => (props.event.type === 'training' ? null : fmt.title(props.event)))
const myAttendance = computed(
  () => props.event.attendances.find((a) => a.member_id === props.myMember?.id) ?? null,
)
const canAnswer = computed(() => canRespond(props.event, props.isCoach))
const lockedHint = computed(() => {
  if (canAnswer.value) return null
  const state = responseState(props.event)
  return state === 'deadlinePassed' || state === 'started' ? t(`events.locked.${state}`) : null
})
const prefilledInjured = computed(
  () =>
    myAttendance.value?.status === 'no' &&
    myAttendance.value.reason === 'injured' &&
    !myAttendance.value.updated_by,
)
const showBibs = computed(
  () => props.event.type === 'training' && props.event.plan_status === 'published',
)
const counts = computed(() => {
  const players = new Set(props.playerIds)
  const c = { yes: 0, maybe: 0, no: 0, none: 0 }
  for (const a of props.event.attendances) if (players.has(a.member_id)) c[a.status]++
  c.none = Math.max(0, players.size - c.yes - c.maybe - c.no)
  return c
})
</script>

<template>
  <ChalkCard class="next" :class="`next--${event.type}`" aria-labelledby="next-event-title">
    <svg class="next__drawing" viewBox="0 0 150 150" aria-hidden="true">
      <circle cx="75" cy="75" r="48" class="next__ring" />
      <circle cx="75" cy="27" r="8" class="next__dot" />
      <circle cx="123" cy="75" r="8" class="next__dot" />
      <circle cx="75" cy="123" r="8" class="next__dot" />
      <circle cx="27" cy="75" r="8" class="next__dot" />
      <circle cx="66" cy="70" r="7" class="next__chaser" />
      <circle cx="86" cy="82" r="7" class="next__chaser" />
    </svg>

    <div class="next__head">
      <h2 id="next-event-title" class="next__eyebrow">
        {{ t('player.upNext') }} · {{ when }} · {{ typeLabel }}
      </h2>
      <p v-if="heading" class="next__title">{{ heading }}</p>
      <p class="next__time">{{ fmt.time(event.starts_at) }}</p>
      <p class="next__where">
        {{ fmt.weekdayShort(event.starts_at) }} {{ fmt.dayMonth(event.starts_at) }}
        <template v-if="event.ends_at"
          >· {{ t('player.until', { time: fmt.time(event.ends_at) }) }}</template
        >
      </p>
      <p v-if="event.location" class="next__line">
        <UiIcon name="pin" :size="18" />{{ event.location }}
      </p>
      <p v-if="event.meet_at || event.meet_location" class="next__line">
        <UiIcon name="clock" :size="18" />
        {{ t('events.meet') }}
        {{ event.meet_at ? fmt.time(event.meet_at) : '' }}
        {{ event.meet_location ? `· ${event.meet_location}` : '' }}
      </p>
    </div>

    <MyBibs v-if="showBibs" :event-id="event.id" :member-id="myMember?.id ?? null" />

    <!-- Coaches answer on the side: the team's counts come first. -->
    <div v-if="myMember && isCoach" class="next__own">
      <span class="next__own-label">{{ t('player.ownAnswer') }}</span>
      <AnswerControl
        variant="compact"
        :status="myAttendance?.status ?? null"
        :disabled="!canAnswer"
        @answer="emit('answer', $event)"
      />
    </div>
    <template v-else-if="myMember">
      <AnswerControl
        :status="myAttendance?.status ?? null"
        :disabled="!canAnswer"
        @answer="emit('answer', $event)"
      />
      <p v-if="lockedHint" class="next__hint">{{ lockedHint }}</p>
      <p v-else-if="prefilledInjured" class="next__hint">{{ t('events.prefilledInjured') }}</p>
    </template>

    <p v-if="isCoach" class="next__counts">
      <strong>{{ t('player.countYes', { n: counts.yes }) }}</strong>
      · {{ t('player.countMaybe', { n: counts.maybe }) }} ·
      {{ t('player.countOpen', { n: counts.none }) }}
    </p>

    <div class="next__links">
      <RouterLink :to="{ name: 'event', params: { eventId: event.id } }" class="next__more">
        {{ event.type === 'training' ? t('player.flowAndDetails') : t('player.allDetails') }}
        <UiIcon name="arrowRight" :size="18" />
      </RouterLink>
      <!-- Holidays and the like: one absence instead of declining date by date. -->
      <button v-if="myMember" type="button" class="next__away" @click="emit('absence')">
        {{ t('player.away') }}
      </button>
    </div>
  </ChalkCard>
</template>

<style scoped lang="scss">
.next {
  --type-text: var(--color-training-text);

  &--match {
    --type-text: var(--color-match-text);
  }

  &--event {
    --type-text: var(--color-event-text);
  }

  &__drawing {
    position: absolute;
    top: -10px;
    right: -14px;
    width: 150px;
    height: 150px;
    opacity: 0.45;
    pointer-events: none;
  }

  &__ring {
    fill: none;
    stroke: var(--color-chalk);
    stroke-width: 2;
    stroke-dasharray: 6 6;
  }

  &__dot {
    fill: var(--color-text);
  }

  &__chaser {
    fill: none;
    stroke: var(--color-primary);
    stroke-width: 3;
  }

  &__head {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__eyebrow {
    color: var(--type-text);
    font-family: var(--font-sans);
    font-size: $font-sm;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  &__title {
    font-family: var(--font-display);
    font-size: $font-2xl;
    font-weight: 800;
    line-height: 1.1;
  }

  &__time {
    font-family: var(--font-display);
    font-size: 4rem;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    line-height: 0.95;
  }

  &__where {
    color: var(--color-text-muted);
    font-weight: 700;
  }

  &__line {
    display: flex;
    align-items: center;
    gap: $space-1;
    color: var(--color-text-muted);
    font-weight: 600;
  }

  &__hint,
  &__links {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: $space-2;
  }

  &__away {
    @include focus-visible;

    min-height: $touch-target;
    padding: 0 $space-2;
    border: 0;
    background: transparent;
    color: var(--color-text-muted);
    font-weight: 700;
    text-decoration: underline;
    text-underline-offset: 4px;
  }

  &__own {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $space-3;
  }

  &__own-label {
    color: var(--color-text-muted);
    font-size: $font-sm;
    font-weight: 700;
  }

  &__counts {
    color: var(--color-text-muted);
    font-size: $font-sm;
  }

  &__counts strong {
    color: var(--color-yes-text);
  }

  &__more {
    @include focus-visible;

    position: relative;
    display: inline-flex;
    align-self: flex-start;
    align-items: center;
    gap: $space-1;
    min-height: $touch-target;
    color: var(--color-text);
    font-weight: 800;
    text-decoration: underline;
    text-decoration-color: var(--color-primary);
    text-decoration-thickness: 3px;
    text-underline-offset: 5px;
  }
}
</style>
