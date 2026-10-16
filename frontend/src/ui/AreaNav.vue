<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

export type Area = { key: string; to: RouteLocationRaw; label: string }

/**
 * Areas within a tab (e.g. training: sessions, drills, boards, templates) as a swipeable row
 * of links; each area keeps its own address, the back button works as expected.
 */
defineProps<{ areas: Area[]; active: string; label: string }>()
</script>

<template>
  <nav class="area-nav" :aria-label="label">
    <RouterLink
      v-for="area in areas"
      :key="area.key"
      :to="area.to"
      class="area-nav__link"
      :aria-current="active === area.key ? 'page' : undefined"
    >
      {{ area.label }}
    </RouterLink>
  </nav>
</template>

<style scoped lang="scss">
.area-nav {
  display: flex;
  gap: $space-2;
  margin-inline: -$space-4;
  padding: 2px $space-4 $space-1;
  overflow-x: auto;
  scrollbar-width: none;

  &__link {
    @include focus-visible;

    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    min-height: $touch-target;
    padding: 0 $space-4;
    border: 2px solid var(--color-border);
    border-radius: $radius-full;
    color: var(--color-text);
    font-size: $font-sm;
    font-weight: 700;
    text-decoration: none;

    &[aria-current='page'] {
      border-color: var(--color-text);
      background: var(--color-text);
      color: var(--color-bg);
      font-weight: 800;
    }
  }
}
</style>
