<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BottomSheet from '@/ui/BottomSheet.vue'
import UiBadge from '@/ui/UiBadge.vue'
import UiButton from '@/ui/UiButton.vue'
import UiChip from '@/ui/UiChip.vue'
import UiEmptyState from '@/ui/UiEmptyState.vue'
import UiIcon from '@/ui/UiIcon.vue'
import UiIconButton from '@/ui/UiIconButton.vue'
import UiSkeleton from '@/ui/UiSkeleton.vue'
import { useAuthStore } from '@/stores/auth'
import type { TeamMember } from '@/features/teams/api'
import InvitePanel from '@/features/teams/components/InvitePanel.vue'
import { useActiveTeam } from '@/features/teams/composables/useActiveTeam'
import { useTeamMembers } from '@/features/teams/composables/useTeams'
import MemberFormModal from '../components/MemberFormModal.vue'
import AbsenceList from '@/features/absences/components/AbsenceList.vue'
import { useTeamAbsences } from '@/features/absences/composables/useAbsences'
import StatusBadge from '../components/StatusBadge.vue'
import TeamNav from '../components/TeamNav.vue'
import { filterSquad, MEMBER_STATUSES, POSITIONS, sortSquad, type SquadFilter } from '../squad'

const { t } = useI18n()
const auth = useAuthStore()
const { activeTeam, isCoach } = useActiveTeam()
const teamId = computed(() => activeTeam.value?.team_id ?? null)
const members = useTeamMembers(teamId)
const absences = useTeamAbsences(teamId)

const inviteOpen = ref(false)
const formOpen = ref(false)
const editing = ref<TeamMember | null>(null)
const filter = reactive<SquadFilter>({ status: 'all', position: 'all' })

const all = computed(() => sortSquad(members.data.value ?? []))
const coaches = computed(() => all.value.filter((m) => m.role === 'coach'))
const players = computed(() => all.value.filter((m) => m.role === 'player'))
const visiblePlayers = computed(() => filterSquad(players.value, filter))
const isFiltered = computed(() => filter.status !== 'all' || filter.position !== 'all')

// Filters behind one button (as in the drills); active ones as removable pills. Players
// filter by position only (the status is the coach's business).
const filterOpen = ref(false)
const pills = computed(() => [
  ...(filter.status !== 'all'
    ? [
        {
          key: 'status',
          label: t(`squad.status.${filter.status}`),
          clear: () => (filter.status = 'all'),
        },
      ]
    : []),
  ...(filter.position !== 'all'
    ? [
        {
          key: 'position',
          label: t(`squad.positionsShort.${filter.position}`),
          clear: () => (filter.position = 'all'),
        },
      ]
    : []),
])
function resetFilter() {
  filter.status = 'all'
  filter.position = 'all'
}

const statusOptions = computed(() => [
  { value: 'all' as const, label: t('squad.filterAll') },
  ...MEMBER_STATUSES.map((s) => ({ value: s, label: t(`squad.status.${s}`) })),
])
const positionOptions = computed(() => [
  { value: 'all' as const, label: t('squad.filterAll') },
  ...POSITIONS.map((p) => ({ value: p, label: t(`squad.positionsShort.${p}`) })),
])

function openAdd() {
  editing.value = null
  formOpen.value = true
}

function openEdit(member: TeamMember) {
  if (!isCoach.value) return
  editing.value = member
  formOpen.value = true
}

function positionsLabel(member: TeamMember) {
  return member.positions.map((p) => t(`squad.positionsShort.${p}`)).join(' · ')
}
</script>

