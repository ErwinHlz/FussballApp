<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <main class="not-found">
    <h1>{{ t('common.notFound') }}</h1>
    <RouterLink to="/" class="not-found__link">{{ t('common.backHome') }}</RouterLink>
  </main>
</template>

<style scoped lang="scss">
.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: $space-4;
  min-height: 100dvh;
  padding: $space-4;
  text-align: center;

  &__link {
    @include focus-visible;

    display: inline-flex;
    align-items: center;
    min-height: $touch-target;
    font-weight: 600;
  }
}
</style>
