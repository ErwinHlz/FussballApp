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
    class="ui-card"
    :class="[`ui-card--pad-${padding}`, { 'ui-card--accent': !!accent }]"
    :style="accent ? { '--card-accent': accent } : undefined"
  >
    <slot />
  </component>
</template>

<style scoped lang="scss">
.ui-card {
  border-radius: $radius-xl;
  background: var(--color-surface);

  &--pad-sm {
    padding: $space-3;
  }

  &--pad-md {
    padding: $space-4;
  }

  &--accent {
    box-shadow: inset 5px 0 0 var(--card-accent);
  }
}
</style>
