<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AnswerControl from '@/ui/AnswerControl.vue'
import ChalkCard from '@/ui/ChalkCard.vue'
import UiIcon from '@/ui/UiIcon.vue'
import type { TeamMember } from '@/features/teams/api'
import { useEventFormat } from '@/features/events/format'
import { useSetPlanStatus } from '@/features/training-plan/composables/usePlan'
import { useSnackbar } from '@/ui/useSnackbar'
import UiButton from '@/ui/UiButton.vue'
import {
  answerCounts,
  canRespond,
  responseState,
  type AttendanceStatus,
  type TeamEvent,
} from '@/features/events/logic'
import PlanGlance from './PlanGlance.vue'
import { relativeDay } from '../logic'

/**
 * "Up next" on the start page, readable in seconds: team, when (big), where, training plan and
 * groups (if there are any), my answer.
 */
const props = defineProps<{
  event: TeamEvent
  myMember: TeamMember | null
  isCoach: boolean
  playerIds: string[]
  teamName: string | null
  /** Squad names by member id (for the groups). */
  names: Map<string, string>
}>()
const emit = defineEmits<{ answer: [AttendanceStatus] }>()

const { t } = useI18n()
const fmt = useEventFormat()
const snackbar = useSnackbar()
const setStatus = useSetPlanStatus()

// The place opens in the phone's maps app (free text, so a search).
const mapsUrl = computed(() =>
  props.event.location
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(props.event.location)}`
    : null,
)
const isTraining = computed(() => props.event.type === 'training' && !props.event.is_cancelled)
function publish() {
  setStatus.mutate(
    { eventId: props.event.id, status: 'published' },
    {
      onSuccess: () => snackbar.show({ text: t('plan.publishedHint') }),
      onError: () => snackbar.show({ text: t('plan.saveFailed'), tone: 'error' }),
    },
  )
}

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
const answerLabel = computed(
  () =>
    `${t('ui.answer.question')} ${fmt.title(props.event)}, ${fmt.dayMonth(props.event.starts_at)}`,
)
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
// Players see published plans; coaches also their draft (marked).
const showPlan = computed(
  () =>
    props.event.type === 'training' &&
    !props.event.is_cancelled &&
    (props.event.plan_status === 'published' || props.isCoach),
)
const counts = computed(() => answerCounts(props.event.attendances, props.playerIds))
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
      <p v-if="teamName" class="next__team">{{ teamName }}</p>
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
      <a
        v-if="mapsUrl"
        :href="mapsUrl"
        target="_blank"
        rel="noopener"
        class="next__place card-link-above"
      >
        <UiIcon name="pin" :size="18" />
        <span class="next__place-name">{{ event.location }}</span>
        <span class="next__place-route">{{ t('player.route') }}</span>
      </a>
      <p v-if="event.meet_at || event.meet_location" class="next__line">
        <UiIcon name="clock" :size="18" />
        {{ t('events.meet') }}
        {{ event.meet_at ? fmt.time(event.meet_at) : '' }}
        {{ event.meet_location ? `· ${event.meet_location}` : '' }}
      </p>
    </div>

    <PlanGlance
      v-if="showPlan"
      :event-id="event.id"
      :member-id="myMember?.id ?? null"
      :names="names"
      :draft="event.plan_status !== 'published'"
      :show-all="isCoach"
    />

    <div v-if="isCoach && isTraining" class="next__coach card-link-above">
      <UiButton variant="secondary" :to="{ name: 'event-plan', params: { eventId: event.id } }">
        {{ t('plan.edit') }}
      </UiButton>
      <UiButton variant="secondary" :to="{ name: 'event-groups', params: { eventId: event.id } }">
        {{ t('groups.short') }}
      </UiButton>
      <UiButton
        v-if="event.plan_status !== 'published'"
        :loading="setStatus.isPending.value"
        @click="publish"
      >
        {{ t('plan.publish') }}
      </UiButton>
    </div>

    <p v-if="isCoach" class="next__counts">
      <strong>{{ t('player.countYes', { n: counts.yes }) }}</strong>
      · {{ t('player.countMaybe', { n: counts.maybe }) }} ·
      {{ t('player.countOpen', { n: counts.none }) }}
    </p>
    <p v-if="myMember && lockedHint" class="next__hint">{{ lockedHint }}</p>
    <p v-else-if="myMember && prefilledInjured" class="next__hint">
      {{ t('events.prefilledInjured') }}
    </p>

    <!-- Always the same place, whatever is above: answer bottom left, details bottom right.
         The details link covers the whole card (card-link); everything tappable sits above it. -->
    <div class="next__foot">
      <AnswerControl
        v-if="myMember"
        variant="compact"
        :status="myAttendance?.status ?? null"
        :disabled="!canAnswer"
        :label="answerLabel"
        class="card-link-above"
        @answer="emit('answer', $event)"
      />
      <RouterLink
        :to="{ name: 'event', params: { eventId: event.id } }"
        class="next__more card-link"
      >
        {{ event.type === 'training' ? t('player.flowAndDetails') : t('player.allDetails') }}
        <UiIcon name="arrowRight" :size="18" />
      </RouterLink>
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

  &__team {
    font-weight: 800;
    overflow-wrap: anywhere;
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
    font-size: $font-xl;
    font-weight: 800;
    line-height: 1.1;
  }

  &__time {
    font-family: var(--font-display);
    font-size: $font-3xl;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    line-height: 1;
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

  &__place {
    @include focus-visible;

    position: relative;
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    align-self: flex-start;
    gap: $space-1;
    min-height: $touch-target;
    color: var(--color-text);
    font-weight: 700;
    text-decoration: none;
  }

  &__place-name {
    text-decoration: underline;
    text-underline-offset: 4px;
  }

  &__place-route {
    color: var(--color-text-muted);
    font-size: $font-sm;
  }

  &__coach {
    display: flex;
    flex-wrap: wrap;
    gap: $space-2;
  }

  &__foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $space-2;
    padding-top: $space-3;
    border-top: 1px solid var(--color-border);
  }

  &__hint {
    color: var(--color-text-muted);
    font-size: $font-sm;
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

    display: inline-flex;
    align-items: center;
    gap: $space-1;
    min-height: $touch-target;
    margin-left: auto;
    color: var(--color-text);
    font-size: $font-sm;
    font-weight: 800;
    text-align: right;
    text-decoration: underline;
    text-decoration-color: var(--color-primary);
    text-decoration-thickness: 3px;
    text-underline-offset: 5px;
  }
}
</style>