<template>
  <section class="squad">
    <TeamNav active="squad" />

    <header class="squad__head">
      <!-- The area tab above names the page already: the heading is for screen readers. -->
      <h1 class="visually-hidden">{{ t('squad.title') }}</h1>
      <template v-if="isCoach && activeTeam">
        <UiIconButton
          icon="link"
          :label="t('squad.invitePlayers')"
          aria-haspopup="dialog"
          @click="inviteOpen = true"
        />
        <UiIconButton
          icon="plus"
          variant="primary"
          :label="t('squad.addPlayer')"
          aria-haspopup="dialog"
          @click="openAdd"
        />
      </template>
    </header>

    <div v-if="members.isPending.value" aria-busy="true" class="squad__list">
      <UiSkeleton v-for="n in 5" :key="n" shape="block" height="64px" />
    </div>
    <p v-else-if="members.isError.value" class="squad__error" role="alert">
      {{ t('squad.loadFailed') }}
    </p>

    <template v-else>
      <section v-if="absences.data.value?.length" class="squad__group" aria-labelledby="squad-away">
        <h2 id="squad-away" class="squad__subtitle">{{ t('absences.away') }}</h2>
        <AbsenceList :absences="absences.data.value" show-name :can-manage="isCoach" />
      </section>

      <section v-if="coaches.length" class="squad__group" aria-labelledby="squad-coaches">
        <h2 id="squad-coaches" class="squad__subtitle">{{ t('squad.coaches') }}</h2>
        <ul class="squad__list" role="list">
          <li v-for="member in coaches" :key="member.id">
            <component
              :is="isCoach ? 'button' : 'div'"
              :type="isCoach ? 'button' : undefined"
              class="squad__member"
              :class="{ 'squad__member--clickable': isCoach }"
              @click="openEdit(member)"
            >
              <span class="squad__coach-icon" aria-hidden="true">
                <UiIcon name="cone" :size="20" />
              </span>
              <span class="squad__main">
                <span class="squad__name">
                  {{ member.display_name }}
                  <span
                    v-if="member.user_id !== null && member.user_id === auth.userId"
                    class="squad__muted"
                  >
                    ({{ t('common.you') }})
                  </span>
                </span>
              </span>
              <UiBadge tone="training">{{ t('roles.coach') }}</UiBadge>
              <UiIcon v-if="isCoach" name="chevronRight" :size="18" class="squad__chevron" />
              <span v-if="isCoach" class="visually-hidden">{{ t('squad.editHint') }}</span>
            </component>
          </li>
        </ul>
      </section>

      <section class="squad__group" aria-labelledby="squad-players">
        <div class="squad__group-head">
          <h2 id="squad-players" class="squad__subtitle">
            {{ t('squad.players') }}
            <span class="squad__count">
              {{ isFiltered ? `${visiblePlayers.length}/` : '' }}{{ players.length }}
            </span>
          </h2>
          <UiIconButton
            v-if="players.length"
            icon="filter"
            :label="
              pills.length
                ? t('squad.filter.labelActive', { n: pills.length })
                : t('squad.filter.label')
            "
            aria-haspopup="dialog"
            @click="filterOpen = true"
          />
        </div>
        <div v-if="pills.length" class="squad__pills">
          <button
            v-for="pill in pills"
            :key="pill.key"
            type="button"
            class="squad__pill"
            :aria-label="t('squad.filter.remove', { name: pill.label })"
            @click="pill.clear"
          >
            {{ pill.label }}
            <UiIcon name="x" :size="16" />
          </button>
        </div>

        <BottomSheet v-model:open="filterOpen" :title="t('squad.filter.title')">
          <div class="squad__filters">
            <p v-if="isCoach" id="squad-filter-status" class="squad__filter-label">
              {{ t('squad.statusLabel') }}
            </p>
            <div
              v-if="isCoach"
              class="squad__chips"
              role="group"
              aria-labelledby="squad-filter-status"
            >
              <UiChip
                v-for="option in statusOptions"
                :key="option.value"
                :model-value="filter.status === option.value"
                @update:model-value="filter.status = option.value"
              >
                {{ option.label }}
              </UiChip>
            </div>
            <p id="squad-filter-position" class="squad__filter-label">
              {{ t('squad.positionsLabel') }}
            </p>
            <div class="squad__chips" role="group" aria-labelledby="squad-filter-position">
              <UiChip
                v-for="option in positionOptions"
                :key="option.value"
                :model-value="filter.position === option.value"
                @update:model-value="filter.position = option.value"
              >
                {{ option.label }}
              </UiChip>
            </div>
          </div>
          <template #footer>
            <UiButton variant="secondary" :disabled="!isFiltered" @click="resetFilter">
              {{ t('squad.filter.reset') }}
            </UiButton>
            <UiButton @click="filterOpen = false">
              {{ t('squad.filter.show', { n: visiblePlayers.length }) }}
            </UiButton>
          </template>
        </BottomSheet>

        <ul v-if="visiblePlayers.length" class="squad__list" role="list">
          <li v-for="member in visiblePlayers" :key="member.id">
            <component
              :is="isCoach ? 'button' : 'div'"
              :type="isCoach ? 'button' : undefined"
              class="squad__member"
              :class="{ 'squad__member--clickable': isCoach }"
              @click="openEdit(member)"
            >
              <span class="squad__number">
                <span v-if="member.shirt_number !== null">{{ member.shirt_number }}</span>
                <span v-else aria-hidden="true">–</span>
              </span>
              <span class="squad__main">
                <span class="squad__name">
                  {{ member.display_name }}
                  <span
                    v-if="member.user_id !== null && member.user_id === auth.userId"
                    class="squad__muted"
                  >
                    ({{ t('common.you') }})
                  </span>
                </span>
                <span class="squad__meta">
                  <span v-if="member.positions.length">{{ positionsLabel(member) }}</span>
                  <span v-if="member.user_id === null" class="squad__no-account">
                    {{ t('squad.noAccount') }}
                  </span>
                </span>
              </span>
              <StatusBadge v-if="member.status !== 'active'" :status="member.status" />
              <UiIcon v-if="isCoach" name="chevronRight" :size="18" class="squad__chevron" />
              <!-- Name, number and status stay in the accessible name; the action is appended. -->
              <span v-if="isCoach" class="visually-hidden">{{ t('squad.editHint') }}</span>
            </component>
          </li>
        </ul>

        <p v-else-if="players.length" class="squad__muted">{{ t('squad.noFilterResults') }}</p>

        <UiEmptyState
          v-else
          icon="users"
          :title="t('squad.empty')"
          :text="isCoach ? t('squad.emptyHint') : undefined"
        >
          <UiButton v-if="isCoach" icon="link" @click="inviteOpen = true">
            {{ t('squad.invitePlayers') }}
          </UiButton>
        </UiEmptyState>
      </section>
    </template>

    <MemberFormModal
      v-if="teamId"
      v-model:open="formOpen"
      :team-id="teamId"
      :member="editing"
      :members="all"
    />
    <BottomSheet
      v-if="isCoach && activeTeam"
      v-model:open="inviteOpen"
      :title="t('squad.invitePlayers')"
      :description="t('squad.inviteHint')"
    >
      <InvitePanel :team-id="activeTeam.team_id" :team-name="activeTeam.team_name" role="player" />
    </BottomSheet>
  </section>
