<script setup lang="ts">
import BottomSheet from '@/ui/BottomSheet.vue'

/**
 * Compatibility wrapper: older views still use BaseModal; it now is the design system's
 * bottom sheet (swipe down, focus trap, focus return). Remove once all views use BottomSheet.
 */
defineProps<{ title: string }>()
const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <BottomSheet v-model:open="open" :title="title">
    <slot />
    <template v-if="$slots.footer" #footer><slot name="footer" /></template>
  </BottomSheet>
</template>
