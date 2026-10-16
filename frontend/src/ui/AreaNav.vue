<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

export type Area = { key: string; to: RouteLocationRaw; label: string }

/**
 * Areas within a tab (e.g. training: sessions, drills, boards, templates) as tabs with an
 * underline, sticky below the top bar. Each area keeps its own address, the back button works
 * as expected. `fill` spreads few areas over the full width, `replace` switches views of the
 * same thing without growing the history.
 */
defineProps<{
  areas: Area[]
  active: string
  label: string
  fill?: boolean
  replace?: boolean
}>()

// Sticky headings further down the page (e.g. week titles) keep clear of the bar.
const HEIGHT = '49px'
onMounted(() => document.documentElement.style.setProperty('--area-nav-height', HEIGHT))
onUnmounted(() => document.documentElement.style.removeProperty('--area-nav-height'))
</script>

<template>
  <nav class="area-nav" :class="{ 'area-nav--fill': fill }" :aria-label="label">
    <div class="area-nav__track">
      <RouterLink
        v-for="area in areas"
        :key="area.key"
        :to="area.to"
        :replace="replace"
        class="area-nav__link"
        :aria-current="active === area.key ? 'page' : undefined"
      >
        {{ area.label }}
      </RouterLink>
    </div>
  </nav>
</template>

<style scoped lang="scss">
.area-nav {
  position: sticky;
  top: var(--top-bar-height, 64px);
  z-index: 35;
  margin-inline: -$space-4;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg);

  // Flush with the top bar when it opens the page.
  &:first-child {
    margin-top: -$space-2;
  }

  &__track {
    display: flex;
    gap: $space-1;
    padding: 0 $space-2;
    overflow-x: auto;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  &__link {
    position: relative;
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    height: 48px;
    padding: 0 $space-3;
    color: var(--color-text-muted);
    font-family: var(--font-display);
    font-size: $font-lg;
    font-weight: 700;
    letter-spacing: 0.02em;
    text-decoration: none;
    text-transform: uppercase;
    white-space: nowrap;
    transition: color var(--duration-fast) var(--ease-out);

    &::after {
      content: '';
      position: absolute;
      inset-inline: $space-2;
      bottom: -1px;
      height: 4px;
      border-radius: 4px 4px 0 0;
      background: var(--color-primary);
      transform: scaleX(0);
      transition: transform var(--duration-medium) var(--ease-out);
    }

    &:hover {
      color: var(--color-text);
    }

    &:focus-visible {
      outline: 3px solid var(--color-focus, var(--color-primary));
      outline-offset: -3px;
      border-radius: $radius-md;
    }

    &[aria-current='page'] {
      color: var(--color-text);
      font-weight: 800;

      &::after {
        transform: scaleX(1);
      }
    }
  }

  &--fill &__link {
    flex: 1 1 0;
    min-width: 0;
  }
}
</style>
