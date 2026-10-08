<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/AppIcon.vue'
import BaseBadge from '@/components/BaseBadge.vue'
import BaseButton from '@/components/BaseButton.vue'
import BaseCard from '@/components/BaseCard.vue'
import BaseChipGroup from '@/components/BaseChipGroup.vue'
import EmptyState from '@/components/EmptyState.vue'
import { useAuthStore } from '@/stores/auth'
import type { TeamMember } from '@/features/teams/api'
import InvitePanel from '@/features/teams/components/InvitePanel.vue'
import { useActiveTeam } from '@/features/teams/composables/useActiveTeam'
import { useTeamMembers } from '@/features/teams/composables/useTeams'
import MemberFormModal from '../components/MemberFormModal.vue'
import StatusBadge from '../components/StatusBadge.vue'
import {
  filterSquad,
  MEMBER_STATUSES,
  POSITIONS,
  sortSquad,
  type MemberStatus,
  type Position,
  type SquadFilter,
} from '../squad'

const { t } = useI18n()
const auth = useAuthStore()
const { activeTeam, isCoach } = useActiveTeam()
const teamId = computed(() => activeTeam.value?.team_id ?? null)
const members = useTeamMembers(teamId)

const inviteOpen = ref(false)
const formOpen = ref(false)
const editing = ref<TeamMember | null>(null)
const filter = reactive<SquadFilter>({ status: 'all', position: 'all' })

const all = computed(() => sortSquad(members.data.value ?? []))
const coaches = computed(() => all.value.filter((m) => m.role === 'coach'))
const players = computed(() => all.value.filter((m) => m.role === 'player'))
const visiblePlayers = computed(() => filterSquad(players.value, filter))
const isFiltered = computed(() => filter.status !== 'all' || filter.position !== 'all')

const statusOptions = computed(() => [
  { value: 'all' as const, label: t('squad.filterAll') },
  ...MEMBER_STATUSES.map((s) => ({ value: s, label: t(`squad.status.${s}`) })),
])
const positionOptions = computed(() => [
  { value: 'all' as const, label: t('squad.filterAll') },
  ...POSITIONS.map((p) => ({ value: p, label: t(`squad.positionsShort.${p}`) })),
])

// BaseChipGroup models T | T[]; filters are single-select.
const statusFilter = computed({
  get: () => filter.status,
  set: (value: MemberStatus | 'all' | (MemberStatus | 'all')[]) => {
    if (!Array.isArray(value)) filter.status = value
  },
})
const positionFilter = computed({
  get: () => filter.position,
  set: (value: Position | 'all' | (Position | 'all')[]) => {
    if (!Array.isArray(value)) filter.position = value
  },
})

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
    <h1>{{ t('squad.title') }}</h1>

    <BaseCard v-if="isCoach && activeTeam" class="squad__actions">
      <div class="squad__action-buttons">
        <BaseButton @click="openAdd">
          <template #icon><AppIcon name="plus" :size="18" /></template>
          {{ t('squad.addPlayer') }}
        </BaseButton>
        <BaseButton
          variant="secondary"
          :aria-expanded="inviteOpen"
          @click="inviteOpen = !inviteOpen"
        >
          <template #icon><AppIcon :name="inviteOpen ? 'x' : 'link'" :size="18" /></template>
          {{ inviteOpen ? t('common.close') : t('squad.invitePlayers') }}
        </BaseButton>
      </div>
      <template v-if="inviteOpen">
        <p class="squad__muted">{{ t('squad.inviteHint') }}</p>
        <InvitePanel
          :team-id="activeTeam.team_id"
          :team-name="activeTeam.team_name"
          role="player"
        />
      </template>
    </BaseCard>

    <p v-if="members.isPending.value" class="squad__muted">{{ t('common.loading') }}</p>
    <p v-else-if="members.isError.value" class="squad__error" role="alert">
      {{ t('squad.loadFailed') }}
    </p>

    <template v-else>
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
              <span class="squad__number" aria-hidden="true">
                <AppIcon name="whistle" :size="18" />
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
              <BaseBadge tone="training">{{ t('roles.coach') }}</BaseBadge>
            </component>
          </li>
        </ul>
      </section>

      <section class="squad__group" aria-labelledby="squad-players">
        <h2 id="squad-players" class="squad__subtitle">
          {{ t('squad.players') }} ({{ isFiltered ? `${visiblePlayers.length}/` : ''
          }}{{ players.length }})
        </h2>

        <div v-if="players.length" class="squad__filters">
          <BaseChipGroup
            v-model="statusFilter"
            :label="t('squad.statusLabel')"
            :options="statusOptions"
          />
          <BaseChipGroup
            v-model="positionFilter"
            :label="t('squad.positionsLabel')"
            :options="positionOptions"
          />
        </div>

        <ul v-if="visiblePlayers.length" class="squad__list" role="list">
          <li v-for="member in visiblePlayers" :key="member.id">
            <component
              :is="isCoach ? 'button' : 'div'"
              :type="isCoach ? 'button' : undefined"
              class="squad__member"
              :class="{ 'squad__member--clickable': isCoach }"
              :aria-label="
                isCoach ? t('squad.editPlayerNamed', { name: member.display_name }) : undefined
              "
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
              <AppIcon v-if="isCoach" name="chevronRight" :size="18" class="squad__chevron" />
            </component>
          </li>
        </ul>

        <p v-else-if="players.length" class="squad__muted">{{ t('squad.noFilterResults') }}</p>

        <EmptyState
          v-else
          icon="users"
          :title="t('squad.empty')"
          :text="isCoach ? t('squad.emptyHint') : undefined"
        />
      </section>
    </template>

    <MemberFormModal
      v-if="teamId"
      v-model:open="formOpen"
      :team-id="teamId"
      :member="editing"
      :members="all"
    />
  </section>
</template>

<style scoped lang="scss">
.squad {
  display: flex;
  flex-direction: column;
  gap: $space-4;

  &__actions {
    display: flex;
    flex-direction: column;
    gap: $space-3;
  }

  &__action-buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: $space-2;
  }

  &__group {
    display: flex;
    flex-direction: column;
    gap: $space-3;
  }

  &__subtitle {
    font-size: $font-lg;
  }

  &__filters {
    display: flex;
    flex-direction: column;
    gap: $space-3;
  }

  &__list {
    overflow: hidden;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: $radius-lg;

    > li + li {
      border-top: 1px solid var(--color-border);
    }
  }

  &__member {
    display: flex;
    align-items: center;
    gap: $space-3;
    width: 100%;
    min-height: 60px;
    padding: $space-2 $space-3;
    border: 0;
    background: transparent;
    text-align: left;

    &--clickable {
      @include focus-visible;

      &:hover {
        background: var(--color-surface-muted);
      }
    }
  }

  &__number {
    display: grid;
    flex-shrink: 0;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: $radius-full;
    background: var(--color-surface-muted);
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }

  &__main {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }

  &__name {
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  &__meta {
    display: flex;
    flex-wrap: wrap;
    gap: $space-2;
    font-size: $font-sm;
    color: var(--color-text-muted);
  }

  &__no-account {
    font-style: italic;
  }

  &__chevron {
    flex-shrink: 0;
    color: var(--color-text-muted);
  }

  &__muted {
    font-size: $font-sm;
    font-weight: 400;
    color: var(--color-text-muted);
  }

  &__error {
    color: var(--color-danger);
  }
}
</style>
