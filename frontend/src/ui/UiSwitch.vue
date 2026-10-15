<script setup lang="ts">
import { useId } from 'vue'

defineProps<{ label: string; description?: string; disabled?: boolean }>()
const model = defineModel<boolean>({ default: false })
const id = useId()
</script>

<template>
  <div class="ui-switch">
    <span class="ui-switch__text">
      <span :id="`${id}-label`" class="ui-switch__label">{{ label }}</span>
      <span v-if="description" :id="`${id}-desc`" class="ui-switch__description">
        {{ description }}
      </span>
    </span>
    <button
      type="button"
      role="switch"
      class="ui-switch__control"
      :aria-checked="model"
      :aria-labelledby="`${id}-label`"
      :aria-describedby="description ? `${id}-desc` : undefined"
      :disabled="disabled"
      @click="model = !model"
    >
      <span class="ui-switch__thumb" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped lang="scss">
.ui-switch {
  display: flex;
  align-items: center;
  gap: $space-3;
  min-height: $touch-target;

  &__text {
    display: flex;
    flex: 1;
    flex-direction: column;
  }

  &__label {
    font-weight: 700;
  }

  &__description {
    color: var(--color-text-muted);
    font-size: $font-sm;
  }

  &__control {
    @include focus-visible;

    position: relative;
    flex-shrink: 0;
    width: 56px;
    height: 34px;
    padding: 0;
    border: 2px solid var(--color-border);
    border-radius: $radius-full;
    background: var(--color-surface-muted);
    transition: background-color var(--duration-medium) var(--ease-out);

    &[aria-checked='true'] {
      border-color: var(--color-primary);
      background: var(--color-primary);
    }

    &:disabled {
      opacity: 0.5;
    }
  }

  &__thumb {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--color-text-muted);
    transition: transform var(--duration-medium) var(--ease-out);
  }

  &__control[aria-checked='true'] &__thumb {
    background: var(--color-primary-contrast);
    transform: translateX(22px);
  }
}
</style>
