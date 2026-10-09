<script setup lang="ts">
import type { BibColor } from '@/features/groups/logic'

/** Bib color + group name: color is never the only signal. */
withDefaults(defineProps<{ color: BibColor; name: string; size?: 'md' | 'lg' }>(), {
  size: 'md',
})
</script>

<template>
  <span class="bib" :class="`bib--${size}`" :style="{ '--bib': `var(--bib-${color})` }">
    <span class="bib__dot" aria-hidden="true" />
    <span class="bib__name">{{ name }}</span>
  </span>
</template>

<style scoped lang="scss">
.bib {
  display: inline-flex;
  align-items: center;
  gap: $space-2;
  padding: 2px $space-3 2px 2px;
  border-radius: $radius-full;
  background: color-mix(in srgb, var(--bib) 18%, var(--color-surface));
  font-weight: 800;
  white-space: nowrap;

  &__dot {
    flex-shrink: 0;
    width: 22px;
    height: 22px;
    border: 2px solid rgb(0 0 0 / 25%);
    border-radius: $radius-full;
    background: var(--bib);
  }

  &--lg {
    padding: $space-1 $space-4 $space-1 $space-1;
    font-size: $font-lg;

    .bib__dot {
      width: 36px;
      height: 36px;
    }
  }
}
</style>
