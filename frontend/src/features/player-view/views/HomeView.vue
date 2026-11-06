<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import UiButton from '@/ui/UiButton.vue'
import UiEmptyState from '@/ui/UiEmptyState.vue'
import UiSection from '@/ui/UiSection.vue'
import UiSkeleton from '@/ui/UiSkeleton.vue'
import { useActiveTeam } from '@/features/teams/composables/useActiveTeam'
import DeclineSheet from '@/features/events/components/DeclineSheet.vue'
import { useAnswer } from '@/features/events/composables/useAnswer'
import { useMyMember, useTeamEvents } from '@/features/events/composables/useEvents'
import { useEventFormat } from '@/features/events/format'
import {
  splitEvents,
  unansweredEvents,
  type AttendanceStatus,
  type TeamEvent,
} from '@/features/events/logic'
import CoachTasks from '../components/CoachTasks.vue'
import EventTile from '@/features/events/components/EventTile.vue'
import NextEventCard from '../components/NextEventCard.vue'
import { nextEvent } from '../logic'

const { t } = useI18n()
const fmt = useEventFormat()
const { activeTeam, isCoach } = useActiveTeam()
const teamId = computed(() => activeTeam.value?.team_id ?? null)
const events = useTeamEvents(teamId)
const { members, myMember } = useMyMember(teamId)
const memberId = computed(() => myMember.value?.id ?? null)
const memberNames = computed(
  () => new Map((members.data.value ?? []).map((m) => [m.id, m.display_name])),
)
const playerIds = computed(() =>
  (members.data.value ?? []).filter((m) => m.role === 'player').map((m) => m.id),
)

const upcoming = computed(() => splitEvents(events.data.value ?? []).upcoming)
const next = computed(() => nextEvent(upcoming.value))
// The dates after the next one, answerable right here; everything else is under "Termine".
const AFTER_NEXT = 3
const later = computed(() =>
  upcoming.value.filter((e) => e.id !== next.value?.id).slice(0, AFTER_NEXT),
)
const shownIds = computed(() => new Set([next.value?.id, ...later.value.map((e) => e.id)]))
// Unanswered dates further ahead: a hint with a link to the full list.
const moreUnanswered = computed(
  () =>
    unansweredEvents(upcoming.value, memberId.value).filter((e) => !shownIds.value.has(e.id))
      .length,
)

const { answer, decline, declining } = useAnswer()
function onAnswer(event: TeamEvent, status: AttendanceStatus) {
  if (!memberId.value) return
  const previous = event.attendances.find((a) => a.member_id === memberId.value) ?? null
  const label = `${fmt.title(event)} · ${fmt.weekdayShort(event.starts_at)} ${fmt.dayMonth(event.starts_at)}`
  answer(event, memberId.value, previous, status, label)
}
</script>

<template>
  <div class="home">
    <h1 class="visually-hidden">{{ t('nav.start') }}</h1>

    <div v-if="events.isPending.value" class="home__loading" aria-busy="true">
      <UiSkeleton shape="block" height="320px" />
      <UiSkeleton shape="block" height="110px" />
    </div>
    <p v-else-if="events.isError.value" class="home__error" role="alert">
      {{ t('events.loadFailed') }}
    </p>

    <template v-else>
      <CoachTasks v-if="isCoach" :events="upcoming" :player-ids="playerIds" />
      <NextEventCard
        v-if="next"
        :event="next"
        :my-member="myMember"
        :is-coach="isCoach"
        :player-ids="playerIds"
        :team-name="activeTeam?.team_name ?? null"
        :names="memberNames"
        @answer="onAnswer(next, $event)"
      />
      <UiEmptyState
        v-else
        icon="calendar"
        :title="t('events.empty')"
        :text="isCoach ? t('events.emptyHintCoach') : t('events.emptyHint')"
      >
        <UiButton
          v-if="isCoach"
          icon="plus"
          :to="{ name: 'event-new', params: { kind: 'training' } }"
        >
          {{ t('events.newTraining') }}
        </UiButton>
      </UiEmptyState>

      <UiSection v-if="later.length" :title="t('player.later')">
        <EventTile
          v-for="event in later"
          :key="event.id"
          :event="event"
          :my-member="myMember"
          :is-coach="isCoach"
          :player-ids="playerIds"
          @answer="onAnswer(event, $event)"
        />
        <RouterLink v-if="moreUnanswered" :to="{ name: 'events' }" class="home__more">
          {{ t('events.reminder', moreUnanswered) }}
        </RouterLink>
      </UiSection>

      <UiButton variant="secondary" block icon="calendar" :to="{ name: 'events' }">
        {{ t('player.allEvents') }}
      </UiButton>
    </template>

    <DeclineSheet
      :request="declining"
      offer-absence
      @decline="decline"
      @cancel="declining = null"
    />
  </div>
</template>

<style scoped lang="scss">
.home {
  display: flex;
  flex-direction: column;
  gap: $space-5;

  &__loading {
    display: flex;
    flex-direction: column;
    gap: $space-2;
  }

  &__more {
    @include focus-visible;

    display: inline-flex;
    align-items: center;
    min-height: $touch-target;
    color: var(--color-maybe-text);
    font-weight: 700;
  }

  &__error {
    color: var(--color-danger);
  }
}
</style>
