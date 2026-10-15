<script setup lang="ts">
/** Placeholder shapes while content loads. The loading region itself carries aria-busy. */
withDefaults(defineProps<{ lines?: number; height?: string; shape?: 'text' | 'block' }>(), {
  lines: 1,
  height: '72px',
  shape: 'text',
})
</script>

<template>
  <span class="ui-skeleton" aria-hidden="true">
    <template v-if="shape === 'block'">
      <span class="ui-skeleton__block" :style="{ height }" />
    </template>
    <template v-else>
      <span v-for="n in lines" :key="n" class="ui-skeleton__line" />
    </template>
  </span>
</template>

<style scoped lang="scss">
.ui-skeleton {
  display: flex;
  flex-direction: column;
  gap: $space-2;

  &__line,
  &__block {
    display: block;
    border-radius: $radius-md;
    background: linear-gradient(
      90deg,
      var(--color-surface-muted) 0%,
      var(--color-surface) 50%,
      var(--color-surface-muted) 100%
    );
    background-size: 200% 100%;
    animation: ui-skeleton-shine 1.4s ease-in-out infinite;
  }

  &__line {
    height: 14px;

    &:last-child:not(:first-child) {
      width: 60%;
    }
  }

  &__block {
    border-radius: $radius-lg;
  }
}

@keyframes ui-skeleton-shine {
  from {
    background-position: 100% 0;
  }

  to {
    background-position: -100% 0;
  }
}
</style>