</template>

<style scoped lang="scss">
.squad {
  display: flex;
  flex-direction: column;
  gap: $space-4;

  &__head {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: $space-2;

    h1 {
      flex: 1;
    }
  }

  &__group {
    display: flex;
    flex-direction: column;
    gap: $space-2;
  }

  &__subtitle {
    display: flex;
    align-items: baseline;
    gap: $space-2;
  }

  &__count {
    color: var(--color-text-muted);
    font-size: $font-lg;
  }

  &__filters {
    display: flex;
    flex-direction: column;
    gap: $space-2;
  }

  &__group-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $space-2;
  }

  &__pills {
    display: flex;
    flex-wrap: wrap;
    gap: $space-2;
  }

  &__pill {
    @include focus-visible;

    display: inline-flex;
    align-items: center;
    gap: $space-1;
    min-height: 36px;
    padding: 0 $space-2 0 $space-3;
    border: 0;
    border-radius: $radius-full;
    background: var(--color-text);
    color: var(--color-bg);
    font-size: $font-sm;
    font-weight: 800;
  }

  &__filter-label {
    color: var(--color-text-muted);
    font-size: $font-sm;
    font-weight: 700;
  }

  // In the filter sheet: the chips wrap instead of scrolling sideways.
  &__chips {
    display: flex;
    flex-wrap: wrap;
    gap: $space-2;

    > * {
      flex-shrink: 0;
    }
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__member {
    display: flex;
    align-items: center;
    gap: $space-3;
    width: 100%;
    min-height: 64px;
    padding: $space-2 $space-3;
    border: 0;
    border-radius: $radius-lg;
    background: var(--color-surface);
    color: var(--color-text);
    font: inherit;
    text-align: left;

    &--clickable {
      @include focus-visible;

      cursor: pointer;
    }
  }

  &__number,
  &__coach-icon {
    display: grid;
    flex-shrink: 0;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: var(--color-pitch);
    color: #ffffff;
    font-family: var(--font-display);
    font-size: $font-xl;
    font-weight: 800;
  }

  &__coach-icon {
    background: var(--color-surface-muted);
    color: var(--color-training-text);
  }

  &__main {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }

  &__name {
    font-weight: 800;
  }

  &__meta {
    display: flex;
    flex-wrap: wrap;
    gap: $space-2;
    color: var(--color-text-muted);
    font-size: $font-sm;
  }

  &__no-account {
    font-style: italic;
  }

  &__muted {
    color: var(--color-text-muted);
    font-size: $font-sm;
    font-weight: 500;
  }

  &__chevron {
    flex-shrink: 0;
    color: var(--color-text-muted);
  }

  &__error {
    color: var(--color-danger);
  }
}
</style>
