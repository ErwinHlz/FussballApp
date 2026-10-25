<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { format } from 'date-fns'
import BottomSheet from '@/ui/BottomSheet.vue'
import UiButton from '@/ui/UiButton.vue'
import UiEmptyState from '@/ui/UiEmptyState.vue'
import UiSection from '@/ui/UiSection.vue'
import UiSkeleton from '@/ui/UiSkeleton.vue'
import WeekStrip, { type WeekDay } from '@/ui/WeekStrip.vue'
import { useSnackbar } from '@/ui/useSnackbar'
import { useActiveTeam } from '@/features/teams/composables/useActiveTeam'
import DeclineSheet from '@/features/events/components/DeclineSheet.vue'
import EventRow from '@/features/events/components/EventRow.vue'
import { useAnswer } from '@/features/events/composables/useAnswer'
import { useAttendAll, useMyMember, useTeamEvents } from '@/features/events/composables/useEvents'
import { useEventFormat } from '@/features/events/format'
import {
  attendAllCandidates,
  splitEvents,
  unansweredEvents,
  type AttendanceStatus,
  type TeamEvent,
} from '@/features/events/logic'
import CoachTasks from '../components/CoachTasks.vue'
import NextEventCard from '../components/NextEventCard.vue'
import { nextEvent, stripDays } from '../logic'

const { t } = useI18n()
const fmt = useEventFormat()
const snackbar = useSnackbar()
const { activeTeam, isCoach } = useActiveTeam()
const teamId = computed(() => activeTeam.value?.team_id ?? null)
const events = useTeamEvents(teamId)
const { members, myMember } = useMyMember(teamId)
const memberId = computed(() => myMember.value?.id ?? null)
const playerIds = computed(() =>
  (members.data.value ?? []).filter((m) => m.role === 'player').map((m) => m.id),
)

const upcoming = computed(() => splitEvents(events.data.value ?? []).upcoming)
const next = computed(() => nextEvent(upcoming.value))
// Answered here stays in the list (with its new answer) until the page is left, so rows do
// not jump away under the finger.
const seenWaiting = ref(new Set<string>())
watchEffect(() => {
  for (const e of unansweredEvents(upcoming.value, memberId.value)) seenWaiting.value.add(e.id)
})
// Coaches answer on the side; their start page is about the team (CoachTasks).
const waiting = computed(() =>
  isCoach.value
    ? []
    : upcoming.value.filter((e) => seenWaiting.value.has(e.id) && e.id !== next.value?.id),
)

// The next seven days from today, with a mark per event type.
const isoDay = (d: Date) => format(d, 'yyyy-MM-dd')
const today = isoDay(new Date())
const week = computed<WeekDay[]>(() =>
  stripDays().map((date) => {
    const marks = (events.data.value ?? [])
      .filter((e) => !e.is_cancelled && isoDay(new Date(e.starts_at)) === date)
      .map((e) => e.type)
    return { date, marks }
  }),
)
const selectedDay = ref<string | null>(null)
const dayEvents = computed(() =>
  selectedDay.value
    ? (events.data.value ?? []).filter((e) => isoDay(new Date(e.starts_at)) === selectedDay.value)
    : [],
)

const { answer, decline, declining } = useAnswer()
function onAnswer(event: TeamEvent, status: AttendanceStatus) {
  if (!memberId.value) return
  const previous = event.attendances.find((a) => a.member_id === memberId.value) ?? null
  const label = `${fmt.title(event)} · ${fmt.weekdayShort(event.starts_at)} ${fmt.dayMonth(event.starts_at)}`
  answer(event, memberId.value, previous, status, label)
}

// "Attend all" for the dates waiting for an answer.
const attendAll = useAttendAll()
const attendOpen = ref(false)
const candidates = computed(() => attendAllCandidates(waiting.value, memberId.value))
async function confirmAttendAll() {
  try {
    const result = await attendAll.mutateAsync({
      eventIds: candidates.value.map((e) => e.id),
      memberId: memberId.value!,
    })
    attendOpen.value = false
    snackbar.show({
      text: result.skipped
        ? t('events.attendAll.doneSkipped', { n: result.saved, skipped: result.skipped })
        : t('events.attendAll.done', result.saved),
    })
  } catch {
    attendOpen.value = false
    snackbar.show({ text: t('events.attendAll.failed'), tone: 'error' })
  }
}
</script>

<template>
  <div class="home">
    <h1 class="visually-hidden">{{ t('nav.start') }}</h1>

    <WeekStrip v-model="selectedDay" :days="week" :today="today" :label="t('player.nextDays')" />
    <section v-if="selectedDay" class="home__day" :aria-label="t('player.dayEvents')">
      <EventRow
        v-for="event in dayEvents"
        :key="event.id"
        :event="event"
        :my-member="myMember"
        :is-coach="isCoach"
        :player-ids="playerIds"
        @answer="onAnswer(event, $event)"
      />
      <p v-if="!dayEvents.length" class="home__muted">{{ t('player.noEventThatDay') }}</p>
    </section>

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

      <UiSection v-if="waiting.length" :title="t('player.waiting')" :count="waiting.length">
        <UiButton
          v-if="candidates.length > 1"
          variant="secondary"
          icon="check"
          block
          @click="attendOpen = true"
        >
          {{ t('events.attendAll.button') }}
        </UiButton>
        <EventRow
          v-for="event in waiting"
          :key="event.id"
          :event="event"
          :my-member="myMember"
          :is-coach="isCoach"
          :player-ids="playerIds"
          @answer="onAnswer(event, $event)"
        />
      </UiSection>

      <UiButton variant="secondary" block icon="calendar" :to="{ name: 'events' }">
        {{ t('player.allEvents') }}
      </UiButton>
    </template>

    <DeclineSheet :request="declining" @decline="decline" @cancel="declining = null" />

    <BottomSheet v-model:open="attendOpen" :title="t('events.attendAll.title')">
      <p>{{ t('events.attendAll.text', candidates.length) }}</p>
      <p class="home__muted">{{ t('events.attendAll.hint') }}</p>
      <template #footer>
        <UiButton variant="secondary" @click="attendOpen = false">{{
          t('common.cancel')
        }}</UiButton>
        <UiButton :loading="attendAll.isPending.value" @click="confirmAttendAll">
          {{ t('events.attendAll.confirm', { n: candidates.length }) }}
        </UiButton>
      </template>
    </BottomSheet>
  </div>
</template>

<style scoped lang="scss">
.home {
  display: flex;
  flex-direction: column;
  gap: $space-5;

  &__day,
  &__loading {
    display: flex;
    flex-direction: column;
    gap: $space-2;
  }

  &__muted {
    color: var(--color-text-muted);
    font-size: $font-sm;
  }

  &__error {
    color: var(--color-danger);
  }
}
</style>
