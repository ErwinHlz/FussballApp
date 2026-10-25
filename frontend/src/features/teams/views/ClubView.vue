<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import UiIcon from '@/ui/UiIcon.vue'
import UiBadge from '@/ui/UiBadge.vue'
import UiButton from '@/ui/UiButton.vue'
import UiCard from '@/ui/UiCard.vue'
import UiInput from '@/ui/UiInput.vue'
import { useAuthStore } from '@/stores/auth'
import ClubBrandingPanel from '../components/ClubBrandingPanel.vue'
import InvitePanel from '../components/InvitePanel.vue'
import { teamSchema } from '../schemas'
import type { ClubMember } from '../api'
import {
  useClub,
  useClubMembers,
  useClubTeams,
  useCreateTeam,
  useSetClubMemberRole,
} from '../composables/useTeams'
import PageProblem from '@/ui/PageProblem.vue'

const props = defineProps<{ clubId: string }>()

const { t } = useI18n()
const auth = useAuthStore()
const club = useClub(() => props.clubId)
const teams = useClubTeams(() => props.clubId)
const members = useClubMembers(() => props.clubId)
const createTeam = useCreateTeam()
const setRole = useSetClubMemberRole()

const openInviteTeamId = ref<string | null>(null)

const { defineField, errors, handleSubmit, resetForm } = useForm({
  validationSchema: toTypedSchema(teamSchema),
})
const [teamName] = defineField('name')
const [season] = defineField('season')

const onCreateTeam = handleSubmit(async (values) => {
  const team = await createTeam.mutateAsync({
    clubId: props.clubId,
    name: values.name,
    season: values.season || null,
  })
  resetForm()
  openInviteTeamId.value = team.id
})

const adminCount = computed(
  () => (members.data.value ?? []).filter((m) => m.role === 'admin').length,
)

function toggleAdmin(member: ClubMember) {
  setRole.mutate({
    clubId: props.clubId,
    userId: member.user_id,
    role: member.role === 'admin' ? 'member' : 'admin',
  })
}
</script>

