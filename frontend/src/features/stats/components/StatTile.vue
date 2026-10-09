<script setup lang="ts">
/** Stat tile: label · value · optional comparison line. */
defineProps<{ label: string; value: string; sub?: string }>()
</script>

<template>
  <div class="tile">
    <span class="tile__label">{{ label }}</span>
    <span class="tile__value">{{ value }}</span>
    <span v-if="sub" class="tile__sub">{{ sub }}</span>
  </div>
</template>

<style scoped lang="scss">
.tile {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding: $space-3;
  border: 1px solid var(--color-border);
  border-radius: $radius-lg;
  background: var(--color-surface);

  &__label {
    font-size: $font-xs;
    font-weight: 700;
    color: var(--color-text-muted);
  }

  &__value {
    font-size: $font-xl;
    font-weight: 700;
    color: var(--color-text);
    font-variant-numeric: tabular-nums;
  }

  &__sub {
    font-size: $font-xs;
    color: var(--color-text-muted);
  }
}
</style>
