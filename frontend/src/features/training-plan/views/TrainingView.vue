<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import EmptyState from '@/components/EmptyState.vue'

const { t } = useI18n()
</script>

<template>
  <section class="page">
    <h1 class="page__title">{{ t('training.title') }}</h1>
    <EmptyState icon="whistle" :title="t('training.empty')" :text="t('training.emptyHint')" />
  </section>
</template>

<style scoped lang="scss">
.page__title {
  margin-bottom: $space-4;
}
</style>
