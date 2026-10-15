<script setup lang="ts">
/**
 * Rondo mark: the rondo drill seen from above (four players on a chalk circle, two in the
 * middle) next to the wordmark. Decorative when the wordmark is shown as text.
 */
withDefaults(defineProps<{ size?: number; wordmark?: boolean }>(), { size: 40, wordmark: true })
</script>

<template>
  <span class="rondo-logo">
    <svg
      class="rondo-logo__mark"
      :width="size"
      :height="size"
      viewBox="0 0 48 48"
      :aria-hidden="wordmark ? 'true' : undefined"
      :role="wordmark ? undefined : 'img'"
      :aria-label="wordmark ? undefined : 'Rondo'"
    >
      <circle
        cx="24"
        cy="24"
        r="16"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-dasharray="4 4"
        opacity="0.55"
      />
      <circle cx="24" cy="8" r="4.5" fill="currentColor" />
      <circle cx="40" cy="24" r="4.5" fill="currentColor" />
      <circle cx="24" cy="40" r="4.5" fill="currentColor" />
      <circle cx="8" cy="24" r="4.5" fill="currentColor" />
      <circle cx="20.5" cy="22" r="3.5" class="rondo-logo__chaser" />
      <circle cx="28" cy="27" r="3.5" class="rondo-logo__chaser" />
    </svg>
    <span v-if="wordmark" class="rondo-logo__word">Rondo</span>
  </span>
</template>

<style scoped lang="scss">
.rondo-logo {
  display: inline-flex;
  align-items: center;
  gap: $space-2;
  color: var(--color-text);

  &__chaser {
    fill: var(--color-primary);
  }

  &__word {
    font-family: var(--font-display);
    font-size: $font-3xl;
    font-weight: 800;
    letter-spacing: 0.01em;
    line-height: 1;
  }
}
</style>
