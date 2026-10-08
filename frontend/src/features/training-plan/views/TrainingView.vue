<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/AppIcon.vue'
import BaseButton from '@/components/BaseButton.vue'
import BaseCard from '@/components/BaseCard.vue'
import EmptyState from '@/components/EmptyState.vue'

const { t } = useI18n()
</script>

<template>
  <section class="training">
    <h1>{{ t('training.title') }}</h1>

    <BaseCard class="training__library">
      <h2 class="training__subtitle">{{ t('training.libraryTitle') }}</h2>
      <p class="training__muted">{{ t('training.libraryText') }}</p>
      <RouterLink v-slot="{ navigate }" custom :to="{ name: 'drills' }">
        <BaseButton block @click="navigate">
          <template #icon><AppIcon name="whistle" :size="18" /></template>
          {{ t('training.openLibrary') }}
        </BaseButton>
      </RouterLink>
    </BaseCard>

    <EmptyState icon="calendar" :title="t('training.empty')" :text="t('training.plansSoon')" />
  </section>
</template>

<style scoped lang="scss">
.training {
  display: flex;
  flex-direction: column;
  gap: $space-4;

  &__library {
    display: flex;
    flex-direction: column;
    gap: $space-3;
  }

  &__subtitle {
    font-size: $font-lg;
  }

  &__muted {
    color: var(--color-text-muted);
  }
}
</style>
