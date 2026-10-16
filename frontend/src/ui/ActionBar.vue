<script setup lang="ts">
import { onUnmounted, ref, watchEffect } from 'vue'
import { useElementSize } from '@vueuse/core'

/**
 * Bar fixed to the bottom for a screen's main action, e.g. "Veröffentlichen" or the answer
 * buttons. It reaches down behind the floating tab bar and keeps its content above it. A spacer
 * keeps page content clear of it; messages (snackbar) appear above it.
 */
defineProps<{ label?: string }>()

const inner = ref<HTMLElement | null>(null)
const { height } = useElementSize(inner, undefined, { box: 'border-box' })
watchEffect(() => {
  if (height.value)
    document.documentElement.style.setProperty(
      '--action-bar-height',
      `${Math.ceil(height.value)}px`,
    )
})
onUnmounted(() => document.documentElement.style.removeProperty('--action-bar-height'))
</script>

<template>
  <div class="action-bar-spacer" aria-hidden="true" />
  <div class="action-bar" role="region" :aria-label="label">
    <div ref="inner" class="action-bar__inner"><slot /></div>
    <div class="action-bar__under-nav" aria-hidden="true" />
  </div>
</template>

<style scoped lang="scss">
.action-bar-spacer {
  height: 96px;
}

.action-bar {
  position: fixed;
  inset-inline: 0;
  bottom: 0;
  z-index: 45;
  border-top: 1px solid var(--color-border);
  background: var(--color-bar);

  &__inner {
    display: flex;
    align-items: center;
    gap: $space-3;
    max-width: 720px;
    margin: 0 auto;
    padding: $space-3 $space-4;
  }

  // Room for the tab bar (or the home indicator when there is none).
  &__under-nav {
    height: var(--nav-offset, env(safe-area-inset-bottom, 0px));
  }
}
</style>
