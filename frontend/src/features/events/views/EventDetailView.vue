<script setup lang="ts">
import { format } from 'date-fns'
import { mapsUrl } from '@/lib/maps'
import { useTrainingMatchConflicts } from '@/features/schedule/composables/useSchedule'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import ActionBar from '@/ui/ActionBar.vue'
import BottomSheet from '@/ui/BottomSheet.vue'
import OverflowMenu, { type OverflowItem } from '@/ui/OverflowMenu.vue'
import UiButton from '@/ui/UiButton.vue'
import UiInput from '@/ui/UiInput.vue'
import { useSnackbar } from '@/ui/useSnackbar'
import AnswerControl from '@/ui/AnswerControl.vue'
import UiBadge from '@/ui/UiBadge.vue'
import UiIcon from '@/ui/UiIcon.vue'
import UiSkeleton from '@/ui/UiSkeleton.vue'
import { useActiveTeam } from '@/features/teams/composables/useActiveTeam'
import TrainingFlow from '@/features/player-view/components/TrainingFlow.vue'
import { relativeDay } from '@/features/player-view/logic'
import PlanSection from '@/features/training-plan/components/PlanSection.vue'
import AttachToSchedule from '@/features/schedule/components/AttachToSchedule.vue'
import AttendanceOverview from '../components/AttendanceOverview.vue'
import DeclineSheet from '../components/DeclineSheet.vue'
import EventCoachNav from '../components/EventCoachNav.vue'
import { useAnswer } from '../composables/useAnswer'
import { useDeleteWithUndo } from '../composables/useDeleteWithUndo'
import { useEvent, useMyMember, useUpdateEvent } from '../composables/useEvents'
import { useEventFormat } from '../format'
import { canRespond, responseState, SQUAD_ROLES, type AttendanceStatus } from '../logic'
import PageProblem from '@/ui/PageProblem.vue'

const props = defineProps<{ eventId: string }>()

const { t } = useI18n()
const router = useRouter()
const fmt = useEventFormat()
const event = useEvent(() => props.eventId)
const teamId = computed(() => event.data.value?.team_id ?? null)
const { members, myMember } = useMyMember(teamId)
const { myTeams } = useActiveTeam()
const updateEvent = useUpdateEvent()
const deleteWithUndo = useDeleteWithUndo()
const snackbar = useSnackbar()

// Coach rights for the event's team (not just the active one).
const isCoach = computed(() => {
  const team = myTeams.data.value?.find((t) => t.team_id === teamId.value)
  return !!team && (team.team_role === 'coach' || team.is_club_admin)
})

const e = computed(() => event.data.value)
// Upcoming trainings that are not in the club's schedule yet can be entered there.
const clubId = computed(
  () => myTeams.data.value?.find((t) => t.team_id === teamId.value)?.club_id ?? '',
)
// A booked training that overlaps a home match on the same pitch: warn the coach.
const matchConflicts = useTrainingMatchConflicts(clubId, () =>
  e.value?.type === 'training' && !e.value.is_cancelled ? e.value : null,
)
const canAttach = computed(
  () =>
    isCoach.value &&
    !!e.value &&
    e.value.type === 'training' &&
    !e.value.booking_id &&
    !e.value.is_cancelled &&
    new Date(e.value.starts_at) > new Date(),
)
const myAttendance = computed(
  () => e.value?.attendances.find((a) => a.member_id === myMember.value?.id) ?? null,
)
const myNomination = computed(
  () => e.value?.match_squad.find((s) => s.member_id === myMember.value?.id) ?? null,
)
const memberById = computed(() => new Map((members.data.value ?? []).map((m) => [m.id, m])))
const squadByRole = computed(() =>
  SQUAD_ROLES.map((role) => ({
    role,
    names: (e.value?.match_squad ?? [])
      .filter((s) => s.role === role)
      .map((s) => memberById.value.get(s.member_id)?.display_name ?? '?')
      .sort(),
  })).filter((g) => g.names.length),
)

