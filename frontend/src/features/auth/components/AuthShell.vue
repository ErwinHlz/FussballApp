<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import RondoLogo from '@/ui/RondoLogo.vue'

defineProps<{ title: string; intro?: string }>()

const { t } = useI18n()
</script>

<template>
  <main class="auth-shell">
    <div class="auth-shell__brand">
      <RondoLogo :size="48" class="auth-shell__logo" />
      <p class="auth-shell__tagline">{{ t('auth.tagline') }}</p>
    </div>

    <slot name="before" />

    <div class="auth-shell__card">
      <h1 class="auth-shell__title">{{ title }}</h1>
      <p v-if="intro" class="auth-shell__intro">{{ intro }}</p>
      <slot />
    </div>

    <div v-if="$slots.footer" class="auth-shell__footer">
      <slot name="footer" />
    </div>

    <nav class="auth-shell__legal" :aria-label="t('legal.navLabel')">
      <RouterLink :to="{ name: 'privacy' }">{{ t('legal.privacy') }}</RouterLink>
      <RouterLink :to="{ name: 'imprint' }">{{ t('legal.imprint') }}</RouterLink>
    </nav>
  </main>
</template>

<style scoped lang="scss">
.auth-shell {
  @include safe-area-padding(top, $space-6);
  @include safe-area-padding(bottom, $space-5);

  display: flex;
  flex-direction: column;
  gap: $space-4;
  max-width: 420px;
  margin: 0 auto;
  padding-inline: $space-4;

  &__brand {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: $space-1;
    text-align: center;
  }

  &__logo {
    :deep(.rondo-logo__word) {
      font-size: 2.75rem;
    }
  }

  &__tagline,
  &__intro {
    color: var(--color-text-muted);
  }

  &__card {
    padding: $space-5 $space-4;
    border-radius: 24px;
    background: var(--color-surface);
    box-shadow: var(--shadow-sm);
  }

  &__title {
    font-size: $font-2xl;
    margin-bottom: $space-2;
  }

  &__intro {
    margin-bottom: $space-4;
  }

  &__footer {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: $space-2;
    text-align: center;

    :deep(a) {
      @include focus-visible;

      display: inline-flex;
      align-items: center;
      min-height: $touch-target;
      font-weight: 600;
    }
  }

  &__legal {
    display: flex;
    justify-content: center;
    gap: $space-4;
    font-size: $font-sm;

    a {
      @include focus-visible;

      display: inline-flex;
      align-items: center;
      min-height: $touch-target;
      color: var(--color-text-muted);
    }
  }
}

// Shared form layout for all auth views.
:slotted(.auth-form) {
  display: flex;
  flex-direction: column;
  gap: $space-4;
}

:slotted(.auth-form__error) {
  color: var(--color-danger);
}

:slotted(.auth-form__link) {
  align-self: flex-end;
  font-size: $font-sm;
  font-weight: 600;
}
</style>
