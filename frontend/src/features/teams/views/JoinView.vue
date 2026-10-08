<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/components/BaseButton.vue'
import BaseBadge from '@/components/BaseBadge.vue'
import AuthShell from '@/features/auth/components/AuthShell.vue'
import { useAuthStore } from '@/stores/auth'
import { useActiveTeamStore } from '@/stores/activeTeam'
import { formatDate } from '@/lib/date'
import { useAcceptInvite, useInviteInfo } from '../composables/useTeams'

const props = defineProps<{ token: string }>()

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const activeTeam = useActiveTeamStore()
const info = useInviteInfo(() => props.token)
const accept = useAcceptInvite()

// After sign-up/sign-in we come back with ?accept=1 and join automatically.
const returnPath = computed(() => `/join/${props.token}?accept=1`)
const invite = computed(() => info.data.value ?? null)
const isValid = computed(() => invite.value?.status === 'valid')
const roleLabel = computed(() =>
  invite.value?.role === 'coach' ? t('roles.coach') : t('roles.player'),
)

async function join() {
  const teamId = await accept.mutateAsync(props.token)
  activeTeam.setActiveTeam(teamId)
  await router.replace({ name: 'squad' })
}

function maybeAutoJoin() {
  if (route.query.accept === '1' && auth.isAuthenticated && isValid.value && accept.isIdle.value) {
    void join()
  }
}

onMounted(maybeAutoJoin)
watch(isValid, maybeAutoJoin)
</script>

<template>
  <AuthShell :title="t('join.title')">
    <p v-if="info.isPending.value">{{ t('common.loading') }}</p>

    <p v-else-if="info.isError.value" class="join__error" role="alert">
      {{ t('join.loadFailed') }}
    </p>

    <p v-else-if="!invite" role="alert">{{ t('join.notFound') }}</p>

    <p v-else-if="!isValid" role="alert">
      {{ invite.status === 'revoked' ? t('join.revoked') : t('join.expired') }}
    </p>

    <div v-else class="join">
      <div class="join__invite">
        <p class="join__club">{{ invite.club_name }}</p>
        <p class="join__team">
          {{ invite.team_name }}
          <span v-if="invite.team_season" class="join__muted">{{ invite.team_season }}</span>
        </p>
        <BaseBadge :tone="invite.role === 'coach' ? 'training' : 'info'">
          {{ t('join.asRole', { role: roleLabel }) }}
        </BaseBadge>
        <p class="join__muted">
          {{ t('invites.validUntil', { date: formatDate(invite.expires_at, locale) }) }}
        </p>
      </div>

      <template v-if="auth.isAuthenticated">
        <p class="join__muted">{{ t('join.signedInAs', { email: auth.user?.email }) }}</p>
        <p v-if="accept.isError.value" class="join__error" role="alert">
          {{ t('join.acceptFailed') }}
        </p>
        <BaseButton size="lg" block :loading="accept.isPending.value" @click="join">
          {{ t('join.accept') }}
        </BaseButton>
      </template>

      <template v-else>
        <p>{{ t('join.needAccount') }}</p>
        <RouterLink
          v-slot="{ navigate }"
          custom
          :to="{ name: 'register', query: { redirect: returnPath } }"
        >
          <BaseButton size="lg" block @click="navigate">{{ t('join.register') }}</BaseButton>
        </RouterLink>
        <RouterLink
          v-slot="{ navigate }"
          custom
          :to="{ name: 'login', query: { redirect: returnPath } }"
        >
          <BaseButton variant="secondary" block @click="navigate">
            {{ t('join.haveAccount') }}
          </BaseButton>
        </RouterLink>
      </template>
    </div>
  </AuthShell>
</template>

<style scoped lang="scss">
.join {
  display: flex;
  flex-direction: column;
  gap: $space-4;

  &__invite {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: $space-2;
    padding: $space-4;
    border-radius: $radius-md;
    background: var(--color-surface-muted);
  }

  &__club {
    font-size: $font-sm;
    font-weight: 700;
    color: var(--color-text-muted);
  }

  &__team {
    font-size: $font-xl;
    font-weight: 800;
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
