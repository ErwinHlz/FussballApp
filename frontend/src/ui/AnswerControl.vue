<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import UiIcon, { type UiIconName } from './UiIcon.vue'

export type Answer = 'yes' | 'maybe' | 'no'

/**
 * Attendance answer in the "Taktiktafel" look. Hero: one big "I'm in" button with "Maybe" and
 * "Decline" below. Compact: three 44px icon buttons for list rows. The parent saves the answer
 * (and asks for a decline reason); this control only reports the tap.
 */
const props = withDefaults(
  defineProps<{
    status: Answer | null
    variant?: 'hero' | 'compact'
    disabled?: boolean
    /** Accessible name of the group, e.g. "Bist du dabei? Training 16.10." */
    label?: string
  }>(),
  { variant: 'hero', label: undefined },
)
const emit = defineEmits<{ answer: [Answer] }>()

const { t } = useI18n()
const icons: Record<Answer, UiIconName> = { yes: 'check', maybe: 'maybe', no: 'x' }
const groupLabel = computed(() => props.label ?? t('ui.answer.question'))
const yesLabel = computed(() =>
  props.status === 'yes' ? t('ui.answer.yesDone') : t('ui.answer.yes'),
)
</script>

<template>
  <div v-if="variant === 'hero'" class="answer answer--hero" role="group" :aria-label="groupLabel">
    <button
      type="button"
      class="answer__main"
      :class="{
        'answer__main--on': status === 'yes',
        'answer__main--off': status && status !== 'yes',
      }"
      :aria-pressed="status === 'yes'"
      :disabled="disabled"
      @click="emit('answer', 'yes')"
    >
      <UiIcon name="check" :size="24" :stroke-width="2.8" />
      {{ yesLabel }}
    </button>
    <div class="answer__row">
      <button
        v-for="option in ['maybe', 'no'] as const"
        :key="option"
        type="button"
        class="answer__side"
        :class="{ [`answer__side--${option}`]: status === option }"
        :aria-pressed="status === option"
        :disabled="disabled"
        @click="emit('answer', option)"
      >
        <UiIcon :name="icons[option]" :size="18" :stroke-width="2.6" />
        {{ t(`ui.answer.${option}`) }}
      </button>
    </div>
  </div>

  <div v-else class="answer answer--compact" role="group" :aria-label="groupLabel">
    <button
      v-for="option in ['yes', 'maybe', 'no'] as const"
      :key="option"
      type="button"
      class="answer__icon"
      :class="{ [`answer__icon--${option}`]: status === option }"
      :aria-label="t(`ui.answer.short.${option}`)"
      :aria-pressed="status === option"
      :disabled="disabled"
      @click="emit('answer', option)"
    >
      <UiIcon :name="icons[option]" :size="20" :stroke-width="2.6" />
    </button>
  </div>
</template>

<style scoped lang="scss">
.answer {
  // Zero specificity for the shared button base, so the BEM modifiers below win by order.
  :where(button) {
    @include focus-visible;

    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: $space-2;
    border: 2px solid var(--color-border);
    background: transparent;
    color: var(--color-text);
    font-family: var(--font-sans);
    font-weight: 800;
    transition:
      background-color var(--duration-fast) var(--ease-out),
      transform var(--duration-fast) var(--ease-out);

    &:active:not(:disabled) {
      transform: scale(0.97);
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }
  }

  &--hero {
    display: flex;
    flex-direction: column;
    gap: $space-2;
  }

  &__main {
    min-height: 60px;
    border-color: var(--color-primary);
    border-radius: $radius-xl;
    background: var(--color-primary);
    color: var(--color-primary-contrast);
    font-size: $font-lg;

    // Answered "yes": a calm confirmation instead of a call to action.
    &--on {
      border-color: var(--color-yes);
      background: var(--color-yes);
      color: #ffffff;
    }

    // Answered something else: the button steps back but stays one tap away.
    &--off {
      border-color: var(--color-border);
      background: transparent;
      color: var(--color-text);
    }
  }

  &__row {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: $space-2;
  }

  &__side {
    min-height: 48px;
    border-radius: $radius-lg;
    font-size: $font-md;
  }

  &--compact {
    display: flex;
    gap: 4px;
  }

  &__icon {
    width: $touch-target;
    height: $touch-target;
    padding: 0;
    border-radius: $radius-md;
  }

  @each $answer in yes, maybe, no {
    &__side--#{$answer},
    &__icon--#{$answer} {
      border-color: var(--color-#{$answer});
      background: var(--color-#{$answer});
      color: #ffffff;
    }
  }
}
</style>
