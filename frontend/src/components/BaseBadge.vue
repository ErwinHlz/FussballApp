<script setup lang="ts">
withDefaults(
  defineProps<{
    tone?: 'neutral' | 'success' | 'danger' | 'warning' | 'info' | 'training' | 'match' | 'event'
  }>(),
  { tone: 'neutral' },
)
</script>

<template>
  <span class="base-badge" :class="`base-badge--${tone}`">
    <slot name="icon" />
    <slot />
  </span>
</template>

<style scoped lang="scss">
.base-badge {
  display: inline-flex;
  align-items: center;
  gap: $space-1;
  padding: 2px $space-2;
  border-radius: $radius-full;
  font-size: $font-xs;
  font-weight: 700;
  line-height: 1.5;
  white-space: nowrap;
  color: var(--badge-text, var(--badge-color));
  background: color-mix(in srgb, var(--badge-color) 14%, transparent);

  &--neutral {
    --badge-color: var(--color-text-muted);
    --badge-text: var(--color-text);
  }

  &--success {
    --badge-color: var(--color-success);
  }

  &--danger {
    --badge-color: var(--color-danger);
  }

  &--warning {
    --badge-color: var(--color-warning);
  }

  &--info,
  &--match {
    --badge-color: var(--color-match);
    --badge-text: var(--color-match-text);
  }

  &--training {
    --badge-color: var(--color-training);
    --badge-text: var(--color-training-text);
  }

  &--event {
    --badge-color: var(--color-event);
    --badge-text: var(--color-event-text);
  }
}
</style>
