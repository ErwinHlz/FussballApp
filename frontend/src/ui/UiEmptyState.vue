<script setup lang="ts">
import UiIcon, { type UiIconName } from './UiIcon.vue'

/** Empty list or first-use hint: one chalk icon, one sentence, at most one action. */
defineProps<{ icon: UiIconName; title: string; text?: string }>()
</script>

<template>
  <div class="ui-empty">
    <span class="ui-empty__icon" aria-hidden="true"><UiIcon :name="icon" :size="32" /></span>
    <p class="ui-empty__title">{{ title }}</p>
    <p v-if="text" class="ui-empty__text">{{ text }}</p>
    <div v-if="$slots.default" class="ui-empty__action"><slot /></div>
  </div>
</template>

<style scoped lang="scss">
.ui-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $space-2;
  padding: $space-6 $space-4;
  border: 2px dashed var(--color-chalk);
  border-radius: 24px;
  text-align: center;

  &__icon {
    display: grid;
    place-items: center;
    width: 64px;
    height: 64px;
    margin-bottom: $space-2;
    border: 2px dashed var(--color-chalk);
    border-radius: 50%;
    color: var(--color-text-muted);
  }

  &__title {
    font-family: var(--font-display);
    font-size: $font-xl;
    font-weight: 800;
  }

  &__text {
    max-width: 32ch;
    color: var(--color-text-muted);
  }

  &__action {
    margin-top: $space-3;
  }
}
</style>
