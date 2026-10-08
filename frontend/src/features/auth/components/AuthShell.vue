<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import BaseCard from '@/components/BaseCard.vue'

defineProps<{ title: string; intro?: string }>()

const { t } = useI18n()
</script>

<template>
  <main class="auth-shell">
    <div class="auth-shell__brand">
      <span class="auth-shell__logo" aria-hidden="true">⚽</span>
      <p class="auth-shell__name">{{ t('app.name') }}</p>
      <p class="auth-shell__tagline">{{ t('auth.tagline') }}</p>
    </div>

    <slot name="before" />

    <BaseCard class="auth-shell__card">
      <h1 class="auth-shell__title">{{ title }}</h1>
      <p v-if="intro" class="auth-shell__intro">{{ intro }}</p>
      <slot />
    </BaseCard>

    <div v-if="$slots.footer" class="auth-shell__footer">
      <slot name="footer" />
    </div>
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
    text-align: center;
  }

  &__logo {
    font-size: 2.5rem;
  }

  &__name {
    font-size: $font-2xl;
    font-weight: 800;
  }

  &__tagline,
  &__intro {
    color: var(--color-text-muted);
  }

  &__title {
    font-size: $font-xl;
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
