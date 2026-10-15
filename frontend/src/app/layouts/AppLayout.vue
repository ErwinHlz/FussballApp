<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useWindowScroll } from '@vueuse/core'
import { useActiveTeam } from '@/features/teams/composables/useActiveTeam'
import { useProfile } from '@/features/auth/composables/useProfile'
import { applyClubTheme, clubLogoUrl } from '@/lib/clubTheme'
import SnackbarHost from '@/ui/SnackbarHost.vue'
import TabBar, { type Tab } from '@/ui/TabBar.vue'
import UiAvatar from '@/ui/UiAvatar.vue'
import UiIcon from '@/ui/UiIcon.vue'
import UiIconButton from '@/ui/UiIconButton.vue'
import RondoLogo from '@/ui/RondoLogo.vue'
import TeamSwitcherSheet from './TeamSwitcherSheet.vue'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { myTeams, activeTeam } = useActiveTeam()
const profile = useProfile()

// The app takes on the colors of the active team's club.
watch(
  () => activeTeam.value?.club_accent_color ?? null,
  (accent) => applyClubTheme(accent),
  { immediate: true },
)
onUnmounted(() => applyClubTheme(null))
const logoUrl = computed(() =>
  activeTeam.value?.club_logo_path ? clubLogoUrl(activeTeam.value.club_logo_path) : null,
)

// Tabs (UI-PLAN.md, section 4). Profile and club administration live behind the header.
const tabs = computed<Tab[]>(() => [
  { key: 'home', to: { name: 'home' }, icon: 'home', label: t('nav.start') },
  { key: 'events', to: { name: 'events' }, icon: 'calendar', label: t('nav.events') },
  { key: 'training', to: { name: 'training' }, icon: 'cone', label: t('nav.training') },
  { key: 'team', to: { name: 'squad' }, icon: 'users', label: t('nav.team') },
])
const tabPrefixes: [string, string[]][] = [
  ['events', ['/events']],
  ['training', ['/training', '/drills', '/boards', '/templates']],
  ['team', ['/squad', '/stats', '/teams', '/clubs']],
]
const activeTab = computed(() => {
  if (route.name === 'home') return 'home'
  return (
    tabPrefixes.find(([, prefixes]) => prefixes.some((p) => route.path.startsWith(p)))?.[0] ?? null
  )
})

const showNav = computed(() => !route.meta.hideNav)
// Fixed elements (snackbar, action bars, floating buttons) keep clear of the tab bar.
watchEffect(() => {
  const root = document.documentElement.style
  if (showNav.value)
    root.setProperty('--nav-offset', `calc(76px + env(safe-area-inset-bottom, 0px))`)
  else root.removeProperty('--nav-offset')
})
onUnmounted(() => document.documentElement.style.removeProperty('--nav-offset'))

// The header gets smaller once the page scrolls.
const { y } = useWindowScroll()
const compact = computed(() => y.value > 12)

const switcherOpen = ref(false)
const displayName = computed(() => profile.data.value?.display_name ?? '')

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

// Without any team, team pages make no sense: send the user to club/team setup.
watchEffect(() => {
  if (route.meta.requiresTeam && myTeams.isSuccess.value && myTeams.data.value?.length === 0) {
    void router.replace({ name: 'teams' })
  }
})
</script>

