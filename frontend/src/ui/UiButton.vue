<script setup lang="ts">
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import UiIcon, { type UiIconName } from './UiIcon.vue'

const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
    size?: 'md' | 'lg'
    type?: 'button' | 'submit' | 'reset'
    block?: boolean
    loading?: boolean
    disabled?: boolean
    icon?: UiIconName
    /** Renders a router link styled as a button. */
    to?: RouteLocationRaw
  }>(),
  { variant: 'primary', size: 'md', type: 'button', icon: undefined, to: undefined },
)

const isDisabled = computed(() => props.disabled || props.loading)
</script>

<template>
  <RouterLink
    v-if="to"
    :to="to"
    class="ui-button"
    :class="[`ui-button--${variant}`, `ui-button--${size}`, { 'ui-button--block': block }]"
  >
    <UiIcon v-if="icon" :name="icon" :size="20" />
    <slot v-else name="icon" />
    <slot />
  </RouterLink>
  <button
    v-else
    :type="type"
    class="ui-button"
    :class="[`ui-button--${variant}`, `ui-button--${size}`, { 'ui-button--block': block }]"
    :disabled="isDisabled"
    :aria-busy="loading || undefined"
  >
    <span v-if="loading" class="ui-button__spinner" aria-hidden="true" />
    <UiIcon v-else-if="icon" :name="icon" :size="20" />
    <slot v-else name="icon" />
    <slot />
  </button>
</template>

<style scoped lang="scss">
.ui-button {
  @include focus-visible;

  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: $space-2;
  min-height: 48px;
  padding: 0 $space-5;
  border: 2px solid transparent;
  border-radius: $radius-lg;
  font-family: var(--font-sans);
  font-size: $font-md;
  font-weight: 800;
  line-height: 1.2;
  text-align: center;
  text-decoration: none;
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);

  &:active:not(:disabled) {
    transform: scale(0.98);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  &--lg {
    min-height: 58px;
    font-size: $font-lg;
    border-radius: $radius-xl;
  }

  &--block {
    width: 100%;
  }

  &--primary {
    background: var(--color-primary);
    color: var(--color-primary-contrast);

    &:hover:not(:disabled) {
      background: var(--color-primary-hover);
    }
  }

  &--secondary {
    border-color: var(--color-border);
    background: transparent;
    color: var(--color-text);

    &:hover:not(:disabled) {
      background: var(--color-surface-muted);
    }
  }

  &--ghost {
    background: transparent;
    color: var(--color-text);

    &:hover:not(:disabled) {
      background: var(--color-surface-muted);
    }
  }

  &--danger {
    background: var(--color-danger);
    color: var(--color-danger-contrast);
  }

  &__spinner {
    width: 18px;
    height: 18px;
    border: 2px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    animation: ui-button-spin 0.8s linear infinite;
  }
}

@keyframes ui-button-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