const typeLabel = computed(() =>
  !e.value
    ? ''
    : e.value.type === 'training'
      ? t('events.training')
      : e.value.type === 'match'
        ? t('events.match')
        : t('events.event'),
)
const when = computed(() => {
  if (!e.value) return ''
  const rel = relativeDay(e.value.starts_at)
  if (rel.kind === 'today') return t('player.today')
  if (rel.kind === 'tomorrow') return t('player.tomorrow')
  if (rel.kind === 'inDays') return t('player.inDays', { n: rel.days })
  return null
})
const players = computed(() => (members.data.value ?? []).filter((m) => m.role === 'player'))
const yesCount = computed(() => {
  const ids = new Set(players.value.map((m) => m.id))
  return (e.value?.attendances ?? []).filter((a) => a.status === 'yes' && ids.has(a.member_id))
    .length
})
const localDate = (iso: string) => format(new Date(iso), 'yyyy-MM-dd')
const canAnswer = computed(() => !!e.value && canRespond(e.value, isCoach.value))
const lockedHint = computed(() => {
  if (!e.value || canAnswer.value) return null
  const state = responseState(e.value)
  return state === 'deadlinePassed' || state === 'started' ? t(`events.locked.${state}`) : null
})
const prefilledInjured = computed(
  () =>
    myAttendance.value?.status === 'no' &&
    myAttendance.value.reason === 'injured' &&
    !myAttendance.value.updated_by,
)

// Opened with an answer given: a slim line (status and three small answer buttons) leaves
// room for the content. Answering here keeps the full bar for this visit (nothing jumps under
// the finger).
const answerOpen = ref(false)
const answerSlim = computed(() => (!!myAttendance.value && !answerOpen.value) || isCoach.value)
const answeredIcon: Record<AttendanceStatus, 'check' | 'maybe' | 'x'> = {
  yes: 'check',
  maybe: 'maybe',
  no: 'x',
}

const { answer, decline, declining } = useAnswer()
function onAnswer(status: AttendanceStatus) {
  answerOpen.value = true
  if (!e.value || !myMember.value) return
  const label = `${fmt.title(e.value)} · ${fmt.weekdayShort(e.value.starts_at)} ${fmt.dayMonth(e.value.starts_at)}`
  answer(e.value, myMember.value.id, myAttendance.value, status, label)
}

// Coach actions behind "⋯": edit, cancel (with reason) or reactivate, delete (with undo).
type CoachAction = 'edit' | 'cancel' | 'reactivate' | 'delete'
const coachActions = computed<OverflowItem<CoachAction>[]>(() => [
  { key: 'edit', label: t('events.edit'), icon: 'edit' },
  e.value?.is_cancelled
    ? { key: 'reactivate', label: t('events.reactivate'), icon: 'undo' }
    : { key: 'cancel', label: t('events.cancel'), icon: 'x' },
  { key: 'delete', label: t('events.delete'), icon: 'trash', danger: true },
])
const cancelOpen = ref(false)
const cancelReason = ref('')
const deleteOpen = ref(false)

function onCoachAction(action: CoachAction) {
  if (action === 'edit')
    void router.push({ name: 'event-edit', params: { eventId: props.eventId } })
  else if (action === 'cancel') cancelOpen.value = true
  else if (action === 'reactivate') void reactivate()
  else deleteOpen.value = true
}

async function cancelEvent() {
  try {
    await updateEvent.mutateAsync({
      eventId: props.eventId,
      patch: { is_cancelled: true, cancel_reason: cancelReason.value.trim() || null },
    })
    cancelOpen.value = false
    snackbar.show({ text: t('events.cancelledDone') })
  } catch {
    snackbar.show({ text: t('squad.errors.unknown'), tone: 'error' })
  }
}

async function reactivate() {
  try {
    await updateEvent.mutateAsync({
      eventId: props.eventId,
      patch: { is_cancelled: false, cancel_reason: null },
    })
    snackbar.show({ text: t('events.reactivatedDone') })
  } catch {
    snackbar.show({ text: t('squad.errors.unknown'), tone: 'error' })
  }
}

async function remove() {
  if (!e.value) return
  const label = fmt.title(e.value)
  deleteOpen.value = false
  await router.replace({ name: 'events' })
  deleteWithUndo.remove(props.eventId, label)
}
</script>

