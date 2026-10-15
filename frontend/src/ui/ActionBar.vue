<script setup lang="ts">
/**
 * Bar fixed to the bottom (above the tab bar, if shown) for a screen's main action, e.g.
 * "Veröffentlichen" or the answer buttons. A spacer keeps page content clear of it.
 */
defineProps<{ label?: string }>()
</script>

<template>
  <div class="action-bar-spacer" aria-hidden="true" />
  <div class="action-bar" role="region" :aria-label="label">
    <div class="action-bar__inner"><slot /></div>
  </div>
</template>

<style scoped lang="scss">
.action-bar-spacer {
  height: 96px;
}

.action-bar {
  position: fixed;
  inset-inline: 0;
  bottom: var(--nav-offset, 0px);
  z-index: 45;
  border-top: 1px solid var(--color-border);
  background: var(--color-bar);

  &__inner {
    @include safe-area-padding(bottom, $space-3);

    display: flex;
    align-items: center;
    gap: $space-3;
    max-width: 720px;
    margin: 0 auto;
    padding-top: $space-3;
    padding-inline: $space-4;
  }
}
</style>
