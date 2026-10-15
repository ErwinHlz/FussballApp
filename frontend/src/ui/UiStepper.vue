<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import UiIcon from './UiIcon.vue'

/** − value + control, e.g. drill minutes. The label names the value for screen readers. */
const props = withDefaults(
  defineProps<{ label: string; min?: number; max?: number; step?: number; unit?: string }>(),
  { min: 0, max: 999, step: 5, unit: '' },
)
const model = defineModel<number>({ required: true })

const { t } = useI18n()
const unitLabel = computed(() => props.unit || t('ui.stepper.units'))

function change(delta: number) {
  model.value = Math.min(props.max, Math.max(props.min, model.value + delta))
}
</script>

<template>
  <div class="ui-stepper" role="group" :aria-label="`${label}: ${model} ${unitLabel}`">
    <button
      type="button"
      class="ui-stepper__button"
      :aria-label="t('ui.stepper.less', { n: step, unit: unitLabel })"
      :disabled="model <= min"
      @click="change(-step)"
    >
      <UiIcon name="minus" :size="20" :stroke-width="2.6" />
    </button>
    <output class="ui-stepper__value" aria-live="polite">{{ model }}</output>
    <button
      type="button"
      class="ui-stepper__button"
      :aria-label="t('ui.stepper.more', { n: step, unit: unitLabel })"
      :disabled="model >= max"
      @click="change(step)"
    >
      <UiIcon name="plus" :size="20" :stroke-width="2.6" />
    </button>
  </div>
</template>

<style scoped lang="scss">
.ui-stepper {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  border: 2px solid var(--color-border);
  border-radius: $radius-full;

  &__button {
    @include focus-visible;

    display: grid;
    place-items: center;
    width: $touch-target;
    height: $touch-target;
    border: 0;
    border-radius: $radius-full;
    background: transparent;
    color: var(--color-text);

    &:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }
  }

  &__value {
    min-width: 2ch;
    font-family: var(--font-display);
    font-size: $font-xl;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    text-align: center;
  }
}
</style>
