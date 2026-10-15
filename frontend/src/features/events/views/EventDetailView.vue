<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/components/BaseButton.vue'
import BaseInput from '@/components/BaseInput.vue'
import BaseModal from '@/components/BaseModal.vue'
import ActionBar from '@/ui/ActionBar.vue'
import AnswerControl from '@/ui/AnswerControl.vue'
import UiBadge from '@/ui/UiBadge.vue'
import UiIcon from '@/ui/UiIcon.vue'
import UiSkeleton from '@/ui/UiSkeleton.vue'
import { useActiveTeam } from '@/features/teams/composables/useActiveTeam'
import TrainingFlow from '@/features/player-view/components/TrainingFlow.vue'
import { relativeDay } from '@/features/player-view/logic'
import PlanSection from '@/features/training-plan/components/PlanSection.vue'
import AttendanceOverview from '../components/AttendanceOverview.vue'
import DeclineSheet from '../components/DeclineSheet.vue'
import MatchSquadEditor from '../components/MatchSquadEditor.vue'
import { useAnswer } from '../composables/useAnswer'
import { useDeleteEvent, useEvent, useMyMember, useUpdateEvent } from '../composables/useEvents'
import { useEventFormat } from '../format'
import { canRespond, responseState, SQUAD_ROLES, type AttendanceStatus } from '../logic'

const props = defineProps<{ eventId: string }>()

const { t } = useI18n()
const router = useRouter()
const fmt = useEventFormat()
const event = useEvent(() => props.eventId)
const teamId = computed(() => event.data.value?.team_id ?? null)
const { members, myMember } = useMyMember(teamId)
const { myTeams } = useActiveTeam()
const updateEvent = useUpdateEvent()
const deleteEvent = useDeleteEvent()

// Coach rights for the event's team (not just the active one).
const isCoach = computed(() => {
  const team = myTeams.data.value?.find((t) => t.team_id === teamId.value)
  return !!team && (team.team_role === 'coach' || team.is_club_admin)
})

