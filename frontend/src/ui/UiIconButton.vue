<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import UiIcon, { type UiIconName } from './UiIcon.vue'

/** Round 44px icon button. The label is required: it is the accessible name. */
withDefaults(
  defineProps<{
    icon: UiIconName
    label: string
    variant?: 'surface' | 'ghost' | 'primary'
    to?: RouteLocationRaw
    pressed?: boolean
    disabled?: boolean
  }>(),
  // pressed stays undefined unless set, so plain buttons are not announced as toggles.
  { variant: 'surface', pressed: undefined, to: undefined },
)
</script>

<template>
  <RouterLink
    v-if="to"
    :to="to"
    class="ui-icon-button"
    :class="`ui-icon-button--${variant}`"
    :aria-label="label"
  >
    <slot><UiIcon :name="icon" :size="22" /></slot>
  </RouterLink>
  <button
    v-else
    type="button"
    class="ui-icon-button"
    :class="`ui-icon-button--${variant}`"
    :aria-label="label"
    :aria-pressed="pressed"
    :disabled="disabled"
  >
    <slot><UiIcon :name="icon" :size="22" /></slot>
  </button>
</template>

<style scoped lang="scss">
.ui-icon-button {
  @include focus-visible;

  display: inline-grid;
  flex-shrink: 0;
  place-items: center;
  width: $touch-target;
  height: $touch-target;
  padding: 0;
  border: 0;
  border-radius: 50%;
  color: var(--color-text);
  text-decoration: none;
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-out);

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  &--surface {
    background: var(--color-surface);
  }

  &--ghost {
    background: transparent;

    &:hover:not(:disabled) {
      background: var(--color-surface-muted);
    }
  }

  &--primary {
    background: var(--color-primary);
    color: var(--color-primary-contrast);
  }
}
</style>
