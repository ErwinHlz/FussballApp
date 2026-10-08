<script setup lang="ts">
import { computed, useId } from 'vue'

const props = withDefaults(
  defineProps<{
    label: string
    placeholder?: string
    hint?: string
    error?: string
    rows?: number
    maxlength?: number
  }>(),
  { placeholder: undefined, hint: undefined, error: undefined, rows: 4, maxlength: undefined },
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
  <div class="base-textarea" :class="{ 'base-textarea--error': !!error }">
    <label :for="id" class="base-textarea__label">{{ label }}</label>
    <textarea
      :id="id"
      v-model="model"
      class="base-textarea__field"
      :rows="rows"
      :placeholder="placeholder"
      :maxlength="maxlength"
      :aria-invalid="!!error || undefined"
      :aria-describedby="describedBy"
    />
    <p v-if="error" :id="`${id}-error`" class="base-textarea__error" role="alert">{{ error }}</p>
    <p v-else-if="hint" :id="`${id}-hint`" class="base-textarea__hint">{{ hint }}</p>
  </div>
</template>

<style scoped lang="scss">
.base-textarea {
  display: flex;
  flex-direction: column;
  gap: $space-1;

  &__label {
    font-weight: 600;
    font-size: $font-sm;
  }

  &__field {
    padding: $space-2 $space-3;
    border: 2px solid var(--color-border);
    border-radius: $radius-md;
    background: var(--color-surface);
    font-size: $font-md;
    line-height: 1.5;
    resize: vertical;

    &:focus-visible {
      @include focus-ring;

      border-color: var(--color-primary);
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
