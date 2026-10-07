<script setup lang="ts">
withDefaults(
  defineProps<{
    as?: string
    padding?: 'none' | 'sm' | 'md'
    accent?: string
  }>(),
  { as: 'div', padding: 'md', accent: undefined },
)
</script>

<template>
  <component
    :is="as"
    class="base-card"
    :class="[`base-card--pad-${padding}`, { 'base-card--accent': !!accent }]"
    :style="accent ? { '--card-accent': accent } : undefined"
  >
    <slot />
  </component>
</template>

<style scoped lang="scss">
.base-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: $radius-lg;
  box-shadow: var(--shadow-sm);

  &--pad-sm {
    padding: $space-3;
  }

  &--pad-md {
    padding: $space-4;
  }

  &--accent {
    border-left: 6px solid var(--card-accent);
  }
}
</style>
