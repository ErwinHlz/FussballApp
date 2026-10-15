<script setup lang="ts">
import { useId } from 'vue'

/** Page section with a display heading, optional count and an action on the right. */
defineProps<{ title: string; count?: number }>()
const id = useId()
</script>

<template>
  <section class="ui-section" :aria-labelledby="id">
    <header class="ui-section__head">
      <h2 :id="id" class="ui-section__title">
        {{ title }}
        <span v-if="count !== undefined" class="ui-section__count">{{ count }}</span>
      </h2>
      <slot name="action" />
    </header>
    <slot />
  </section>
</template>

<style scoped lang="scss">
.ui-section {
  display: flex;
  flex-direction: column;
  gap: $space-3;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $space-3;
  }

  &__title {
    display: flex;
    align-items: baseline;
    gap: $space-2;
    font-size: $font-2xl;
  }

  &__count {
    color: var(--color-text-muted);
    font-size: $font-lg;
  }
}
</style>
