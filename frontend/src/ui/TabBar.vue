<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import UiIcon, { type UiIconName } from './UiIcon.vue'

export type Tab = { key: string; to: RouteLocationRaw; icon: UiIconName; label: string }

/**
 * Floating bottom navigation; the active tab sits on an accent pill. `hidden` slides it out
 * of view (while scrolling down); keyboard focus brings it back.
 */
defineProps<{ tabs: Tab[]; active: string | null; label: string; hidden?: boolean }>()
</script>

<template>
  <nav class="tab-bar" :class="{ 'tab-bar--hidden': hidden }" :aria-label="label">
    <ul class="tab-bar__list" role="list">
      <li v-for="tab in tabs" :key="tab.key">
        <RouterLink
          :to="tab.to"
          class="tab-bar__link"
          :class="{ 'tab-bar__link--active': active === tab.key }"
          :aria-current="active === tab.key ? 'page' : undefined"
        >
          <UiIcon :name="tab.icon" :size="22" />
          <span class="tab-bar__label">{{ tab.label }}</span>
        </RouterLink>
      </li>
    </ul>
  </nav>
</template>

<style scoped lang="scss">
.tab-bar {
  position: fixed;
  inset-inline: $space-3;
  bottom: calc(#{$space-3} + env(safe-area-inset-bottom, 0px));
  z-index: 50;
  max-width: 560px;
  margin: 0 auto;
  border-radius: 26px;
  background: var(--color-nav);
  box-shadow: var(--shadow-float);
  transition:
    transform var(--duration-medium) var(--ease-out),
    opacity var(--duration-medium) var(--ease-out);

  &--hidden:not(:focus-within) {
    transform: translateY(calc(100% + #{$space-3} + env(safe-area-inset-bottom, 0px)));
    pointer-events: none;
  }

  // Without motion: fade instead of sliding.
  @media (prefers-reduced-motion: reduce) {
    transition: opacity var(--duration-medium) linear;

    &--hidden:not(:focus-within) {
      transform: none;
      opacity: 0;
    }
  }

  &__list {
    display: grid;
    grid-auto-columns: minmax(0, 1fr);
    grid-auto-flow: column;
    gap: 4px;
    height: 64px;
    margin: 0;
    padding: 6px;
  }

  &__link {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    height: 100%;
    border-radius: 20px;
    color: var(--color-nav-text);
    font-size: $font-xs;
    font-weight: 700;
    text-decoration: none;
    transition: background-color var(--duration-medium) var(--ease-out);

    &:focus-visible {
      outline: 3px solid var(--color-nav-active);
      outline-offset: 2px;
    }

    &--active {
      background: var(--color-nav-active);
      color: var(--color-nav-active-text);
    }
  }

  &__label {
    @include truncate;

    max-width: 100%;
  }
}
</style>