<template>
  <section class="detail" :class="e ? `detail--${e.type}` : undefined">
    <div v-if="event.isPending.value" aria-busy="true" class="detail__loading">
      <h1 class="visually-hidden">{{ t('events.detailTitle') }}</h1>
      <UiSkeleton :lines="2" />
      <UiSkeleton shape="block" height="160px" />
    </div>
    <PageProblem
      v-else-if="event.isError.value || !e"
      :title="t('events.loadFailedOne')"
      :text="t('problem.hint')"
      :to="{ name: 'events' }"
      :action="t('problem.toEvents')"
    />

    <template v-else>
      <EventCoachNav
        v-if="isCoach && (e.type === 'training' || e.type === 'match')"
        :event-id="e.id"
        :type="e.type"
        active="event"
      />

      <header class="detail__head">
        <OverflowMenu
          v-if="isCoach"
          class="detail__menu"
          :items="coachActions"
          :title="t('events.coachActions')"
          :label="t('events.coachActions')"
          @select="onCoachAction"
        />
        <!-- Trainings are titled "Training" already: the eyebrow then only says when. -->
        <p v-if="e.type !== 'training' || when" class="detail__eyebrow">
          <template v-if="e.type !== 'training'">{{ typeLabel }}</template>
          <template v-if="e.type !== 'training' && when"> · </template>
          <template v-if="when">{{ when }}</template>
        </p>
        <h1 class="detail__title" :class="{ 'detail__title--struck': e.is_cancelled }">
          {{ fmt.title(e) }}
        </h1>
        <p class="detail__when">
          {{ fmt.weekdayShort(e.starts_at) }} {{ fmt.dayMonth(e.starts_at) }} ·
          {{ fmt.timeRange(e) }}
        </p>
        <div class="detail__badges">
          <UiBadge v-if="e.is_cancelled" tone="no">{{ t('events.cancelled') }}</UiBadge>
          <template v-if="e.type === 'match'">
            <UiBadge tone="match">
              {{ e.is_home === false ? t('events.away') : t('events.home') }}
            </UiBadge>
            <UiBadge v-if="e.competition">{{ t(`events.competition.${e.competition}`) }}</UiBadge>
          </template>
          <UiBadge v-if="e.series_id">{{ t('events.fromSeries') }}</UiBadge>
        </div>
      </header>

      <p v-if="isCoach && matchConflicts.length" class="detail__conflict" role="status">
        <UiIcon name="alert" :size="20" />
        <span>
          <strong>{{ t('schedule.conflictTitle') }}</strong>
          {{
            matchConflicts
              .map((m) =>
                t('schedule.conflictWith', {
                  opponent: m.opponent ?? '',
                  kickoff: format(new Date(m.starts_at), 'HH:mm'),
                }),
              )
              .join(', ')
          }}
        </span>
      </p>
      <p v-if="e.is_cancelled" class="detail__cancelled" role="status">
        <UiIcon name="alert" :size="20" />
        <span>
          <strong>{{ t('events.cancelledTitle') }}</strong>
          <template v-if="e.cancel_reason"> {{ e.cancel_reason }}</template>
        </span>
      </p>

      <dl class="detail__facts">
        <div v-if="e.location" class="detail__fact">
          <dt v-if="e.pitch_id">{{ t('schedule.pitch') }}</dt>
          <dt v-else>
            {{ e.type === 'match' ? t('events.form.venueLocation') : t('events.form.location') }}
          </dt>
          <dd>
            <!-- A club pitch: the schedule of that day instead of a map. -->
            <RouterLink
              v-if="e.pitch_id"
              :to="{ name: 'events-schedule', query: { date: localDate(e.starts_at) } }"
              class="detail__map"
            >
              {{ e.location }}
              <span class="visually-hidden">({{ t('schedule.openInSchedule') }})</span>
            </RouterLink>
            <a
              v-else
              :href="mapsUrl(e.location)"
              target="_blank"
              rel="noopener"
              class="detail__map"
            >
              {{ e.location }}
              <span class="visually-hidden">({{ t('events.openMap') }})</span>
            </a>
          </dd>
        </div>
        <div v-if="e.meet_at || e.meet_location" class="detail__fact">
          <dt>{{ t('events.meet') }}</dt>
          <dd>
            {{ e.meet_at ? fmt.time(e.meet_at) : ''
            }}{{ e.meet_at && e.meet_location ? ' · ' : '' }}
            <a
              v-if="e.meet_location"
              :href="mapsUrl(e.meet_location)"
              target="_blank"
              rel="noopener"
              class="detail__map"
            >
              {{ e.meet_location }}
              <span class="visually-hidden">({{ t('events.openMap') }})</span>
            </a>
          </dd>
        </div>
        <div v-if="e.response_deadline" class="detail__fact">
          <dt>{{ t('events.form.deadline') }}</dt>
          <dd>{{ fmt.weekdayShort(e.response_deadline) }} {{ fmt.time(e.response_deadline) }}</dd>
        </div>
        <!-- Coaches see the counts in "Who is coming?" right below. -->
        <div v-if="players.length && !e.is_cancelled && !isCoach" class="detail__fact">
          <dt>{{ t('events.overview.yes') }}</dt>
          <dd>{{ t('events.ofPlayers', { n: yesCount, total: players.length }) }}</dd>
        </div>
      </dl>

      <AttachToSchedule v-if="canAttach && clubId" :event="e" :club-id="clubId" />

      <p v-if="e.notes" class="detail__notes">
        <UiIcon name="note" :size="20" />
        <span>{{ e.notes }}</span>
      </p>

      <!-- Training plan: the flow for players, the editor entry for coaches. -->
      <template v-if="e.type === 'training' && !e.is_cancelled">
        <PlanSection
          v-if="isCoach"
          :event="e"
          :is-coach="true"
          :members="members.data.value ?? []"
          :my-member-id="myMember?.id ?? null"
        />
        <TrainingFlow
          v-else-if="e.plan_status === 'published'"
          :event-id="e.id"
          :member-id="myMember?.id ?? null"
        />
        <p v-else class="detail__muted">{{ t('player.planNotYet') }}</p>
      </template>

      <!-- Nomination for players; coaches have the squad as its own view (EventCoachNav). -->
      <section
        v-if="e.type === 'match' && !isCoach && (myNomination || squadByRole.length)"
        class="detail__squad"
        aria-labelledby="squad-title"
      >
        <h2 id="squad-title">{{ t('events.nomination.title') }}</h2>
        <p v-if="myMember?.role === 'player'" class="detail__nomination" role="status">
          {{
            myNomination
              ? t('events.nomination.you', { role: t(`events.squadRole.${myNomination.role}`) })
              : t('events.nomination.notYou')
          }}
        </p>
        <div v-for="group in squadByRole" :key="group.role" class="detail__squad-group">
          <h3>{{ t(`events.squadRole.${group.role}`) }} ({{ group.names.length }})</h3>
          <p>{{ group.names.join(', ') }}</p>
        </div>
      </section>

      <!-- Coach -->
      <template v-if="isCoach && members.data.value">
        <AttendanceOverview :event="e" :members="members.data.value" />
      </template>

      <!-- My answer: always in reach at the bottom. -->
      <ActionBar v-if="myMember && !e.is_cancelled" :label="t('ui.answer.question')">
        <div v-if="answerSlim" class="detail__answered">
          <span
            v-if="myAttendance"
            class="detail__answered-status"
            :class="`detail__answered-status--${myAttendance.status}`"
          >
            <UiIcon :name="answeredIcon[myAttendance.status]" :size="22" :stroke-width="2.6" />
            {{ t(`ui.answer.done.${myAttendance.status}`) }}
          </span>
          <span v-else class="detail__hint">{{ t('player.ownAnswer') }}</span>
          <AnswerControl
            v-if="canAnswer"
            variant="compact"
            :status="myAttendance?.status ?? null"
            @answer="onAnswer"
          />
          <p v-else-if="lockedHint" class="detail__hint">{{ lockedHint }}</p>
        </div>
        <div v-else class="detail__answer">
          <AnswerControl
            variant="bar"
            :status="myAttendance?.status ?? null"
            :disabled="!canAnswer"
            @answer="onAnswer"
          />
          <p v-if="lockedHint" class="detail__hint">{{ lockedHint }}</p>
          <p v-else-if="prefilledInjured" class="detail__hint">
            {{ t('events.prefilledInjured') }}
          </p>
        </div>
      </ActionBar>

      <DeclineSheet :request="declining" @decline="decline" @cancel="declining = null" />

      <BottomSheet v-model:open="cancelOpen" :title="t('events.cancelTitle')">
        <UiInput
          v-model="cancelReason"
          :label="t('events.cancelReason')"
          :placeholder="t('events.cancelReasonPlaceholder')"
        />
        <p class="detail__hint">{{ t('events.cancelHint') }}</p>
        <template #footer>
          <UiButton variant="secondary" @click="cancelOpen = false">{{
            t('common.cancel')
          }}</UiButton>
          <UiButton variant="danger" :loading="updateEvent.isPending.value" @click="cancelEvent">
            {{ t('events.cancel') }}
          </UiButton>
        </template>
      </BottomSheet>

      <BottomSheet v-model:open="deleteOpen" :title="t('events.deleteTitle')">
        <p>{{ t('events.deleteText') }}</p>
        <template #footer>
          <UiButton variant="secondary" @click="deleteOpen = false">{{
            t('common.cancel')
          }}</UiButton>
          <UiButton variant="danger" icon="trash" @click="remove">{{
            t('events.delete')
          }}</UiButton>
        </template>
      </BottomSheet>
    </template>
  </section>