<template>
  <section class="club">
    <p v-if="club.isPending.value" class="club__muted">{{ t('common.loading') }}</p>
    <PageProblem
      v-else-if="club.isError.value"
      :title="t('clubs.loadFailed')"
      :text="t('problem.hint')"
      :to="{ name: 'teams' }"
      :action="t('problem.toTeams')"
    />

    <template v-else>
      <header>
        <p class="club__eyebrow">{{ t('clubs.club') }}</p>
        <h1>{{ club.data.value?.name }}</h1>
      </header>

      <!-- Logo and color -->
      <section class="club__section" aria-labelledby="club-branding">
        <h2 id="club-branding" class="club__subtitle">{{ t('branding.title') }}</h2>
        <p class="club__muted">{{ t('branding.intro') }}</p>
        <UiCard v-if="club.data.value">
          <ClubBrandingPanel :club="club.data.value" />
        </UiCard>
      </section>

      <!-- Shared pitch schedule -->
      <section class="club__section" aria-labelledby="club-schedule">
        <h2 id="club-schedule" class="club__subtitle">{{ t('schedule.title') }}</h2>
        <p class="club__muted">{{ t('schedule.openHint') }}</p>
        <div class="club__links">
          <RouterLink v-slot="{ navigate }" custom :to="{ name: 'events-schedule' }">
            <UiButton variant="secondary" block @click="navigate">
              <template #icon><UiIcon name="calendar" :size="18" /></template>
              {{ t('schedule.title') }}
            </UiButton>
          </RouterLink>
          <RouterLink
            v-slot="{ navigate }"
            custom
            :to="{ name: 'club-schedule-setup', params: { clubId } }"
          >
            <UiButton variant="secondary" block @click="navigate">
              <template #icon><UiIcon name="building" :size="18" /></template>
              {{ t('schedule.setup') }}
            </UiButton>
          </RouterLink>
        </div>
      </section>

      <!-- Teams -->
      <section class="club__section" aria-labelledby="club-teams">
        <h2 id="club-teams" class="club__subtitle">{{ t('clubs.teams') }}</h2>

        <p v-if="teams.isPending.value" class="club__muted">{{ t('common.loading') }}</p>
        <p v-else-if="!teams.data.value?.length" class="club__muted">
          {{ t('clubs.noTeamsHint') }}
        </p>

        <UiCard v-for="team in teams.data.value" :key="team.id" class="club__team">
          <div class="club__team-head">
            <div>
              <h3>{{ team.name }}</h3>
              <p v-if="team.season" class="club__muted">{{ team.season }}</p>
            </div>
          </div>

          <p class="club__coaches">
            <strong>{{ t('roles.coach') }}:</strong>
            <template v-if="team.coaches.length">
              {{ team.coaches.map((c) => c.display_name).join(', ') }}
            </template>
            <span v-else class="club__warning">{{ t('clubs.noCoachYet') }}</span>
          </p>

          <UiButton
            variant="secondary"
            block
            :aria-expanded="openInviteTeamId === team.id"
            @click="openInviteTeamId = openInviteTeamId === team.id ? null : team.id"
          >
            {{ openInviteTeamId === team.id ? t('common.close') : t('clubs.inviteCoach') }}
          </UiButton>
          <InvitePanel
            v-if="openInviteTeamId === team.id"
            :team-id="team.id"
            :team-name="team.name"
            role="coach"
          />
        </UiCard>

        <UiCard>
          <form class="club__form" novalidate @submit="onCreateTeam">
            <h3>{{ t('clubs.addTeam') }}</h3>
            <UiInput
              v-model="teamName"
              :label="t('clubs.teamName')"
              :placeholder="t('clubs.teamNamePlaceholder')"
              required
              :error="errors.name ? t(errors.name) : undefined"
            />
            <UiInput
              v-model="season"
              :label="t('clubs.season')"
              :placeholder="t('clubs.seasonPlaceholder')"
              :error="errors.season ? t(errors.season) : undefined"
            />
            <p v-if="createTeam.isError.value" class="club__error" role="alert">
              {{ t('clubs.addTeamFailed') }}
            </p>
            <UiButton type="submit" block :loading="createTeam.isPending.value">
              <template #icon><UiIcon name="plus" :size="18" /></template>
              {{ t('clubs.addTeam') }}
            </UiButton>
          </form>
        </UiCard>
      </section>

      <!-- Members & admins -->
      <section class="club__section" aria-labelledby="club-members">
        <h2 id="club-members" class="club__subtitle">{{ t('clubs.members') }}</h2>
        <p class="club__muted">{{ t('clubs.adminsHint') }}</p>

        <ul class="club__members" role="list">
          <li v-for="member in members.data.value" :key="member.user_id" class="club__member">
            <span class="club__member-name">
              {{ member.display_name }}
              <span v-if="member.user_id === auth.userId" class="club__muted">
                ({{ t('common.you') }})
              </span>
            </span>
            <UiBadge v-if="member.role === 'admin'" tone="training">
              <UiIcon name="shield" :size="14" />
              {{ t('roles.admin') }}
            </UiBadge>
            <UiButton
              variant="ghost"
              :disabled="member.role === 'admin' && adminCount <= 1"
              :loading="
                setRole.isPending.value && setRole.variables.value?.userId === member.user_id
              "
              @click="toggleAdmin(member)"
            >
              {{ member.role === 'admin' ? t('clubs.removeAdmin') : t('clubs.makeAdmin') }}
            </UiButton>
          </li>
        </ul>
        <p v-if="setRole.isError.value" class="club__error" role="alert">
          {{
            (setRole.error.value as { hint?: string } | null)?.hint === 'already_admin'
              ? t('clubs.otherClubAdmin')
              : t('clubs.roleChangeFailed')
          }}
        </p>
      </section>
    </template>
  </section>
</template>

<style scoped lang="scss">
.club {
  display: flex;
  flex-direction: column;
  gap: $space-5;

  &__eyebrow {
    font-size: $font-sm;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-text-muted);
  }

  &__section {
    display: flex;
    flex-direction: column;
    gap: $space-3;
  }

  &__subtitle {
    font-size: $font-lg;
  }

  &__team,
  &__form {
    display: flex;
    flex-direction: column;
    gap: $space-3;
  }

  &__links {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: $space-2;
  }

  &__team-head {
    display: flex;
    justify-content: space-between;
    gap: $space-2;
  }

  &__warning {
    color: var(--color-warning);
    font-weight: 600;
  }

  &__members {
    display: flex;
    flex-direction: column;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: $radius-lg;
  }

  &__member {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: $space-2;
    padding: $space-2 $space-2 $space-2 $space-4;

    & + & {
      border-top: 1px solid var(--color-border);
    }
  }

  &__member-name {
    flex: 1 1 8rem;
    min-width: 0;
    overflow-wrap: anywhere;
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
