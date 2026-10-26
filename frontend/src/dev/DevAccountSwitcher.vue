<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { queryClient } from '@/lib/queryClient'
import { useAuthStore } from '@/stores/auth'
import BottomSheet from '@/ui/BottomSheet.vue'
import UiAvatar from '@/ui/UiAvatar.vue'
import UiIcon from '@/ui/UiIcon.vue'
import { DEV_ACCOUNTS, DEV_CLUBS, DEV_PASSWORD, type DevAccount, type DevClub } from './accounts'

/**
 * Debug tool for development builds only (see App.vue): a handle at the left edge opens the
 * test accounts of `npm run seed:dev`; one tap signs in as that account.
 */
const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()

const open = ref(false)
const busy = ref<string | null>(null)
const failed = ref<string | null>(null)

const clubs = computed(() =>
  (Object.keys(DEV_CLUBS) as DevClub[]).map((club) => {
    const ofClub = DEV_ACCOUNTS.filter((a) => a.club === club)
    return {
      name: club,
      groups: [
        { key: 'club', title: t('dev.switcher.club'), accounts: ofClub.filter((a) => !a.team) },
        ...DEV_CLUBS[club].map((team) => ({
          key: team,
          title: team,
          accounts: ofClub.filter((a) => a.team === team),
        })),
      ],
    }
  }),
)

async function switchTo(account: DevAccount) {
  busy.value = account.email
  failed.value = null
  try {
    await supabase.auth.signOut({ scope: 'local' })
    const { error } = await supabase.auth.signInWithPassword({
      email: account.email,
      password: DEV_PASSWORD,
    })
    if (error) throw error
    // Nothing of the previous account may stay in the cache.
    queryClient.clear()
    open.value = false
    await router.replace({ name: 'home' })
  } catch {
    failed.value = account.email
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <button
    type="button"
    class="dev-switcher__handle"
    :aria-label="t('dev.switcher.open')"
    aria-haspopup="dialog"
    @click="open = true"
  >
    <UiIcon name="swap" :size="20" />
  </button>

  <BottomSheet
    v-model:open="open"
    :title="t('dev.switcher.title')"
    :description="t('dev.switcher.hint', { password: DEV_PASSWORD })"
  >
    <p v-if="failed" class="dev-switcher__error" role="alert">
      {{ t('dev.switcher.failed') }}
    </p>
    <section v-for="club in clubs" :key="club.name" class="dev-switcher__club">
      <h3 class="dev-switcher__club-title">{{ club.name }}</h3>
      <section v-for="group in club.groups" :key="group.key" class="dev-switcher__group">
        <h4 class="dev-switcher__group-title">{{ group.title }}</h4>
        <ul class="dev-switcher__list" role="list">
          <li v-for="account in group.accounts" :key="account.email">
            <button
              type="button"
              class="dev-switcher__account"
              :aria-current="auth.user?.email === account.email ? 'true' : undefined"
              :disabled="!!busy"
              @click="switchTo(account)"
            >
              <UiAvatar :name="account.name" :size="36" />
              <span class="dev-switcher__text">
                <span class="dev-switcher__name">{{ account.name }}</span>
                <span class="dev-switcher__meta">
                  {{ t(`dev.switcher.roles.${account.role}`) }} · {{ account.email }}
                </span>
              </span>
              <UiIcon
                v-if="auth.user?.email === account.email"
                name="check"
                :size="20"
                class="dev-switcher__current"
              />
            </button>
          </li>
        </ul>
      </section>
    </section>
  </BottomSheet>
</template>

<style scoped lang="scss">
.dev-switcher {
  &__club + &__club {
    margin-top: $space-6;
  }

  &__club-title {
    margin-bottom: $space-2;
    font-size: $font-lg;
    font-weight: 800;
  }

  &__handle {
    @include focus-visible;

    position: fixed;
    top: 45%;
    left: 0;
    z-index: 95;
    display: grid;
    place-items: center;
    width: 32px;
    height: $touch-target;
    border: 0;
    border-radius: 0 $radius-lg $radius-lg 0;
    background: #db2777;
    color: #fff;
    opacity: 0.75;
    box-shadow: var(--shadow-md);

    &:hover,
    &:focus-visible {
      opacity: 1;
    }
  }

  &__group {
    display: flex;
    flex-direction: column;
    gap: $space-1;

    & + & {
      margin-top: $space-4;
    }
  }

  &__group-title {
    color: var(--color-text-muted);
    font-size: $font-sm;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: $space-1;
    margin: 0;
  }

  &__account {
    @include focus-visible;

    display: flex;
    align-items: center;
    gap: $space-3;
    width: 100%;
    min-height: 56px;
    padding: $space-2 $space-3;
    border: 2px solid transparent;
    border-radius: $radius-lg;
    background: var(--color-surface);
    color: var(--color-text);
    text-align: left;

    &[aria-current='true'] {
      border-color: var(--color-primary);
    }

    &:disabled {
      opacity: 0.6;
    }
  }

  &__text {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }

  &__name {
    font-weight: 800;
  }

  &__meta {
    @include truncate;

    color: var(--color-text-muted);
    font-size: $font-sm;
  }

  &__current {
    color: var(--color-primary-text, var(--color-primary));
  }

  &__error {
    margin-bottom: $space-3;
    color: var(--color-danger);
    font-weight: 700;
  }
}
</style>
