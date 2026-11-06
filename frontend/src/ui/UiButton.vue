<script setup lang="ts">
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import UiIcon, { type UiIconName } from './UiIcon.vue'

/** Text button (optionally with an icon). The look comes from styles/_buttons.scss. */
const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
    size?: 'sm' | 'md' | 'lg'
    type?: 'button' | 'submit' | 'reset'
    block?: boolean
    loading?: boolean
    disabled?: boolean
    icon?: UiIconName
    /** Renders a router link styled as a button. */
    to?: RouteLocationRaw
  }>(),
  { variant: 'primary', size: 'md', type: 'button', icon: undefined, to: undefined },
)

const isDisabled = computed(() => props.disabled || props.loading)
const classes = computed(() => [
  'ui-button',
  `ui-button--${props.variant}`,
  `ui-button--${props.size}`,
  { 'ui-button--block': props.block },
])
</script>

<template>
  <RouterLink v-if="to" :to="to" :class="classes">
    <UiIcon v-if="icon" :name="icon" :size="20" />
    <slot v-else name="icon" />
    <slot />
  </RouterLink>
  <button
    v-else
    :type="type"
    :class="classes"
    :disabled="isDisabled"
    :aria-busy="loading || undefined"
  >
    <span v-if="loading" class="ui-button__spinner" aria-hidden="true" />
    <UiIcon v-else-if="icon" :name="icon" :size="20" />
    <slot v-else name="icon" />
    <slot />
  </button>
</template>
