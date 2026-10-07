<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
    size?: 'md' | 'lg'
    type?: 'button' | 'submit' | 'reset'
    block?: boolean
    loading?: boolean
    disabled?: boolean
  }>(),
  {
    variant: 'primary',
    size: 'md',
    type: 'button',
    block: false,
    loading: false,
    disabled: false,
  },
)
</script>

<template>
  <button
    :type="type"
    class="base-button"
    :class="[
      `base-button--${variant}`,
      `base-button--${size}`,
      { 'base-button--block': block, 'base-button--loading': loading },
    ]"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
  >
    <span v-if="loading" class="base-button__spinner" aria-hidden="true" />
    <slot name="icon" />
    <span class="base-button__label"><slot /></span>
  </button>
</template>

<style scoped lang="scss">
.base-button {
  @include touch-target;
  @include focus-visible;

  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: $space-2;
  padding: $space-2 $space-4;
  border: 2px solid transparent;
  border-radius: $radius-md;
  font-weight: 600;
  font-size: $font-md;
  line-height: 1.2;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    transform 0.1s ease;

  &:active:not(:disabled) {
    transform: scale(0.98);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  &--lg {
    min-height: 52px;
    padding: $space-3 $space-5;
    font-size: $font-lg;
  }

  &--block {
    display: flex;
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
    background: var(--color-surface);
    border-color: var(--color-border);
    color: var(--color-text);

    &:hover:not(:disabled) {
      border-color: var(--color-primary);
    }
  }

  &--ghost {
    background: transparent;
    color: var(--color-primary);

    &:hover:not(:disabled) {
      background: var(--color-surface-muted);
    }
  }

  &--danger {
    background: var(--color-danger);
    color: var(--color-danger-contrast);
  }

  &__spinner {
    width: 1em;
    height: 1em;
    border: 2px solid currentcolor;
    border-right-color: transparent;
    border-radius: $radius-full;
    animation: base-button-spin 0.7s linear infinite;
  }
}

@keyframes base-button-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
