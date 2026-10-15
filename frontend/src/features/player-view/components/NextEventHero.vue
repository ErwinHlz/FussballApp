<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TeamMember } from '@/features/teams/api'
import AttendanceControl from '@/features/events/components/AttendanceControl.vue'
import EventBadges from '@/features/events/components/EventBadges.vue'
import { useEventFormat } from '@/features/events/format'
import type { TeamEvent } from '@/features/events/logic'
import MyTrainingFlow from './MyTrainingFlow.vue'
import { relativeDay } from '../logic'

/** "Up next": everything a player needs within seconds. */
const props = defineProps<{ event: TeamEvent; myMember: TeamMember | null; isCoach: boolean }>()

const { t } = useI18n()
const fmt = useEventFormat()

const when = computed(() => {
  const rel = relativeDay(props.event.starts_at)
  if (rel.kind === 'today') return t('player.today')
  if (rel.kind === 'tomorrow') return t('player.tomorrow')
  if (rel.kind === 'inDays')
    return `${fmt.weekdayShort(props.event.starts_at)}, ${t('player.inDays', { n: rel.days })}`
  return fmt.longDay(props.event.starts_at)
})
const myAttendance = computed(
  () => props.event.attendances.find((a) => a.member_id === props.myMember?.id) ?? null,
)
const showPlan = computed(
  () => props.event.type === 'training' && props.event.plan_status === 'published',
)
</script>

<template>
  <article class="hero" :class="`hero--${event.type}`" aria-labelledby="hero-title">
    <p class="hero__eyebrow">{{ t('player.upNext') }}</p>

    <header class="hero__header">
      <EventBadges :event="event" />
      <h2 id="hero-title" class="hero__title">{{ fmt.title(event) }}</h2>
      <p class="hero__when">
        <strong>{{ when }}</strong> · {{ fmt.timeRange(event) }}
      </p>
      <p v-if="event.location" class="hero__muted">📍 {{ event.location }}</p>
    </header>

    <!-- Match: meeting point first -->
    <template v-if="event.type === 'match'">
      <div class="hero__facts">
        <div v-if="event.meet_at || event.meet_location" class="hero__fact hero__fact--main">
          <span class="hero__fact-label">{{ t('player.meet') }}</span>
          <span class="hero__fact-value">
            {{ event.meet_at ? fmt.time(event.meet_at) : '' }}
            <template v-if="event.meet_location"> · {{ event.meet_location }}</template>
          </span>
        </div>
        <div class="hero__fact">
          <span class="hero__fact-label">{{ t('events.form.kickoff') }}</span>
          <span class="hero__fact-value">{{ fmt.time(event.starts_at) }}</span>
        </div>
      </div>
    </template>

    <!-- Training: flow with own group -->
    <template v-else>
      <MyTrainingFlow v-if="showPlan" :event-id="event.id" :member-id="myMember?.id ?? null" />
      <p v-else class="hero__muted">{{ t('player.planNotYet') }}</p>
    </template>

    <div v-if="myMember" class="hero__answer">
      <p class="hero__answer-label">{{ t('player.areYouIn') }}</p>
      <AttendanceControl
        :event="event"
        :member-id="myMember.id"
        :attendance="myAttendance"
        :as-coach="isCoach"
      />
    </div>

    <RouterLink :to="{ name: 'event', params: { eventId: event.id } }" class="hero__details">
      {{ t('player.details') }} ›
    </RouterLink>
  </article>
</template>

<style scoped lang="scss">
.hero {
  --event-color: var(--color-training);
  --event-text: var(--color-training-text);

  display: flex;
  flex-direction: column;
  gap: $space-4;
  padding: $space-4;
  border: 2px solid var(--event-color);
  border-radius: $radius-lg;
  background: color-mix(in srgb, var(--event-color) 6%, var(--color-surface));
  box-shadow: var(--shadow-md);

  &--match {
    --event-color: var(--color-match);
    --event-text: var(--color-match-text);
  }

  &--event {
    --event-color: var(--color-event);
    --event-text: var(--color-event-text);
  }

  &__eyebrow {
    font-size: $font-xs;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--event-text);
  }

  &__header {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: $space-1;
  }

  &__title {
    font-size: $font-2xl;
    line-height: 1.15;
    overflow-wrap: anywhere;
  }

  &__when {
    font-size: $font-lg;
  }

  &__facts {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: $space-2;
  }

  &__fact {
    display: flex;
    flex-direction: column;
    padding: $space-2 $space-3;
    border-radius: $radius-md;
    background: var(--color-surface);

    &--main {
      border: 2px solid var(--event-color);
    }
  }

  &__fact-label {
    font-size: $font-xs;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  &__fact-value {
    font-size: $font-lg;
    font-weight: 800;
    overflow-wrap: anywhere;
  }

  &__answer {
    display: flex;
    flex-direction: column;
    gap: $space-2;
  }

  &__answer-label {
    font-weight: 700;
  }

  &__details {
    @include focus-visible;

    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    min-height: $touch-target;
    font-weight: 700;
    text-decoration: none;
  }

  &__muted {
    color: var(--color-text-muted);
  }
}
</style>
