<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import UiIcon from './UiIcon.vue'

const props = withDefaults(
  defineProps<{
    label: string
    type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'date' | 'time' | 'search'
    placeholder?: string
    hint?: string
    error?: string
    required?: boolean
    disabled?: boolean
    autocomplete?: string
    inputmode?: 'text' | 'numeric' | 'email' | 'tel' | 'search' | 'url'
    /** Label only for screen readers (when the context already says what the field is). */
    hideLabel?: boolean
    /** Suggestions the browser offers while typing (free text stays possible). */
    suggestions?: string[]
  }>(),
  {
    type: 'text',
    suggestions: undefined,
    placeholder: undefined,
    hint: undefined,
    error: undefined,
    autocomplete: undefined,
    inputmode: undefined,
  },
)

const model = defineModel<string>({ default: '' })

const { t } = useI18n()
// Always text, also for type="number" (v-model would turn it into a number there, which the
// form schemas reject).
function onInput(event: Event) {
  model.value = (event.target as HTMLInputElement).value
}
const id = useId()
const revealed = ref(false)
const inputType = computed(() =>
  props.type === 'password' && revealed.value ? 'text' : props.type,
)
const describedBy = computed(() => {
  if (props.error) return `${id}-error`
  if (props.hint) return `${id}-hint`
  return undefined
})
</script>

<template>
  <!-- Look from the global field classes (styles/_fields.scss). -->
  <div class="field">
    <!-- The required mark sits next to the label, so the field's name stays exactly the label. -->
    <span class="field__label" :class="{ 'visually-hidden': hideLabel }">
      <label :for="id">{{ label }}</label>
      <span v-if="required" aria-hidden="true">*</span>
    </span>
    <div class="field__box">
      <input
        :id="id"
        :value="model"
        class="field__control"
        :class="{ 'ui-input__field--reveal': type === 'password' }"
        :type="inputType"
        :placeholder="placeholder"
        :required="required"
        :disabled="disabled"
        :autocomplete="autocomplete"
        :inputmode="inputmode"
        :aria-invalid="!!error || undefined"
        :aria-describedby="describedBy"
        :list="suggestions?.length ? `${id}-suggestions` : undefined"
        @input="onInput"
      />
      <datalist v-if="suggestions?.length" :id="`${id}-suggestions`">
        <option v-for="item in suggestions" :key="item" :value="item" />
      </datalist>
      <button
        v-if="type === 'password'"
        type="button"
        class="ui-input__reveal"
        :aria-pressed="revealed"
        :aria-label="t('ui.showPassword')"
        @click="revealed = !revealed"
      >
        <UiIcon :name="revealed ? 'eyeOff' : 'eye'" :size="20" />
      </button>
      <fieldset
        class="field__outline"
        :class="{ 'field__outline--plain': hideLabel }"
        aria-hidden="true"
      >
        <legend v-if="!hideLabel">
          {{ label }}<span v-if="required" class="field__legend-mark">*</span>
        </legend>
      </fieldset>
    </div>
    <p v-if="error" :id="`${id}-error`" class="field__error" role="alert">
      <UiIcon name="alert" :size="16" />{{ error }}
    </p>
    <p v-else-if="hint" :id="`${id}-hint`" class="field__hint">{{ hint }}</p>
  </div>
</template>

<style scoped lang="scss">
.ui-input {
  &__field--reveal {
    padding-right: 52px;
  }

  &__reveal {
    @include focus-visible;

    position: absolute;
    top: 50%;
    right: 4px;
    z-index: 1;
    display: grid;
    place-items: center;
    width: $touch-target;
    height: $touch-target;
    border: 0;
    border-radius: $radius-md;
    background: transparent;
    color: var(--color-text-muted);
    transform: translateY(-50%);
  }
}
</style>
