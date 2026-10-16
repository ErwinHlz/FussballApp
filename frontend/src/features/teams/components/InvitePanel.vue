<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useClipboard } from '@vueuse/core'
import UiIcon from '@/ui/UiIcon.vue'
import UiButton from '@/ui/UiButton.vue'
import { formatDate } from '@/lib/date'
import { inviteUrl, type TeamInvite, type TeamRole } from '../api'
import { useCreateInvite, useRevokeInvite, useTeamInvites } from '../composables/useTeams'

const props = defineProps<{
  teamId: string
  teamName: string
  role: TeamRole
}>()

const { t, locale } = useI18n()
const invites = useTeamInvites(() => props.teamId)
const createInvite = useCreateInvite()
const revokeInvite = useRevokeInvite(() => props.teamId)
const { copy, isSupported: canCopy } = useClipboard({ legacy: true })
const copiedId = ref<string | null>(null)

const activeInvites = computed(() =>
  (invites.data.value ?? []).filter((invite) => invite.role === props.role),
)
const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

function shareText() {
  return props.role === 'coach'
    ? t('invites.shareTextCoach', { team: props.teamName })
    : t('invites.shareTextPlayer', { team: props.teamName })
}

async function share(invite: TeamInvite) {
  const url = inviteUrl(invite.token)
  try {
    await navigator.share({ title: t('app.name'), text: shareText(), url })
  } catch {
    // User cancelled or share failed: fall back to copying.
    await copyLink(invite)
  }
}

async function copyLink(invite: TeamInvite) {
  await copy(inviteUrl(invite.token))
  copiedId.value = invite.id
  setTimeout(() => {
    if (copiedId.value === invite.id) copiedId.value = null
  }, 2500)
}
</script>

<template>
  <div class="invite-panel">
    <p v-if="invites.isPending.value" class="invite-panel__muted">{{ t('common.loading') }}</p>
    <p v-else-if="invites.isError.value" class="invite-panel__error" role="alert">
      {{ t('invites.loadFailed') }}
    </p>

    <template v-else>
      <ul v-if="activeInvites.length" class="invite-panel__list" role="list">
        <li v-for="invite in activeInvites" :key="invite.id" class="invite-panel__item">
          <div class="invite-panel__link">
            <UiIcon name="link" :size="18" />
            <code class="invite-panel__url">{{ inviteUrl(invite.token) }}</code>
          </div>
          <p class="invite-panel__muted">
            {{ t('invites.validUntil', { date: formatDate(invite.expires_at, locale) }) }}
          </p>
          <div class="invite-panel__actions">
            <UiButton v-if="canShare" size="md" @click="share(invite)">
              <template #icon><UiIcon name="share" :size="18" /></template>
              {{ t('invites.share') }}
            </UiButton>
            <UiButton
              v-if="canCopy"
              :variant="canShare ? 'secondary' : 'primary'"
              @click="copyLink(invite)"
            >
              <template #icon>
                <UiIcon :name="copiedId === invite.id ? 'check' : 'copy'" :size="18" />
              </template>
              {{ copiedId === invite.id ? t('invites.copied') : t('invites.copy') }}
            </UiButton>
            <UiButton
              variant="ghost"
              :loading="revokeInvite.isPending.value && revokeInvite.variables.value === invite.id"
              @click="revokeInvite.mutate(invite.id)"
            >
              {{ t('invites.revoke') }}
            </UiButton>
          </div>
        </li>
      </ul>

      <UiButton
        v-else
        block
        :loading="createInvite.isPending.value"
        @click="createInvite.mutate({ teamId, role })"
      >
        <template #icon><UiIcon name="plus" :size="18" /></template>
        {{ role === 'coach' ? t('invites.createCoachLink') : t('invites.createPlayerLink') }}
      </UiButton>

      <p v-if="createInvite.isError.value" class="invite-panel__error" role="alert">
        {{ t('invites.createFailed') }}
      </p>
    </template>
  </div>
</template>

<style scoped lang="scss">
.invite-panel {
  display: flex;
  flex-direction: column;
  gap: $space-3;

  &__list {
    display: flex;
    flex-direction: column;
    gap: $space-3;
  }

  &__item {
    display: flex;
    flex-direction: column;
    gap: $space-2;
    padding: $space-3;
    border-radius: $radius-md;
    background: var(--color-surface-muted);
  }

  &__link {
    display: flex;
    align-items: center;
    gap: $space-2;
    min-width: 0;
    color: var(--color-text-muted);
  }

  &__url {
    @include truncate;

    font-size: $font-sm;
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    gap: $space-2;
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