const e = computed(() => event.data.value)
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
const mapsUrl = computed(() =>
  e.value?.location
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.value.location)}`
    : null,
)
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

const { answer, decline, declining } = useAnswer()
function onAnswer(status: AttendanceStatus) {
  if (!e.value || !myMember.value) return
  const label = `${fmt.title(e.value)} · ${fmt.weekdayShort(e.value.starts_at)} ${fmt.dayMonth(e.value.starts_at)}`
  answer(e.value, myMember.value.id, myAttendance.value, status, label)
}

// Coach actions (restyled in UI-PLAN.md phase U3).
const cancelOpen = ref(false)
const cancelReason = ref('')
const confirmDelete = ref(false)

async function cancelEvent() {
  await updateEvent.mutateAsync({
    eventId: props.eventId,
    patch: { is_cancelled: true, cancel_reason: cancelReason.value.trim() || null },
  })
  cancelOpen.value = false
}

async function reactivate() {
  await updateEvent.mutateAsync({
    eventId: props.eventId,
    patch: { is_cancelled: false, cancel_reason: null },
  })
}

async function remove() {
  if (!confirmDelete.value) {
    confirmDelete.value = true
    return
  }
  await deleteEvent.mutateAsync(props.eventId)
  await router.replace({ name: 'events' })
}
</script>

<template>
  <section class="detail" :class="e ? `detail--${e.type}` : undefined">
    <div v-if="event.isPending.value" aria-busy="true" class="detail__loading">
      <h1 class="visually-hidden">{{ t('events.detailTitle') }}</h1>
      <UiSkeleton :lines="2" />
      <UiSkeleton shape="block" height="160px" />
    </div>
    <p v-else-if="event.isError.value || !e" class="detail__error" role="alert">
      {{ t('events.loadFailedOne') }}
    </p>

    <template v-else>
      <header class="detail__head">
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

      <p v-if="e.is_cancelled" class="detail__cancelled" role="status">
        <UiIcon name="alert" :size="20" />
        <span>
          <strong>{{ t('events.cancelledTitle') }}</strong>
          <template v-if="e.cancel_reason"> {{ e.cancel_reason }}</template>
        </span>
      </p>

      <dl class="detail__facts">
        <div v-if="e.location" class="detail__fact">
          <dt>
            {{ e.type === 'match' ? t('events.form.venueLocation') : t('events.form.location') }}
          </dt>
          <dd>
            <a v-if="mapsUrl" :href="mapsUrl" target="_blank" rel="noopener" class="detail__map">
              {{ e.location }}
              <span class="visually-hidden">({{ t('events.openMap') }})</span>
            </a>
          </dd>
        </div>
        <div v-if="e.meet_at || e.meet_location" class="detail__fact">
          <dt>{{ t('events.meet') }}</dt>
          <dd>
            {{ e.meet_at ? fmt.time(e.meet_at) : '' }}{{ e.meet_at && e.meet_location ? ' · ' : ''
            }}{{ e.meet_location ?? '' }}
          </dd>
        </div>
        <div v-if="e.response_deadline" class="detail__fact">
          <dt>{{ t('events.form.deadline') }}</dt>
          <dd>{{ fmt.weekdayShort(e.response_deadline) }} {{ fmt.time(e.response_deadline) }}</dd>
        </div>
        <div v-if="players.length && !e.is_cancelled" class="detail__fact">
          <dt>{{ t('events.overview.yes') }}</dt>
          <dd>{{ t('events.ofPlayers', { n: yesCount, total: players.length }) }}</dd>
        </div>
      </dl>

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

      <!-- Nomination (visible to everyone) -->
      <section
        v-if="e.type === 'match' && (myNomination || squadByRole.length)"
        class="detail__squad"
        aria-labelledby="squad-title"
      >
        <h2 id="squad-title">{{ t('events.nomination.title') }}</h2>
        <p v-if="myMember" class="detail__nomination" role="status">
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
        <MatchSquadEditor
          v-if="e.type === 'match' && !e.is_cancelled"
          :event="e"
          :members="members.data.value"
        />

        <section class="detail__coach-actions" :aria-label="t('events.coachActions')">
          <RouterLink
            v-slot="{ navigate }"
            custom
            :to="{ name: 'event-edit', params: { eventId: e.id } }"
          >
            <BaseButton variant="secondary" block @click="navigate">{{
              t('events.edit')
            }}</BaseButton>
          </RouterLink>
          <BaseButton v-if="!e.is_cancelled" variant="secondary" block @click="cancelOpen = true">
            {{ t('events.cancel') }}
          </BaseButton>
          <BaseButton
            v-else
            variant="secondary"
            block
            :loading="updateEvent.isPending.value"
            @click="reactivate"
          >
            {{ t('events.reactivate') }}
          </BaseButton>
          <BaseButton
            :variant="confirmDelete ? 'danger' : 'ghost'"
            block
            :loading="deleteEvent.isPending.value"
            @click="remove"
          >
            {{ confirmDelete ? t('events.deleteConfirm') : t('events.delete') }}
          </BaseButton>
          <p
            v-if="updateEvent.isError.value || deleteEvent.isError.value"
            class="detail__error"
            role="alert"
          >
            {{ t('squad.errors.unknown') }}
          </p>
        </section>
      </template>

      <!-- My answer: always in reach at the bottom. -->
      <ActionBar v-if="myMember && !e.is_cancelled" :label="t('ui.answer.question')">
        <div class="detail__answer">
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

      <BaseModal v-model:open="cancelOpen" :title="t('events.cancelTitle')">
        <BaseInput
          v-model="cancelReason"
          :label="t('events.cancelReason')"
          :placeholder="t('events.cancelReasonPlaceholder')"
        />
        <template #footer>
          <BaseButton variant="secondary" @click="cancelOpen = false">{{
            t('common.cancel')
          }}</BaseButton>
          <BaseButton variant="danger" :loading="updateEvent.isPending.value" @click="cancelEvent">
            {{ t('events.cancel') }}
          </BaseButton>
        </template>
      </BaseModal>
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
    display: flex;
    flex-direction: column;
    gap: $space-1;
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

  &__coach-actions {
    display: flex;
    flex-direction: column;
    gap: $space-2;
  }

  &__answer {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: $space-1;
  }

  &__error {
    color: var(--color-danger);
  }
}
</style>
