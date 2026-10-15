<script setup lang="ts">
import UiIcon, { type UiIconName } from './UiIcon.vue'

/** Toggle chip (filters, reasons). The check mark shows the state without relying on color. */
defineProps<{ icon?: UiIconName; disabled?: boolean }>()
const selected = defineModel<boolean>({ default: false })
</script>

<template>
  <button
    type="button"
    class="ui-chip"
    :aria-pressed="selected"
    :disabled="disabled"
    @click="selected = !selected"
  >
    <UiIcon v-if="selected" name="check" :size="18" :stroke-width="2.6" />
    <UiIcon v-else-if="icon" :name="icon" :size="18" />
    <slot />
  </button>
</template>

<style scoped lang="scss">
.ui-chip {
  @include focus-visible;

  display: inline-flex;
  align-items: center;
  gap: $space-1;
  min-height: $touch-target;
  padding: 0 $space-4;
  border: 2px solid var(--color-border);
  border-radius: $radius-full;
  background: transparent;
  color: var(--color-text);
  font-weight: 700;
  font-size: $font-sm;
  transition: background-color var(--duration-fast) var(--ease-out);

  &[aria-pressed='true'] {
    border-color: var(--color-text);
    background: var(--color-text);
    color: var(--color-bg);
  }

  &:disabled {
    opacity: 0.5;
  }
}
</style>
