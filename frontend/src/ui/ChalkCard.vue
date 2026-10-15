<script setup lang="ts">
/** Card with a dashed chalk frame, used for the one thing that matters most on a screen. */
withDefaults(defineProps<{ tag?: 'section' | 'div' | 'article' }>(), { tag: 'section' })
</script>

<template>
  <component :is="tag" class="chalk-card"><slot /></component>
</template>

<style scoped lang="scss">
.chalk-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: $space-4;
  padding: $space-5 $space-4;
  overflow: hidden;
  border: 2px dashed var(--color-chalk);
  border-radius: 24px;
  background: var(--color-surface);
}
</style>
