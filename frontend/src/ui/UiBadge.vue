<script setup lang="ts">
/** Small label. Tones for event types and answers always come with a text, never color alone. */
withDefaults(
  defineProps<{
    tone?: 'neutral' | 'accent' | 'training' | 'match' | 'event' | 'yes' | 'maybe' | 'no'
  }>(),
  { tone: 'neutral' },
)
</script>

<template>
  <span class="ui-badge" :class="`ui-badge--${tone}`"><slot /></span>
</template>

<style scoped lang="scss">
.ui-badge {
  --badge-text: var(--color-text);
  --badge-bg: var(--color-surface-muted);

  display: inline-flex;
  align-items: center;
  gap: $space-1;
  padding: 2px $space-2;
  border-radius: $radius-full;
  background: var(--badge-bg);
  color: var(--badge-text);
  font-size: $font-xs;
  font-weight: 800;
  letter-spacing: 0.04em;
  line-height: 1.6;
  text-transform: uppercase;
  white-space: nowrap;

  @each $tone in training, match, event, yes, maybe, no {
    &--#{$tone} {
      --badge-text: var(--color-#{$tone}-text);
      --badge-bg: color-mix(in srgb, var(--color-#{$tone}) 14%, transparent);
    }
  }

  &--accent {
    --badge-text: var(--color-primary-contrast);
    --badge-bg: var(--color-primary);
  }
}
</style>
