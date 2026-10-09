<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import BaseModal from '@/components/BaseModal.vue'
import { useEventFormat } from '@/features/events/format'
import { useUpcomingTrainings } from '@/features/training-plan/composables/usePlan'
import { useApplyTemplate } from '../composables/useTemplates'

/** Picks one of the team's upcoming trainings and appends the template to its plan. */
const props = defineProps<{ teamId: string; templateId: string }>()
const emit = defineEmits<{ applied: [eventId: string, count: number] }>()
const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const fmt = useEventFormat()
const trainings = useUpcomingTrainings(() => props.teamId)
const apply = useApplyTemplate()

async function applyTo(eventId: string) {
  const count = await apply.mutateAsync({ templateId: props.templateId, eventId })
  open.value = false
  emit('applied', eventId, count)
}
</script>

<template>
  <BaseModal v-model:open="open" :title="t('templates.applyTitle')">
    <p class="pick__muted">{{ t('templates.applyHint') }}</p>
    <p v-if="trainings.isPending.value" class="pick__muted">{{ t('common.loading') }}</p>
    <p v-else-if="!trainings.data.value?.filter((e) => !e.is_cancelled).length" class="pick__muted">
      {{ t('templates.noTrainings') }}
    </p>
    <ul v-else class="pick__list" role="list">
      <li
        v-for="training in trainings.data.value?.filter((e) => !e.is_cancelled)"
        :key="training.id"
      >
        <button
          type="button"
          class="pick__item"
          :disabled="apply.isPending.value"
          @click="applyTo(training.id)"
        >
          <span class="pick__title">{{ fmt.longDay(training.starts_at) }}</span>
          <span class="pick__muted">
            {{ fmt.timeRange(training) }} ·
            {{ t('plan.drillCount', training.event_drills[0]?.count ?? 0) }}
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
    width: 100%;
    min-height: 56px;
    padding: $space-2;
    border: 0;
    border-bottom: 1px solid var(--color-border);
    background: transparent;
    color: var(--color-text);
    text-align: left;

    &:hover {
      background: var(--color-surface-muted);
    }
  }

  &__title {
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
