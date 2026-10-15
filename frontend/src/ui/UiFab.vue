<script setup lang="ts">
import UiIcon, { type UiIconName } from './UiIcon.vue'

/** Floating main action in thumb reach, above the tab bar. */
withDefaults(defineProps<{ label: string; icon?: UiIconName; extended?: boolean }>(), {
  icon: 'plus',
})
defineEmits<{ click: [] }>()
</script>

<template>
  <button
    type="button"
    class="ui-fab"
    :class="{ 'ui-fab--extended': extended }"
    :aria-label="extended ? undefined : label"
    @click="$emit('click')"
  >
    <UiIcon :name="icon" :size="26" :stroke-width="2.6" />
    <span v-if="extended">{{ label }}</span>
  </button>
</template>

<style scoped lang="scss">
.ui-fab {
  @include focus-visible;

  position: fixed;
  right: $space-4;
  bottom: calc(var(--nav-offset, 0px) + #{$space-4} + env(safe-area-inset-bottom, 0px));
  z-index: 46;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: $space-2;
  width: 60px;
  height: 60px;
  border: 0;
  border-radius: 20px;
  background: var(--color-primary);
  color: var(--color-primary-contrast);
  box-shadow: var(--shadow-float);
  font-weight: 800;
  transition: transform var(--duration-fast) var(--ease-out);

  &:active {
    transform: scale(0.95);
  }

  &--extended {
    width: auto;
    padding: 0 $space-5 0 $space-4;
  }
}
</style>
