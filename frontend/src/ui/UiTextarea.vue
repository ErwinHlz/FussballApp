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
  <!-- Look from the global field classes (styles/_fields.scss). -->
  <div class="field">
    <label :for="id" class="field__label">{{ label }}</label>
    <div class="field__box">
      <textarea
        :id="id"
        v-model="model"
        class="field__control"
        :rows="rows"
        :placeholder="placeholder"
        :maxlength="maxlength"
        :aria-invalid="!!error || undefined"
        :aria-describedby="describedBy"
      />
      <fieldset class="field__outline" aria-hidden="true">
        <legend>{{ label }}</legend>
      </fieldset>
    </div>
    <p v-if="error" :id="`${id}-error`" class="field__error" role="alert">{{ error }}</p>
    <p v-else-if="hint" :id="`${id}-hint`" class="field__hint">{{ hint }}</p>
  </div>
</template>
