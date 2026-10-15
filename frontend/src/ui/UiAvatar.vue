<script setup lang="ts">
import { computed } from 'vue'

/** Shirt number or initial in a circle. Decorative unless a label is given. */
const props = withDefaults(
  defineProps<{ name: string; number?: number | null; size?: number; label?: string }>(),
  { number: null, size: 40, label: undefined },
)

const text = computed(() =>
  props.number !== null ? String(props.number) : (props.name.trim()[0] ?? '?').toUpperCase(),
)
</script>

<template>
  <span
    class="ui-avatar"
    :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.45)}px` }"
    :role="label ? 'img' : undefined"
    :aria-label="label"
    :aria-hidden="label ? undefined : 'true'"
  >
    {{ text }}
  </span>
</template>

<style scoped lang="scss">
.ui-avatar {
  display: inline-grid;
  flex-shrink: 0;
  place-items: center;
  border-radius: 50%;
  background: var(--color-pitch);
  color: #ffffff;
  font-family: var(--font-display);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
</style>
