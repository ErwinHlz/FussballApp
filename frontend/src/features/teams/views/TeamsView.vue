<script setup lang="ts">
import { computed, ref } from 'vue'
import TeamNav from '@/features/squad/components/TeamNav.vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/AppIcon.vue'
import BaseBadge from '@/components/BaseBadge.vue'
import BaseButton from '@/components/BaseButton.vue'
import BaseCard from '@/components/BaseCard.vue'
import BaseModal from '@/components/BaseModal.vue'
import EmptyState from '@/components/EmptyState.vue'
import type { Club, MyTeam } from '../api'
import CreateClubForm from '../components/CreateClubForm.vue'
import { useActiveTeam } from '../composables/useActiveTeam'
import { useMyClubs } from '../composables/useTeams'

const { t } = useI18n()
const router = useRouter()
const { myTeams, activeTeam, setActiveTeam } = useActiveTeam()
const myClubs = useMyClubs()
const createOpen = ref(false)

// Group teams by club; clubs without teams (fresh clubs) are listed too.
const groups = computed(() => {
  const clubs = myClubs.data.value ?? []
  const teams = myTeams.data.value ?? []
  return clubs.map((club) => ({
    ...club,
    teams: teams.filter((team) => team.club_id === club.club_id),
  }))
})
const isLoading = computed(() => myTeams.isPending.value || myClubs.isPending.value)
const isError = computed(() => myTeams.isError.value || myClubs.isError.value)

function roleLabel(team: MyTeam) {
  if (team.team_role === 'coach') return t('roles.coach')
  if (team.team_role === 'player') return t('roles.player')
  return t('roles.admin')
}

async function selectTeam(team: MyTeam) {
  setActiveTeam(team.team_id)
  await router.push({ name: 'events' })
}

async function onClubCreated(club: Club) {
  createOpen.value = false
  await router.push({ name: 'club', params: { clubId: club.id } })
}
</script>

<template>
  <section class="teams">
    <!-- Without a team (first start) squad and statistics make no sense yet. -->
    <TeamNav v-if="groups.length" active="teams" />
    <h1>{{ t('teams.title') }}</h1>

    <p v-if="isLoading" class="teams__muted">{{ t('common.loading') }}</p>
    <p v-else-if="isError" class="teams__error" role="alert">{{ t('teams.loadFailed') }}</p>

    <template v-else-if="groups.length === 0">
      <EmptyState icon="users" :title="t('teams.welcomeTitle')" :text="t('teams.welcomeText')">
        <BaseButton @click="createOpen = true">
          <template #icon><AppIcon name="plus" :size="18" /></template>
          {{ t('clubs.create') }}
        </BaseButton>
      </EmptyState>
      <BaseCard>
        <h2 class="teams__subtitle">{{ t('teams.gotInviteTitle') }}</h2>
        <p class="teams__muted">{{ t('teams.gotInviteText') }}</p>
      </BaseCard>
    </template>

    <template v-else>
      <article v-for="club in groups" :key="club.club_id" class="teams__club">
        <header class="teams__club-header">
          <h2 class="teams__subtitle">{{ club.club_name }}</h2>
          <RouterLink
            v-if="club.role === 'admin'"
            class="teams__manage"
            :to="{ name: 'club', params: { clubId: club.club_id } }"
          >
            {{ t('clubs.manage') }}
            <AppIcon name="chevronRight" :size="18" />
          </RouterLink>
        </header>

        <ul v-if="club.teams.length" class="teams__list" role="list">
          <li v-for="team in club.teams" :key="team.team_id">
            <button
              type="button"
              class="teams__team"
              :class="{ 'teams__team--active': team.team_id === activeTeam?.team_id }"
              :aria-current="team.team_id === activeTeam?.team_id ? 'true' : undefined"
              @click="selectTeam(team)"
            >
              <span class="teams__team-name">
                {{ team.team_name }}
                <span v-if="team.team_season" class="teams__muted">{{ team.team_season }}</span>
              </span>
              <BaseBadge :tone="team.team_role === 'player' ? 'neutral' : 'training'">
                {{ roleLabel(team) }}
              </BaseBadge>
              <AppIcon
                v-if="team.team_id === activeTeam?.team_id"
                name="check"
                :size="20"
                class="teams__check"
              />
            </button>
          </li>
        </ul>
        <p v-else class="teams__muted">{{ t('clubs.noTeamsYet') }}</p>
      </article>

      <BaseButton variant="secondary" block @click="createOpen = true">
        <template #icon><AppIcon name="plus" :size="18" /></template>
        {{ t('clubs.createAnother') }}
      </BaseButton>
    </template>

    <BaseModal v-model:open="createOpen" :title="t('clubs.create')">
      <p class="teams__muted teams__modal-intro">{{ t('clubs.createIntro') }}</p>
      <CreateClubForm @created="onClubCreated" />
    </BaseModal>
  </section>
</template>

<style scoped lang="scss">
.teams {
  display: flex;
  flex-direction: column;
  gap: $space-4;

  &__club {
    display: flex;
    flex-direction: column;
    gap: $space-2;
  }

  &__club-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $space-2;
  }

  &__subtitle {
    font-size: $font-lg;
  }

  &__manage {
    @include focus-visible;

    display: inline-flex;
    align-items: center;
    min-height: $touch-target;
    font-weight: 600;
    text-decoration: none;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: $space-2;
  }

  &__team {
    @include focus-visible;

    display: flex;
    align-items: center;
    gap: $space-3;
    width: 100%;
    min-height: 56px;
    padding: $space-3 $space-4;
    border: 2px solid var(--color-border);
    border-radius: $radius-lg;
    background: var(--color-surface);
    text-align: left;

    &--active {
      border-color: var(--color-primary);
    }
  }

  &__team-name {
    display: flex;
    flex: 1;
    flex-direction: column;
    font-weight: 600;
  }

  &__check {
    color: var(--color-primary);
  }

  &__muted {
    font-size: $font-sm;
    font-weight: 400;
    color: var(--color-text-muted);
  }

  &__modal-intro {
    margin-bottom: $space-4;
  }

  &__error {
    color: var(--color-danger);
  }
}
</style>
