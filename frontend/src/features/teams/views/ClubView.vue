<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import UiIcon from '@/ui/UiIcon.vue'
import UiButton from '@/ui/UiButton.vue'
import BottomSheet from '@/ui/BottomSheet.vue'
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

// "Add team" as a sheet: rarely needed, so it does not stand open on the page.
const addTeamOpen = ref(false)
const onCreateTeam = handleSubmit(async (values) => {
  const team = await createTeam.mutateAsync({
    clubId: props.clubId,
    name: values.name,
    season: values.season || null,
  })
  resetForm()
  addTeamOpen.value = false
  openInviteTeamId.value = team.id
})

// Admins as a short list; appointing one searches the members in a sheet.
const admins = computed(() => (members.data.value ?? []).filter((m) => m.role === 'admin'))
const appointOpen = ref(false)
const search = ref('')
const candidates = computed(() => {
  const query = search.value.trim().toLocaleLowerCase('de')
  return (members.data.value ?? [])
    .filter((m) => m.role !== 'admin')
    .filter((m) => !query || m.display_name.toLocaleLowerCase('de').includes(query))
})

function setAdmin(member: ClubMember, admin: boolean) {
  setRole.mutate(
    { clubId: props.clubId, userId: member.user_id, role: admin ? 'admin' : 'member' },
    {
      onSuccess: () => {
        appointOpen.value = false
        search.value = ''
      },
    },
  )
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

      <!-- Teams: what the admin does most (invite coaches). -->
      <section class="club__section" aria-labelledby="club-teams">
        <div class="club__section-head">
          <h2 id="club-teams" class="club__subtitle">{{ t('clubs.teams') }}</h2>
          <UiButton variant="secondary" icon="plus" @click="addTeamOpen = true">
            {{ t('clubs.addTeam') }}
          </UiButton>
        </div>

        <p v-if="teams.isPending.value" class="club__muted">{{ t('common.loading') }}</p>
        <p v-else-if="!teams.data.value?.length" class="club__muted">
          {{ t('clubs.noTeamsHint') }}
        </p>

        <UiCard v-for="team in teams.data.value" :key="team.id" class="club__team" padding="sm">
          <div class="club__team-head">
            <div class="club__team-text">
              <h3>
                {{ team.name }}
                <span v-if="team.season" class="club__muted">{{ team.season }}</span>
              </h3>
              <p class="club__coaches">
                <template v-if="team.coaches.length">
                  {{ t('roles.coach') }}: {{ team.coaches.map((c) => c.display_name).join(', ') }}
                </template>
                <span v-else class="club__warning">{{ t('clubs.noCoachYet') }}</span>
              </p>
            </div>
            <UiButton
              variant="secondary"
              :aria-expanded="openInviteTeamId === team.id"
              @click="openInviteTeamId = openInviteTeamId === team.id ? null : team.id"
            >
              {{ openInviteTeamId === team.id ? t('common.close') : t('clubs.inviteCoach') }}
            </UiButton>
          </div>
          <InvitePanel
            v-if="openInviteTeamId === team.id"
            :team-id="team.id"
            :team-name="team.name"
            role="coach"
          />
        </UiCard>
      </section>

      <!-- Shared pitch schedule -->
      <section class="club__section" aria-labelledby="club-schedule">
        <h2 id="club-schedule" class="club__subtitle">{{ t('schedule.title') }}</h2>
        <div class="club__links">
          <UiButton variant="secondary" icon="calendar" :to="{ name: 'events-schedule' }">
            {{ t('schedule.title') }}
          </UiButton>
          <UiButton
            variant="secondary"
            icon="settings"
            :to="{ name: 'club-schedule-setup', params: { clubId } }"
          >
            {{ t('schedule.setup') }}
          </UiButton>
        </div>
      </section>

      <!-- Admins -->
      <section class="club__section" aria-labelledby="club-admins">
        <div class="club__section-head">
          <h2 id="club-admins" class="club__subtitle">{{ t('clubs.admins') }}</h2>
          <UiButton variant="secondary" icon="plus" @click="appointOpen = true">
            {{ t('clubs.appointAdmin') }}
          </UiButton>
        </div>
        <p class="club__muted">{{ t('clubs.adminsHint') }}</p>
        <ul class="club__members" role="list">
          <li v-for="member in admins" :key="member.user_id" class="club__member">
            <span class="club__member-name">
              {{ member.display_name }}
              <span v-if="member.user_id === auth.userId" class="club__muted">
                ({{ t('common.you') }})
              </span>
            </span>
            <UiButton
              variant="ghost"
              :disabled="admins.length <= 1"
              :loading="
                setRole.isPending.value && setRole.variables.value?.userId === member.user_id
              "
              @click="setAdmin(member, false)"
            >
              {{ t('clubs.removeAdmin') }}
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

      <!-- Logo and color: set up once, so folded away. -->
      <details class="club__fold">
        <summary class="club__fold-summary">
          <UiIcon name="shield" :size="22" />
          <span>{{ t('branding.title') }}</span>
          <UiIcon name="chevronDown" :size="20" class="club__fold-chevron" />
        </summary>
        <div class="club__fold-body">
          <p class="club__muted">{{ t('branding.intro') }}</p>
          <UiCard v-if="club.data.value">
            <ClubBrandingPanel :club="club.data.value" />
          </UiCard>
        </div>
      </details>

      <BottomSheet v-model:open="addTeamOpen" :title="t('clubs.addTeam')">
        <form class="club__form" novalidate @submit="onCreateTeam">
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
          <UiButton type="submit" block icon="plus" :loading="createTeam.isPending.value">
            {{ t('clubs.addTeam') }}
          </UiButton>
        </form>
      </BottomSheet>

      <BottomSheet v-model:open="appointOpen" :title="t('clubs.appointAdmin')">
        <UiInput v-model="search" type="search" :label="t('clubs.searchMember')" />
        <ul class="club__members club__members--pick" role="list">
          <li v-for="member in candidates" :key="member.user_id">
            <button type="button" class="club__pick" @click="setAdmin(member, true)">
              {{ member.display_name }}
              <span class="visually-hidden">– {{ t('clubs.makeAdmin') }}</span>
            </button>
          </li>
          <li v-if="!candidates.length" class="club__member club__muted">
            {{ t('clubs.noMemberFound') }}
          </li>
        </ul>
      </BottomSheet>
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

  &__section-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: $space-2;
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
    gap: $space-2;
  }

  &__team-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $space-2;
  }

  &__team-text {
    min-width: 0;

    h3 {
      font-size: $font-md;
    }
  }

  &__coaches {
    font-size: $font-sm;
  }

  &__members--pick {
    max-height: 50dvh;
    margin-top: $space-3;
    overflow-y: auto;
  }

  &__pick {
    @include focus-visible;

    width: 100%;
    min-height: 52px;
    padding: $space-2 $space-4;
    border: 0;
    background: transparent;
    color: var(--color-text);
    font-weight: 700;
    text-align: left;
  }

  li + li &__pick {
    border-top: 1px solid var(--color-border);
  }

  &__fold {
    border-radius: $radius-lg;
    background: var(--color-surface);
  }

  &__fold-summary {
    @include focus-visible;

    display: flex;
    align-items: center;
    gap: $space-3;
    min-height: 56px;
    padding: 0 $space-4;
    font-weight: 800;
    cursor: pointer;
    list-style: none;

    &::-webkit-details-marker {
      display: none;
    }

    span {
      flex: 1;
    }
  }

  &__fold[open] &__fold-chevron {
    transform: rotate(180deg);
  }

  &__fold-body {
    display: flex;
    flex-direction: column;
    gap: $space-3;
    padding: 0 $space-3 $space-3;
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
