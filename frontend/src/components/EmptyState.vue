<script setup lang="ts">
import AppIcon, { type IconName } from './AppIcon.vue'

defineProps<{
  icon: IconName
  title: string
  text?: string
}>()
</script>

<template>
  <div class="empty-state">
    <span class="empty-state__icon">
      <AppIcon :name="icon" :size="32" />
    </span>
    <h2 class="empty-state__title">{{ title }}</h2>
    <p v-if="text" class="empty-state__text">{{ text }}</p>
    <div v-if="$slots.default" class="empty-state__actions">
      <slot />
    </div>
  </div>
</template>

<style scoped lang="scss">
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $space-3;
  padding: $space-7 $space-4;
  text-align: center;

  &__icon {
    display: grid;
    place-items: center;
    width: 64px;
    height: 64px;
    border-radius: $radius-full;
    background: var(--color-surface-muted);
    color: var(--color-primary);
  }

  &__title {
    font-size: $font-lg;
  }

  &__text {
    max-width: 32ch;
    color: var(--color-text-muted);
  }

  &__actions {
    margin-top: $space-2;
  }
}
</style>
