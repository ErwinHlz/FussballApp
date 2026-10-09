<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import BaseBadge from '@/components/BaseBadge.vue'
import BaseButton from '@/components/BaseButton.vue'
import BaseCard from '@/components/BaseCard.vue'
import BaseInput from '@/components/BaseInput.vue'
import BaseModal from '@/components/BaseModal.vue'
import { useActiveTeam } from '@/features/teams/composables/useActiveTeam'
import AttendanceControl from '../components/AttendanceControl.vue'
import AttendanceOverview from '../components/AttendanceOverview.vue'
import MatchSquadEditor from '../components/MatchSquadEditor.vue'
import EventBadges from '../components/EventBadges.vue'
import PlanSection from '@/features/training-plan/components/PlanSection.vue'
import { useEventFormat } from '../format'
import { SQUAD_ROLES } from '../logic'
import { useDeleteEvent, useEvent, useMyMember, useUpdateEvent } from '../composables/useEvents'

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
  <section class="event-detail">
    <p v-if="event.isPending.value">{{ t('common.loading') }}</p>
    <p v-else-if="event.isError.value || !e" class="event-detail__error" role="alert">
      {{ t('events.loadFailedOne') }}
    </p>

    <template v-else>
      <header class="event-detail__header" :class="`event-detail__header--${e.type}`">
        <div class="event-detail__badges">
          <EventBadges :event="e" show-competition />
          <BaseBadge v-if="e.series_id" tone="neutral">{{ t('events.fromSeries') }}</BaseBadge>
        </div>
        <h1 :class="{ 'event-detail__struck': e.is_cancelled }">{{ fmt.title(e) }}</h1>
        <p class="event-detail__when">{{ fmt.longDay(e.starts_at) }}</p>
      </header>

      <BaseCard v-if="e.is_cancelled" class="event-detail__cancelled" role="status">
        <strong>{{ t('events.cancelledTitle') }}</strong>
        <span v-if="e.cancel_reason">{{ e.cancel_reason }}</span>
      </BaseCard>

      <dl class="event-detail__facts">
        <div>
          <dt>{{ e.type === 'match' ? t('events.form.kickoff') : t('events.time') }}</dt>
          <dd>{{ fmt.timeRange(e) }}</dd>
        </div>
        <div v-if="e.meet_at || e.meet_location">
          <dt>{{ t('events.meet') }}</dt>
          <dd>
            {{ e.meet_at ? fmt.time(e.meet_at) : '' }}{{ e.meet_at && e.meet_location ? ' · ' : ''
            }}{{ e.meet_location ?? '' }}
          </dd>
        </div>
        <div v-if="e.location">
          <dt>
            {{ e.type === 'match' ? t('events.form.venueLocation') : t('events.form.location') }}
          </dt>
          <dd>{{ e.location }}</dd>
        </div>
        <div v-if="e.response_deadline">
          <dt>{{ t('events.form.deadline') }}</dt>
          <dd>{{ fmt.dateTime(e.response_deadline) }}</dd>
        </div>
        <div v-if="e.notes" class="event-detail__notes">
          <dt>{{ t('events.form.notes') }}</dt>
          <dd>{{ e.notes }}</dd>
        </div>
      </dl>

      <!-- My answer -->
      <BaseCard v-if="myMember && !e.is_cancelled" class="event-detail__mine">
        <h2 class="event-detail__subtitle">{{ t('events.yourAnswer') }}</h2>
        <AttendanceControl
          :event="e"
          :member-id="myMember.id"
          :attendance="myAttendance"
          :as-coach="isCoach"
        />
        <p
          v-if="
            myAttendance?.status === 'no' &&
            myAttendance.reason === 'injured' &&
            !myAttendance.updated_by
          "
          class="event-detail__muted"
        >
          {{ t('events.prefilledInjured') }}
        </p>
      </BaseCard>

      <!-- Training plan -->
      <PlanSection
        v-if="e.type === 'training' && !e.is_cancelled"
        :event="e"
        :is-coach="isCoach"
        :members="members.data.value ?? []"
        :my-member-id="myMember?.id ?? null"
      />

      <!-- Nomination (visible to everyone) -->
      <BaseCard v-if="e.type === 'match' && (myNomination || squadByRole.length)">
        <p v-if="myMember" class="event-detail__nomination" role="status">
          {{
            myNomination
              ? t('events.nomination.you', { role: t(`events.squadRole.${myNomination.role}`) })
              : t('events.nomination.notYou')
          }}
        </p>
        <div v-for="group in squadByRole" :key="group.role" class="event-detail__squad-group">
          <h3>{{ t(`events.squadRole.${group.role}`) }} ({{ group.names.length }})</h3>
          <p>{{ group.names.join(', ') }}</p>
        </div>
      </BaseCard>

      <!-- Coach -->
      <template v-if="isCoach && members.data.value">
        <AttendanceOverview :event="e" :members="members.data.value" />
        <MatchSquadEditor
          v-if="e.type === 'match' && !e.is_cancelled"
          :event="e"
          :members="members.data.value"
        />

        <section class="event-detail__coach-actions" :aria-label="t('events.coachActions')">
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
            class="event-detail__error"
            role="alert"
          >
            {{ t('squad.errors.unknown') }}
          </p>
        </section>
      </template>

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
.event-detail {
  display: flex;
  flex-direction: column;
  gap: $space-4;

  &__header {
    display: flex;
    flex-direction: column;
    gap: $space-1;
  }

  &__badges {
    display: flex;
    flex-wrap: wrap;
    gap: $space-1;
  }

  &__struck {
    text-decoration: line-through;
  }

  &__when {
    font-weight: 600;
    color: var(--color-text-muted);
  }

  &__cancelled {
    display: flex;
    flex-direction: column;
    gap: $space-1;
    border-color: var(--color-danger);
    color: var(--color-danger);
  }

  &__facts {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: $space-3;

    dt {
      font-size: $font-xs;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--color-text-muted);
    }

    dd {
      margin: 0;
      font-weight: 600;
      overflow-wrap: anywhere;
    }
  }

  &__notes {
    grid-column: 1 / -1;

    dd {
      font-weight: 400;
      white-space: pre-line;
    }
  }

  &__mine {
    display: flex;
    flex-direction: column;
    gap: $space-3;
  }

  &__subtitle {
    font-size: $font-lg;
  }

  &__nomination {
    font-size: $font-lg;
    font-weight: 800;
  }

  &__squad-group {
    margin-top: $space-3;

    h3 {
      font-size: $font-sm;
      color: var(--color-text-muted);
    }
  }

  &__coach-actions {
    display: flex;
    flex-direction: column;
    gap: $space-2;
    padding-top: $space-4;
    border-top: 1px solid var(--color-border);
  }

  &__muted {
    font-size: $font-sm;
    color: var(--color-text-muted);
  }

  &__error {
    color: var(--color-danger);
  }
}
</style>
