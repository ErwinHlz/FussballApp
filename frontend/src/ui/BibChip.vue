<script setup lang="ts">
import UiIcon from './UiIcon.vue'

/** Training vest: shirt in the bib color plus its name (color is never the only cue). */
withDefaults(
  defineProps<{
    color: 'red' | 'blue' | 'yellow' | 'green' | 'orange' | 'white'
    label: string
    /** Small context line, e.g. the drill the bib is for. */
    detail?: string
  }>(),
  { detail: undefined },
)
</script>

<template>
  <span class="bib-chip" :style="{ '--bib': `var(--bib-${color})` }">
    <span class="bib-chip__shirt" aria-hidden="true"><UiIcon name="shirt" :size="22" /></span>
    <span class="bib-chip__text">
      <span class="bib-chip__label">{{ label }}</span>
      <span v-if="detail" class="bib-chip__detail">{{ detail }}</span>
    </span>
  </span>
</template>

<style scoped lang="scss">
.bib-chip {
  display: inline-flex;
  align-items: center;
  gap: $space-2;
  padding: 4px $space-3 4px 4px;
  border: 2px solid var(--bib);
  border-radius: $radius-full;
  font-size: $font-sm;
  line-height: 1.2;

  &__shirt {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--color-surface-muted);
    color: var(--bib);

    :deep(path) {
      fill: var(--bib);
      stroke: var(--color-text);
      stroke-width: 1.2;
    }
  }

  &__text {
    display: flex;
    flex-direction: column;
  }

  &__label {
    font-weight: 800;
  }

  &__detail {
    color: var(--color-text-muted);
    font-size: $font-xs;
  }
}
</style>
