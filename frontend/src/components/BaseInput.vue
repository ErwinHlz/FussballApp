<script setup lang="ts">
import { computed, useId } from 'vue'

const props = withDefaults(
  defineProps<{
    label: string
    type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'date' | 'time' | 'search'
    placeholder?: string
    hint?: string
    error?: string
    required?: boolean
    disabled?: boolean
    hideLabel?: boolean
    autocomplete?: string
  }>(),
  {
    type: 'text',
    placeholder: undefined,
    hint: undefined,
    error: undefined,
    required: false,
    disabled: false,
    hideLabel: false,
    autocomplete: undefined,
  },
)

const model = defineModel<string>({ default: '' })

const id = useId()
const describedBy = computed(() => {
  if (props.error) return `${id}-error`
  if (props.hint) return `${id}-hint`
  return undefined
})
</script>

<template>
  <div class="base-input" :class="{ 'base-input--error': !!error }">
    <label :for="id" class="base-input__label" :class="{ 'base-input__label--hidden': hideLabel }">
      {{ label }}<span v-if="required" aria-hidden="true"> *</span>
    </label>
    <input
      :id="id"
      v-model="model"
      class="base-input__field"
      :type="type"
      :placeholder="placeholder"
      :required="required"
      :disabled="disabled"
      :autocomplete="autocomplete"
      :aria-invalid="!!error || undefined"
      :aria-describedby="describedBy"
    />
    <p v-if="error" :id="`${id}-error`" class="base-input__error" role="alert">{{ error }}</p>
    <p v-else-if="hint" :id="`${id}-hint`" class="base-input__hint">{{ hint }}</p>
  </div>
</template>

<style scoped lang="scss">
.base-input {
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

  &__field {
    min-height: $touch-target;
    padding: $space-2 $space-3;
    border: 2px solid var(--color-border);
    border-radius: $radius-md;
    background: var(--color-surface);
    font-size: $font-md; // >= 16px prevents iOS zoom on focus

    &:focus-visible {
      @include focus-ring;

      border-color: var(--color-primary);
    }

    &:disabled {
      background: var(--color-surface-muted);
      cursor: not-allowed;
    }
  }

  &--error &__field {
    border-color: var(--color-danger);
  }

  &__hint {
    font-size: $font-sm;
    color: var(--color-text-muted);
  }

  &__error {
    font-size: $font-sm;
    color: var(--color-danger);
  }
}
</style>
