<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AnswerControl from '@/ui/AnswerControl.vue'
import DateBlock from '@/ui/DateBlock.vue'
import UiBadge from '@/ui/UiBadge.vue'
import UiIcon from '@/ui/UiIcon.vue'
import type { TeamMember } from '@/features/teams/api'
import { useEventFormat } from '../format'
import { canRespond, responseState, type AttendanceStatus, type TeamEvent } from '../logic'

/**
 * One event in a list: date block and title link to the detail, below the own answer (players)
 * or the team's counts (coaches).
 */
const props = defineProps<{
  event: TeamEvent
  myMember: TeamMember | null
  isCoach: boolean
  /** Squad players (coaches are not counted as missing answers). */
  playerIds: string[]
}>()
const emit = defineEmits<{ answer: [AttendanceStatus] }>()

const { t } = useI18n()
const fmt = useEventFormat()

const myAttendance = computed(
  () => props.event.attendances.find((a) => a.member_id === props.myMember?.id) ?? null,
)
const canAnswer = computed(() => canRespond(props.event, props.isCoach))
const title = computed(() => fmt.title(props.event))
const meta = computed(() =>
  [fmt.timeRange(props.event), props.event.location].filter(Boolean).join(' · '),
)
const groupLabel = computed(
  () => `${t('ui.answer.question')} ${title.value}, ${fmt.dayMonth(props.event.starts_at)}`,
)

const myState = computed(() => {
  const a = myAttendance.value
  if (!canAnswer.value && !props.event.is_cancelled) {
    const state = responseState(props.event)
    if (state !== 'open' && state !== 'cancelled') return t(`events.locked.short.${state}`)
  }
  if (!a) return t('events.state.none')
  if (a.status === 'no' && a.source_absence_id) return t('events.state.absence')
  if (a.status === 'no' && a.reason === 'injured' && !a.updated_by) return t('events.state.injured')
  return t(`events.state.${a.status}`)
})

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
const nominated = computed(
  () => props.event.match_squad.find((s) => s.member_id === props.myMember?.id) ?? null,
)
</script>

<template>
  <article
    class="event-row"
    :class="[`event-row--${event.type}`, { 'event-row--cancelled': event.is_cancelled }]"
  >
    <RouterLink :to="{ name: 'event', params: { eventId: event.id } }" class="event-row__link">
      <DateBlock :date="event.starts_at" :tone="event.is_cancelled ? 'neutral' : event.type" />
      <span class="event-row__text">
        <span class="event-row__title">{{ title }}</span>
        <span class="event-row__meta">{{ meta }}</span>
        <span
          v-if="event.is_cancelled || event.type !== 'training' || nominated"
          class="event-row__badges"
        >
          <UiBadge v-if="event.is_cancelled" tone="no">{{ t('events.cancelled') }}</UiBadge>
          <UiBadge v-else-if="event.type === 'match'" tone="match">
            {{ event.is_home === false ? t('events.away') : t('events.home') }}
          </UiBadge>
          <UiBadge v-else-if="event.type === 'event'" tone="event">{{ t('events.event') }}</UiBadge>
          <UiBadge v-if="nominated && !event.is_cancelled" tone="accent">
            {{ t(`events.squadRole.${nominated.role}`) }}
          </UiBadge>
        </span>
      </span>
      <UiIcon name="chevronRight" :size="20" class="event-row__chevron" />
    </RouterLink>

    <div v-if="!event.is_cancelled && (myMember || isCoach)" class="event-row__foot">
      <!-- Coaches see the team's counts; they answer for themselves on the event page. -->
      <template v-if="myMember && !isCoach">
        <AnswerControl
          variant="compact"
          :status="myAttendance?.status ?? null"
          :disabled="!canAnswer"
          :label="groupLabel"
          @answer="emit('answer', $event)"
        />
        <span class="event-row__state">{{ myState }}</span>
      </template>
      <span
        v-if="isCoach"
        class="event-row__counts"
        role="img"
        :aria-label="t('events.countsLabel', counts)"
      >
        <span class="event-row__count event-row__count--yes">✓ {{ counts.yes }}</span>
        <span class="event-row__count event-row__count--maybe">? {{ counts.maybe }}</span>
        <span class="event-row__count event-row__count--no">✗ {{ counts.no }}</span>
        <span class="event-row__count">– {{ counts.none }}</span>
      </span>
    </div>
  </article>
</template>

<style scoped lang="scss">
.event-row {
  --type-color: var(--color-border);

  display: flex;
  flex-direction: column;
  border-radius: $radius-xl;
  background: var(--color-surface);
  box-shadow: inset 4px 0 0 var(--type-color);

  &--training {
    --type-color: var(--color-training);
  }

  &--match {
    --type-color: var(--color-match);
  }

  &--event {
    --type-color: var(--color-event);
  }

  &--cancelled {
    --type-color: var(--color-border);
  }

  &__link {
    @include focus-visible;

    display: flex;
    align-items: center;
    gap: $space-3;
    min-height: 72px;
    padding: $space-3 $space-3 $space-3 $space-3;
    border-radius: $radius-xl;
    color: inherit;
    text-decoration: none;
  }

  &__text {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  &__title {
    @include truncate;

    font-size: $font-lg;
    font-weight: 800;
  }

  &--cancelled &__title {
    text-decoration: line-through;
  }

  &__meta {
    color: var(--color-text-muted);
    font-size: $font-sm;
  }

  &__badges {
    display: flex;
    flex-wrap: wrap;
    gap: $space-1;
    margin-top: 2px;
  }

  &__chevron {
    color: var(--color-text-muted);
  }

  &__foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: $space-2 $space-3;
    padding: 0 $space-3 $space-3 calc(56px + #{$space-3} * 2);
  }

  &__state {
    color: var(--color-text-muted);
    font-size: $font-sm;
    font-weight: 700;
  }

  &__counts {
    display: inline-flex;
    gap: $space-2;
    margin-left: auto;
    font-size: $font-sm;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    color: var(--color-text-muted);
  }

  &__count--yes {
    color: var(--color-yes-text);
  }

  &__count--maybe {
    color: var(--color-maybe-text);
  }

  &__count--no {
    color: var(--color-no-text);
  }
}
</style>
