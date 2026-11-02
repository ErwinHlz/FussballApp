<script setup lang="ts">
import { useId } from 'vue'

/**
 * Frame for one or more UiWheel columns side by side (e.g. hours and minutes), with a shared
 * label on the frame and two lines around the middle row, which is the picked one. The look
 * comes from the global field classes.
 */
defineProps<{ label: string }>()

const id = useId()
</script>

<template>
  <!-- Look from the global field classes (styles/_fields.scss). -->
  <div class="field" role="group" :aria-labelledby="`${id}-label`">
    <span :id="`${id}-label`" class="field__label">{{ label }}</span>
    <div class="field__box ui-wheel-picker__frame">
      <slot />
      <fieldset class="field__outline" aria-hidden="true">
        <legend>{{ label }}</legend>
      </fieldset>
    </div>
  </div>
</template>

<style scoped lang="scss">
$row: 40px;

// Two thin lines mark the picked row.
.ui-wheel-picker__frame::before {
  position: absolute;
  top: $row * 2;
  right: $space-2;
  left: $space-2;
  height: $row;
  border-block: 1px solid var(--color-field-line);
  content: '';
  pointer-events: none;
}
</style>
