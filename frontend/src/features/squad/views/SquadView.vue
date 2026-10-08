<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/AppIcon.vue'
import BaseBadge from '@/components/BaseBadge.vue'
import BaseButton from '@/components/BaseButton.vue'
import BaseCard from '@/components/BaseCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import { useAuthStore } from '@/stores/auth'
import InvitePanel from '@/features/teams/components/InvitePanel.vue'
import { useActiveTeam } from '@/features/teams/composables/useActiveTeam'
import { useTeamMembers } from '@/features/teams/composables/useTeams'

const { t } = useI18n()
const auth = useAuthStore()
const { activeTeam, isCoach } = useActiveTeam()
const members = useTeamMembers(() => activeTeam.value?.team_id ?? null)
const inviteOpen = ref(false)

const coaches = computed(() => (members.data.value ?? []).filter((m) => m.role === 'coach'))
const players = computed(() => (members.data.value ?? []).filter((m) => m.role === 'player'))
</script>

<template>
  <section class="squad">
    <h1>{{ t('squad.title') }}</h1>

    <BaseCard v-if="isCoach && activeTeam" class="squad__invite">
      <BaseButton
        :variant="inviteOpen ? 'secondary' : 'primary'"
        block
        :aria-expanded="inviteOpen"
        @click="inviteOpen = !inviteOpen"
      >
        <template #icon><AppIcon :name="inviteOpen ? 'x' : 'plus'" :size="18" /></template>
        {{ inviteOpen ? t('common.close') : t('squad.invitePlayers') }}
      </BaseButton>
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
          <li v-for="member in coaches" :key="member.id" class="squad__member">
            <span class="squad__name">{{ member.display_name }}</span>
            <span v-if="member.user_id === auth.userId" class="squad__muted">
              ({{ t('common.you') }})
            </span>
            <BaseBadge tone="training">{{ t('roles.coach') }}</BaseBadge>
          </li>
        </ul>
      </section>

      <section class="squad__group" aria-labelledby="squad-players">
        <h2 id="squad-players" class="squad__subtitle">
          {{ t('squad.players') }} ({{ players.length }})
        </h2>
        <ul v-if="players.length" class="squad__list" role="list">
          <li v-for="member in players" :key="member.id" class="squad__member">
            <span class="squad__name">{{ member.display_name }}</span>
            <span v-if="member.user_id === auth.userId" class="squad__muted">
              ({{ t('common.you') }})
            </span>
          </li>
        </ul>
        <EmptyState
          v-else
          icon="users"
          :title="t('squad.empty')"
          :text="isCoach ? t('squad.emptyHint') : undefined"
        />
      </section>
    </template>
  </section>
</template>

<style scoped lang="scss">
.squad {
  display: flex;
  flex-direction: column;
  gap: $space-4;

  &__invite {
    display: flex;
    flex-direction: column;
    gap: $space-3;
  }

  &__group {
    display: flex;
    flex-direction: column;
    gap: $space-2;
  }

  &__subtitle {
    font-size: $font-lg;
  }

  &__list {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: $radius-lg;
  }

  &__member {
    display: flex;
    align-items: center;
    gap: $space-2;
    min-height: 52px;
    padding: $space-2 $space-4;

    & + & {
      border-top: 1px solid var(--color-border);
    }
  }

  &__name {
    font-weight: 600;
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
