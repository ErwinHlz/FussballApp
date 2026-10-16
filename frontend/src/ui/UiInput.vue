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
  }>(),
  {
    type: 'text',
    placeholder: undefined,
    hint: undefined,
    error: undefined,
    autocomplete: undefined,
    inputmode: undefined,
  },
)

const model = defineModel<string>({ default: '' })

const { t } = useI18n()
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
  <div class="ui-input" :class="{ 'ui-input--error': !!error }">
    <!-- The required mark sits next to the label, so the field's name stays exactly the label. -->
    <span class="ui-input__label-row" :class="{ 'visually-hidden': hideLabel }">
      <label :for="id" class="ui-input__label">{{ label }}</label>
      <span v-if="required" class="ui-input__required" aria-hidden="true">*</span>
    </span>
    <div class="ui-input__box">
      <input
        :id="id"
        v-model="model"
        class="ui-input__field"
        :class="{ 'ui-input__field--reveal': type === 'password' }"
        :type="inputType"
        :placeholder="placeholder"
        :required="required"
        :disabled="disabled"
        :autocomplete="autocomplete"
        :inputmode="inputmode"
        :aria-invalid="!!error || undefined"
        :aria-describedby="describedBy"
      />
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
    </div>
    <p v-if="error" :id="`${id}-error`" class="ui-input__error" role="alert">
      <UiIcon name="alert" :size="16" />{{ error }}
    </p>
    <p v-else-if="hint" :id="`${id}-hint`" class="ui-input__hint">{{ hint }}</p>
  </div>
</template>

<style scoped lang="scss">
.ui-input {
  display: flex;
  flex-direction: column;
  gap: $space-1;

  &__label-row {
    display: flex;
    gap: 4px;
  }

  &__label,
  &__required {
    font-size: $font-sm;
    font-weight: 700;
  }

  &__box {
    position: relative;
    display: flex;
  }

  &__field {
    width: 100%;
    min-height: 52px;
    padding: 0 $space-4;
    border: 2px solid var(--color-border);
    border-radius: $radius-lg;
    background: var(--color-surface);
    color: var(--color-text);
    font-size: $font-md;
    transition: border-color var(--duration-fast) var(--ease-out);

    &::placeholder {
      color: var(--color-text-muted);
    }

    &:focus-visible {
      @include focus-ring;

      border-color: var(--color-primary);
    }

    &--reveal {
      padding-right: 52px;
    }
  }

  &__reveal {
    @include focus-visible;

    position: absolute;
    top: 50%;
    right: 4px;
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

  &--error &__field {
    border-color: var(--color-danger);
  }

  &__error {
    display: flex;
    align-items: center;
    gap: $space-1;
    color: var(--color-danger);
    font-size: $font-sm;
    font-weight: 600;
  }

  &__hint {
    color: var(--color-text-muted);
    font-size: $font-sm;
  }
}
</style>
