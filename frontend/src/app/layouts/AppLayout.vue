<script setup lang="ts">
import { watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AppIcon, { type IconName } from '@/components/AppIcon.vue'
import { useActiveTeam } from '@/features/teams/composables/useActiveTeam'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { myTeams, activeTeam } = useActiveTeam()

const tabs: { to: string; icon: IconName; labelKey: string }[] = [
  { to: '/events', icon: 'calendar', labelKey: 'nav.events' },
  { to: '/training', icon: 'whistle', labelKey: 'nav.training' },
  { to: '/squad', icon: 'users', labelKey: 'nav.squad' },
  { to: '/profile', icon: 'user', labelKey: 'nav.profile' },
]

// Without any team, team pages make no sense: send the user to club/team setup.
watchEffect(() => {
  if (route.meta.requiresTeam && myTeams.isSuccess.value && myTeams.data.value?.length === 0) {
    void router.replace({ name: 'teams' })
  }
})
</script>

<template>
  <div class="app-layout">
    <header class="app-header">
      <RouterLink :to="{ name: 'teams' }" class="app-header__team">
        <span class="app-header__text">
          <template v-if="activeTeam">
            <span class="app-header__club">{{ activeTeam.club_name }}</span>
            <span class="app-header__name">{{ activeTeam.team_name }}</span>
          </template>
          <span v-else class="app-header__name">{{ t('app.name') }}</span>
        </span>
        <span class="app-header__switch">
          <AppIcon name="swap" :size="18" />
          <span class="app-header__switch-label">{{ t('teams.switch') }}</span>
        </span>
      </RouterLink>
    </header>

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
    max-width: 720px;
    margin: 0 auto;
    padding: $space-4 $space-4 0;
    // Keep content clear of the fixed bottom navigation.
    padding-bottom: calc(#{$bottom-nav-height} + #{$space-5} + env(safe-area-inset-bottom, 0px));
  }
}

.app-header {
  @include safe-area-padding(top);

  position: sticky;
  top: 0;
  z-index: 40;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);

  &__team {
    @include focus-visible;

    display: flex;
    align-items: center;
    gap: $space-3;
    max-width: 720px;
    min-height: 56px;
    margin: 0 auto;
    padding: $space-2 $space-4;
    color: inherit;
    text-decoration: none;
  }

  &__text {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    line-height: 1.25;
  }

  &__club {
    @include truncate;

    font-size: $font-xs;
    font-weight: 700;
    color: var(--color-text-muted);
  }

  &__name {
    @include truncate;

    font-size: $font-lg;
    font-weight: 800;
  }

  &__switch {
    display: inline-flex;
    align-items: center;
    gap: $space-1;
    color: var(--color-primary);
    font-size: $font-sm;
    font-weight: 600;
  }

  &__switch-label {
    @include visually-hidden;

    @include from($bp-sm) {
      position: static;
      width: auto;
      height: auto;
      margin: 0;
      overflow: visible;
      clip: auto;
    }
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
