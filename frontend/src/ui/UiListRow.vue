<script setup lang="ts">
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import UiIcon from './UiIcon.vue'

/**
 * One row of a list: leading visual, title with subtitle, trailing content. A row with `to`
 * is a link, with `button` a button, otherwise plain content (then put controls in trailing).
 */
const props = defineProps<{
  title: string
  subtitle?: string
  to?: RouteLocationRaw
  button?: boolean
  chevron?: boolean
}>()
defineEmits<{ click: [] }>()

const tag = computed(() => (props.to ? 'RouterLink' : props.button ? 'button' : 'div'))
</script>

<template>
  <component
    :is="tag"
    class="ui-list-row"
    :class="{ 'ui-list-row--interactive': to || button }"
    :to="to"
    :type="button ? 'button' : undefined"
    @click="button && $emit('click')"
  >
    <span v-if="$slots.leading" class="ui-list-row__leading"><slot name="leading" /></span>
    <span class="ui-list-row__text">
      <span class="ui-list-row__title">{{ title }}</span>
      <span v-if="subtitle || $slots.subtitle" class="ui-list-row__subtitle">
        <slot name="subtitle">{{ subtitle }}</slot>
      </span>
    </span>
    <span v-if="$slots.trailing" class="ui-list-row__trailing"><slot name="trailing" /></span>
    <UiIcon v-if="chevron" name="chevronRight" :size="20" class="ui-list-row__chevron" />
  </component>
</template>

<style scoped lang="scss">
.ui-list-row {
  display: flex;
  align-items: center;
  gap: $space-3;
  width: 100%;
  min-height: 64px;
  padding: $space-3 $space-4;
  border: 0;
  border-radius: $radius-lg;
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  text-align: left;
  text-decoration: none;

  &--interactive {
    @include focus-visible;

    cursor: pointer;
    transition: transform var(--duration-fast) var(--ease-out);

    &:active {
      transform: scale(0.99);
    }
  }

  &__leading,
  &__trailing {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: $space-2;
  }

  &__text {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }

  &__title {
    @include truncate;

    font-weight: 700;
  }

  &__subtitle {
    color: var(--color-text-muted);
    font-size: $font-sm;
  }

  &__chevron {
    color: var(--color-text-muted);
  }
}
</style>
