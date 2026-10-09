<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import BaseBadge from '@/components/BaseBadge.vue'
import BaseModal from '@/components/BaseModal.vue'
import { useApplyTemplate, useTemplates } from '../composables/useTemplates'

/** Plan editor: picks a template (own or shared in the club) and appends it to the training. */
const props = defineProps<{ teamId: string; eventId: string }>()
const emit = defineEmits<{ applied: [count: number] }>()
const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const templates = useTemplates(() => props.teamId, open)
const apply = useApplyTemplate()

async function applyTemplate(templateId: string) {
  const count = await apply.mutateAsync({ templateId, eventId: props.eventId })
  open.value = false
  emit('applied', count)
}
</script>

<template>
  <BaseModal v-model:open="open" :title="t('templates.pickTitle')">
    <p class="pick__muted">{{ t('templates.pickHint') }}</p>
    <p v-if="templates.isPending.value" class="pick__muted">{{ t('common.loading') }}</p>
    <p v-else-if="!templates.data.value?.length" class="pick__muted">
      {{ t('templates.emptyPick') }}
      <RouterLink :to="{ name: 'templates' }">{{ t('templates.title') }}</RouterLink>
    </p>
    <ul v-else class="pick__list" role="list">
      <li v-for="template in templates.data.value" :key="template.id">
        <button
          type="button"
          class="pick__item"
          :disabled="apply.isPending.value || !template.drill_count"
          @click="applyTemplate(template.id)"
        >
          <span class="pick__title">
            {{ template.title }}
            <BaseBadge v-if="!template.is_own" tone="match">{{ template.team_name }}</BaseBadge>
          </span>
          <span class="pick__muted">
            {{ t('plan.drillCount', template.drill_count) }} ·
            {{ t('plan.minutesShort', { n: template.total_minutes }) }}
          </span>
        </button>
      </li>
    </ul>
    <p v-if="apply.isError.value" class="pick__error" role="alert">
      {{ t('templates.applyFailed') }}
    </p>
  </BaseModal>
</template>

<style scoped lang="scss">
.pick {
  &__list {
    display: flex;
    flex-direction: column;
    margin-top: $space-3;
  }

  &__item {
    @include focus-visible;

    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: $space-1;
    width: 100%;
    min-height: 56px;
    padding: $space-2;
    border: 0;
    border-bottom: 1px solid var(--color-border);
    background: transparent;
    color: var(--color-text);
    text-align: left;

    &:hover:not(:disabled) {
      background: var(--color-surface-muted);
    }

    &:disabled {
      opacity: 0.55;
    }
  }

  &__title {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: $space-2;
    font-weight: 700;
  }

  &__muted {
    font-size: $font-sm;
    color: var(--color-text-muted);
  }

  &__error {
    color: var(--color-danger);
  }
}
</style>