</template>

<style scoped lang="scss">
.detail {
  --type-text: var(--color-training-text);

  display: flex;
  flex-direction: column;
  gap: $space-5;

  &--match {
    --type-text: var(--color-match-text);
  }

  &--event {
    --type-text: var(--color-event-text);
  }

  &__loading {
    display: flex;
    flex-direction: column;
    gap: $space-3;
  }

  &__head {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: $space-1;
    padding-right: $touch-target;
  }

  &__menu {
    position: absolute;
    top: -4px;
    right: -8px;
  }

  &__eyebrow {
    color: var(--type-text);
    font-size: $font-sm;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  &__title {
    font-size: 2.75rem;

    &--struck {
      text-decoration: line-through;
    }
  }

  &__when {
    font-family: var(--font-display);
    font-size: $font-2xl;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    line-height: 1.1;
  }

  &__badges {
    display: flex;
    flex-wrap: wrap;
    gap: $space-1;

    &:empty {
      display: none;
    }
  }

  &__conflict {
    display: flex;
    gap: $space-2;
    padding: $space-3 $space-4;
    border: 2px dashed var(--color-danger);
    border-radius: $radius-lg;
    color: var(--color-danger);
  }

  &__cancelled {
    display: flex;
    gap: $space-2;
    padding: $space-3 $space-4;
    border: 2px solid var(--color-no);
    border-radius: $radius-lg;
    color: var(--color-no-text);
  }

  &__facts {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: $space-2;
    margin: 0;
  }

  &__fact {
    padding: $space-3;
    border-radius: $radius-lg;
    background: var(--color-surface);

    dt {
      color: var(--color-text-muted);
      font-size: $font-xs;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    dd {
      margin: 2px 0 0;
      font-weight: 700;
      overflow-wrap: anywhere;
    }
  }

  &__map {
    @include focus-visible;

    color: var(--color-text);
    text-decoration-color: var(--color-primary);
    text-decoration-thickness: 2px;
    text-underline-offset: 3px;
  }

  &__notes {
    display: flex;
    gap: $space-2;
    padding: $space-3 $space-4;
    border: 2px dashed var(--color-chalk);
    border-radius: $radius-lg;

    :deep(.ui-icon) {
      flex-shrink: 0;
      color: var(--color-text-muted);
    }
  }

  &__muted,
  &__hint {
    color: var(--color-text-muted);
    font-size: $font-sm;
  }

  &__squad {
    display: flex;
    flex-direction: column;
    gap: $space-2;
  }

  &__nomination {
    font-weight: 800;
  }

  &__squad-group h3 {
    font-size: $font-md;
  }

  &__answer {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: $space-1;
  }

  &__answered {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: space-between;
    gap: $space-3;
  }

  &__answered-status {
    display: inline-flex;
    align-items: center;
    gap: $space-2;
    font-weight: 800;

    @each $answer in yes, maybe, no {
      &--#{$answer} {
        color: var(--color-#{$answer}-text);
      }
    }
  }
}
</style>
