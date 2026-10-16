<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import UiBadge from '@/ui/UiBadge.vue'
import UiButton from '@/ui/UiButton.vue'
import UiIcon from '@/ui/UiIcon.vue'
import UiSkeleton from '@/ui/UiSkeleton.vue'
import { applyClubTheme, clubLogoUrl } from '@/lib/clubTheme'
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
// The invite looks like the club: its logo and its color.
const logoUrl = computed(() =>
  invite.value?.club_logo_path ? clubLogoUrl(invite.value.club_logo_path) : null,
)
watch(
  () => invite.value?.club_accent_color ?? null,
  (accent) => applyClubTheme(accent),
  { immediate: true },
)
onUnmounted(() => applyClubTheme(null))

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
    // Errors are shown via accept.isError; do not leave the promise unhandled.
    join().catch(() => undefined)
  }
}

onMounted(maybeAutoJoin)
watch(isValid, maybeAutoJoin)
</script>

<template>
  <AuthShell :title="t('join.title')">
    <div v-if="info.isPending.value" aria-busy="true">
      <UiSkeleton shape="block" height="180px" />
    </div>

    <p v-else-if="info.isError.value" class="join__error" role="alert">
      {{ t('join.loadFailed') }}
    </p>

    <p v-else-if="!invite" role="alert">{{ t('join.notFound') }}</p>

    <p v-else-if="!isValid" role="alert">
      {{ invite.status === 'revoked' ? t('join.revoked') : t('join.expired') }}
    </p>

    <div v-else class="join">
      <div class="join__invite">
        <img v-if="logoUrl" :src="logoUrl" alt="" class="join__logo" />
        <span v-else class="join__crest" aria-hidden="true">
          <UiIcon name="building" :size="32" />
        </span>
        <p class="join__club">{{ invite.club_name }}</p>
        <p class="join__team">{{ invite.team_name }}</p>
        <p v-if="invite.team_season" class="join__muted">{{ invite.team_season }}</p>
        <UiBadge :tone="invite.role === 'coach' ? 'accent' : 'training'">
          {{ t('join.asRole', { role: roleLabel }) }}
        </UiBadge>
      </div>

      <template v-if="auth.isAuthenticated">
        <p v-if="accept.isError.value" class="join__error" role="alert">
          {{ t('join.acceptFailed') }}
        </p>
        <UiButton size="lg" block icon="check" :loading="accept.isPending.value" @click="join">
          {{ t('join.accept') }}
        </UiButton>
        <p class="join__muted join__center">
          {{ t('join.signedInAs', { email: auth.user?.email }) }}
        </p>
      </template>

      <template v-else>
        <UiButton size="lg" block :to="{ name: 'register', query: { redirect: returnPath } }">
          {{ t('join.register') }}
        </UiButton>
        <p class="join__muted join__center">{{ t('join.needAccount') }}</p>
        <UiButton variant="ghost" block :to="{ name: 'login', query: { redirect: returnPath } }">
          {{ t('join.haveAccount') }}
        </UiButton>
      </template>

      <p class="join__muted join__center">
        {{ t('invites.validUntil', { date: formatDate(invite.expires_at, locale) }) }}
      </p>
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
    align-items: center;
    gap: $space-2;
    padding: $space-5 $space-4;
    border: 2px dashed var(--color-chalk);
    border-radius: 24px;
    text-align: center;
  }

  &__logo {
    width: 88px;
    height: 88px;
    object-fit: contain;
  }

  &__crest {
    display: grid;
    place-items: center;
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: var(--color-primary);
    color: var(--color-primary-contrast);
  }

  &__club {
    color: var(--color-text-muted);
    font-weight: 700;
  }

  &__team {
    font-family: var(--font-display);
    font-size: $font-display;
    font-weight: 800;
    line-height: 1;
  }

  &__muted {
    color: var(--color-text-muted);
    font-size: $font-sm;
  }

  &__center {
    text-align: center;
  }

  &__error {
    color: var(--color-danger);
  }
}
</style>
