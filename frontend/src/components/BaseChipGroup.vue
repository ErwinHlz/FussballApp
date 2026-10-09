<script setup lang="ts" generic="T extends string">
import { useId } from 'vue'

const props = withDefaults(
  defineProps<{
    label: string
    options: { value: T; label: string }[]
    multiple?: boolean
    hideLabel?: boolean
    /** Equal-width chips in one row (e.g. weekdays). */
    columns?: number
  }>(),
  { multiple: false, hideLabel: false, columns: undefined },
)

// Single select: T, multi select: T[].
const model = defineModel<T | T[] | undefined>()

const labelId = useId()

function isSelected(value: T) {
  return Array.isArray(model.value) ? model.value.includes(value) : model.value === value
}

function toggle(value: T) {
  if (!props.multiple) {
    model.value = value
    return
  }
  const current = Array.isArray(model.value) ? model.value : []
  model.value = current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
}
</script>

<template>
  <div class="chip-group">
    <span
      :id="labelId"
      class="chip-group__label"
      :class="{ 'chip-group__label--hidden': hideLabel }"
    >
      {{ label }}
    </span>
    <div
      class="chip-group__chips"
      :class="{ 'chip-group__chips--grid': columns }"
      :style="columns ? { '--columns': columns } : undefined"
      role="group"
      :aria-labelledby="labelId"
    >
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        class="chip-group__chip"
        :class="{ 'chip-group__chip--selected': isSelected(option.value) }"
        :aria-pressed="isSelected(option.value)"
        @click="toggle(option.value)"
      >
        <svg
          v-if="isSelected(option.value)"
          class="chip-group__check"
          viewBox="0 0 24 24"
          width="16"
          height="16"
          aria-hidden="true"
        >
          <path d="M5 12l5 5L20 7" fill="none" stroke="currentColor" stroke-width="3" />
        </svg>
        {{ option.label }}
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.chip-group {
  display: flex;
  flex-direction: column;
  gap: $space-1;

  &__label {
    font-weight: 600;
    font-size: $font-sm;

    &--hidden {
      @include visually-hidden;
    }
  }

  &__chips {
    display: flex;
    flex-wrap: wrap;
    gap: $space-2;

    &--grid {
      display: grid;
      grid-template-columns: repeat(var(--columns), minmax(0, 1fr));
      gap: $space-1;
    }
  }

  &__chips--grid &__chip {
    justify-content: center;
    padding-inline: 0;
  }

  &__chip {
    @include touch-target;
    @include focus-visible;

    display: inline-flex;
    align-items: center;
    gap: $space-1;
    padding: $space-1 $space-3;
    border: 2px solid var(--color-border);
    border-radius: $radius-full;
    background: var(--color-surface);
    font-size: $font-sm;
    font-weight: 600;
    color: var(--color-text);

    &--selected {
      border-color: var(--color-primary);
      background: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface));
      color: var(--color-primary-hover);
    }
  }
}
</style>
