<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AppIcon, { type IconName } from '@/components/AppIcon.vue'

const { t } = useI18n()

const tabs: { to: string; icon: IconName; labelKey: string }[] = [
  { to: '/events', icon: 'calendar', labelKey: 'nav.events' },
  { to: '/training', icon: 'whistle', labelKey: 'nav.training' },
  { to: '/squad', icon: 'users', labelKey: 'nav.squad' },
  { to: '/profile', icon: 'user', labelKey: 'nav.profile' },
]
</script>

<template>
  <div class="app-layout">
    <main class="app-layout__main">
      <RouterView />
    </main>

    <nav class="bottom-nav" :aria-label="t('nav.label')">
      <ul class="bottom-nav__list" role="list">
        <li v-for="tab in tabs" :key="tab.to">
          <RouterLink :to="tab.to" class="bottom-nav__link" active-class="bottom-nav__link--active">
            <AppIcon :name="tab.icon" />
            <span class="bottom-nav__label">{{ t(tab.labelKey) }}</span>
          </RouterLink>
        </li>
      </ul>
    </nav>
  </div>
</template>

<style scoped lang="scss">
.app-layout {
  min-height: 100dvh;

  &__main {
    @include safe-area-padding(top, $space-4);

    max-width: 720px;
    margin: 0 auto;
    padding-inline: $space-4;
    // Keep content clear of the fixed bottom navigation.
    padding-bottom: calc(#{$bottom-nav-height} + #{$space-5} + env(safe-area-inset-bottom, 0px));
  }
}

.bottom-nav {
  @include safe-area-padding(bottom);

  position: fixed;
  inset-inline: 0;
  bottom: 0;
  z-index: 50;
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
  box-shadow: 0 -2px 10px rgb(0 0 0 / 5%);

  &__list {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    max-width: 720px;
    height: $bottom-nav-height;
    margin: 0 auto;
  }

  &__link {
    @include touch-target;
    @include focus-visible;

    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    height: 100%;
    color: var(--color-text-muted);
    text-decoration: none;
    font-size: $font-xs;
    font-weight: 600;

    &--active {
      color: var(--color-primary);
    }
  }

  &__label {
    @include truncate;

    max-width: 100%;
  }
}
</style>
