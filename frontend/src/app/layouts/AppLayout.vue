<script setup lang="ts">
import { computed, nextTick, ref, watch, watchEffect } from 'vue'
import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AppIcon, { type IconName } from '@/components/AppIcon.vue'
import { useActiveTeam } from '@/features/teams/composables/useActiveTeam'
import { useMyClubs } from '@/features/teams/composables/useTeams'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { myTeams, activeTeam } = useActiveTeam()
const myClubs = useMyClubs()

type Tab = { key: string; to: RouteLocationRaw; match: string[]; icon: IconName; labelKey: string }

const adminClubs = computed(() => (myClubs.data.value ?? []).filter((c) => c.role === 'admin'))

// The club tab only exists for club admins: one club opens it directly, several open the list.
const tabs = computed<Tab[]>(() => {
  const result: Tab[] = [
    { key: 'events', to: '/events', match: ['/events'], icon: 'calendar', labelKey: 'nav.events' },
    {
      key: 'training',
      to: '/training',
      match: ['/training', '/drills'],
      icon: 'whistle',
      labelKey: 'nav.training',
    },
    {
      key: 'squad',
      to: '/squad',
      match: ['/squad', '/stats'],
      icon: 'users',
      labelKey: 'nav.squad',
    },
  ]
  const [onlyClub, ...others] = adminClubs.value
  if (onlyClub) {
    result.push({
      key: 'club',
      to: others.length
        ? { name: 'teams' }
        : { name: 'club', params: { clubId: onlyClub.club_id } },
      match: ['/clubs'],
      icon: 'building',
      labelKey: 'nav.club',
    })
  }
  result.push({
    key: 'profile',
    to: '/profile',
    match: ['/profile'],
    icon: 'user',
    labelKey: 'nav.profile',
  })
  return result
})

/** Back to where the user came from; direct visits (deep links) go to the parent page. */
function goBack() {
  const hasHistory = typeof window !== 'undefined' && window.history.state?.back
  if (hasHistory) router.back()
  else if (route.meta.back) void router.push({ name: route.meta.back })
}

// After navigating, move focus to the new page's heading so screen readers announce it
// (an SPA does not reload the page). Not on the first load: the user starts at the top.
const mainRef = ref<HTMLElement | null>(null)
watch(
  () => route.path,
  async (_path, previous) => {
    if (previous === undefined) return
    // Lazy pages render a moment later; wait until the heading exists.
    for (let i = 0; i < 20; i++) {
      await nextTick()
      const heading = mainRef.value?.querySelector<HTMLElement>('h1')
      if (heading) {
        heading.setAttribute('tabindex', '-1')
        heading.focus({ preventScroll: true })
        return
      }
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
  },
)

function isActive(tab: Tab) {
  return tab.match.some((prefix) => route.path.startsWith(prefix))
}

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
      <div class="app-header__inner">
        <button
          v-if="route.meta.back"
          type="button"
          class="app-header__back"
          :aria-label="t('common.back')"
          @click="goBack"
        >
          <AppIcon name="chevronLeft" :size="24" />
        </button>
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
      </div>
    </header>

    <main ref="mainRef" class="app-layout__main">
      <RouterView />
    </main>

    <nav class="bottom-nav" :aria-label="t('nav.label')">
      <ul class="bottom-nav__list" role="list">
        <li v-for="tab in tabs" :key="tab.key">
          <RouterLink
            :to="tab.to"
            class="bottom-nav__link"
            :class="{ 'bottom-nav__link--active': isActive(tab) }"
            :aria-current="isActive(tab) ? 'page' : undefined"
          >
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
    :deep(h1:focus) {
      outline: none;
    }

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

  &__inner {
    display: flex;
    align-items: center;
    max-width: 720px;
    margin: 0 auto;
  }

  &__back {
    @include touch-target;
    @include focus-visible;

    display: grid;
    flex-shrink: 0;
    place-items: center;
    margin-left: $space-1;
    border: 0;
    border-radius: $radius-md;
    background: transparent;
    color: var(--color-primary);
  }

  &__team {
    @include focus-visible;

    display: flex;
    flex: 1;
    align-items: center;
    gap: $space-3;
    min-width: 0;
    min-height: 56px;
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
    grid-auto-columns: 1fr;
    grid-auto-flow: column;
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