<template>
  <div class="app-layout" :class="{ 'app-layout--no-nav': !showNav }">
    <header class="top-bar" :class="{ 'top-bar--compact': compact }">
      <div class="top-bar__inner">
        <UiIconButton
          v-if="route.meta.back"
          icon="chevronLeft"
          :label="t('common.back')"
          @click="goBack"
        />
        <button
          type="button"
          class="top-bar__team"
          aria-haspopup="dialog"
          @click="switcherOpen = true"
        >
          <img v-if="logoUrl" :src="logoUrl" alt="" class="top-bar__logo" />
          <RondoLogo v-else-if="!activeTeam" :size="32" :wordmark="false" />
          <span class="top-bar__text">
            <template v-if="activeTeam">
              <span class="top-bar__name">{{ activeTeam.team_name }}</span>
              <span class="top-bar__club">{{ activeTeam.club_name }}</span>
            </template>
            <span v-else class="top-bar__name">{{ t('app.name') }}</span>
          </span>
          <UiIcon name="chevronDown" :size="18" class="top-bar__chevron" />
          <span class="visually-hidden">{{ t('ui.teamSwitcher.open') }}</span>
        </button>
        <RouterLink
          :to="{ name: 'profile' }"
          class="top-bar__profile"
          :aria-label="t('nav.profile')"
        >
          <UiAvatar v-if="displayName" :name="displayName" :size="40" />
          <UiIcon v-else name="user" :size="22" />
        </RouterLink>
      </div>
    </header>

    <main ref="mainRef" class="app-layout__main">
      <RouterView />
    </main>

    <TabBar v-if="showNav" :tabs="tabs" :active="activeTab" :label="t('nav.label')" />
    <TeamSwitcherSheet v-model:open="switcherOpen" />
    <SnackbarHost />
  </div>
</template>

<style scoped lang="scss">
.app-layout {
  // Sticky headers inside pages (e.g. week headings) sit right below the top bar.
  --top-bar-height: calc(64px + env(safe-area-inset-top, 0px));

  min-height: 100dvh;

  &__main {
    :deep(h1:focus) {
      outline: none;
    }

    max-width: 720px;
    margin: 0 auto;
    padding: $space-2 $space-4 0;
    // Keep content clear of the floating tab bar.
    padding-bottom: calc(#{$bottom-nav-height} + #{$space-6} + env(safe-area-inset-bottom, 0px));
  }

  &--no-nav &__main {
    padding-bottom: calc(#{$space-6} + env(safe-area-inset-bottom, 0px));
  }
}

.top-bar {
  @include safe-area-padding(top);

  position: sticky;
  top: 0;
  z-index: 40;
  background: var(--color-bg);
  transition: box-shadow var(--duration-medium) var(--ease-out);

  &--compact {
    box-shadow: 0 1px 0 var(--color-border);
  }

  &__inner {
    display: flex;
    align-items: center;
    gap: $space-2;
    max-width: 720px;
    // Constant height: shrinking the bar while scrolling would shift the page and make the
    // scroll position jitter around the threshold. Only type size and the club line change.
    height: 64px;
    margin: 0 auto;
    padding: $space-2 $space-3 $space-2 $space-3;
  }

  &__team {
    @include focus-visible;

    display: flex;
    flex: 1;
    align-items: center;
    gap: $space-2;
    min-width: 0;
    min-height: $touch-target;
    padding: 0 $space-2;
    border: 0;
    border-radius: $radius-lg;
    background: transparent;
    color: inherit;
    text-align: left;
  }

  &__logo {
    flex: none;
    width: 36px;
    height: 36px;
    object-fit: contain;
  }

  &__text {
    display: flex;
    flex-direction: column;
    min-width: 0;
    line-height: 1.1;
  }

  &__name {
    @include truncate;

    font-family: var(--font-display);
    font-size: $font-2xl;
    font-weight: 800;
    transition: font-size var(--duration-medium) var(--ease-out);
  }

  &--compact &__name {
    font-size: $font-xl;
  }

  &__club {
    @include truncate;

    color: var(--color-text-muted);
    font-size: $font-xs;
    font-weight: 700;
  }

  &--compact &__club {
    display: none;
  }

  &__chevron {
    color: var(--color-text-muted);
  }

  &__profile {
    @include focus-visible;

    display: grid;
    flex-shrink: 0;
    place-items: center;
    width: $touch-target;
    height: $touch-target;
    border-radius: 50%;
    background: var(--color-surface);
    color: var(--color-text);
    text-decoration: none;
  }
}
</style>
