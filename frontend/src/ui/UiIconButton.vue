<script setup lang="ts">
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import UiIcon, { type UiIconName } from './UiIcon.vue'

/**
 * Icon-only button in the same design as UiButton (styles/_buttons.scss), square at touch
 * size. The label is required: it is the accessible name. `badge` shows a small count.
 */
const props = withDefaults(
  defineProps<{
    icon: UiIconName
    label: string
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
    to?: RouteLocationRaw
    pressed?: boolean
    disabled?: boolean
    badge?: number | null
  }>(),
  // pressed stays undefined unless set, so plain buttons are not announced as toggles.
  { variant: 'secondary', pressed: undefined, to: undefined, badge: null },
)

const classes = computed(() => ['ui-button', 'ui-button--icon', `ui-button--${props.variant}`])
</script>

<template>
  <RouterLink v-if="to" :to="to" :class="classes" :aria-label="label">
    <slot><UiIcon :name="icon" :size="22" /></slot>
    <span v-if="badge" class="ui-button__badge" aria-hidden="true">{{ badge }}</span>
  </RouterLink>
  <button
    v-else
    type="button"
    :class="classes"
    :aria-label="label"
    :aria-pressed="pressed"
    :disabled="disabled"
  >
    <slot><UiIcon :name="icon" :size="22" /></slot>
    <span v-if="badge" class="ui-button__badge" aria-hidden="true">{{ badge }}</span>
  </button>
</template>
