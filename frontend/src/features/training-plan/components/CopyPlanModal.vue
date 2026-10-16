<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BottomSheet from '@/ui/BottomSheet.vue'
import { useEventFormat } from '@/features/events/format'
import { useCopyPlan, usePlannedTrainings } from '../composables/usePlan'

const props = defineProps<{ teamId: string; targetEventId: string }>()
const emit = defineEmits<{ copied: [count: number] }>()
const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const fmt = useEventFormat()
const planned = usePlannedTrainings(() => props.teamId, open)
const copyPlan = useCopyPlan()

const sources = computed(() =>
  (planned.data.value ?? []).filter((e) => e.id !== props.targetEventId),
)

async function copyFrom(sourceId: string) {
  const count = await copyPlan.mutateAsync({ sourceId, targetId: props.targetEventId })
  emit('copied', count)
  open.value = false
}
</script>

<template>
  <BottomSheet v-model:open="open" :title="t('plan.copyTitle')">
    <p class="copy__muted">{{ t('plan.copyHint') }}</p>
    <p v-if="planned.isPending.value" class="copy__muted">{{ t('common.loading') }}</p>
    <p v-else-if="!sources.length" class="copy__muted">{{ t('plan.copyNone') }}</p>
    <ul v-else class="copy__list" role="list">
      <li v-for="source in sources" :key="source.id">
        <button
          type="button"
          class="copy__item"
          :disabled="copyPlan.isPending.value"
          @click="copyFrom(source.id)"
        >
          <span class="copy__date">{{ fmt.longDay(source.starts_at) }}</span>
          <span class="copy__muted">
            {{ t('plan.drillCount', source.event_drills[0]?.count ?? 0) }}
          </span>
        </button>
      </li>
    </ul>
    <p v-if="copyPlan.isError.value" class="copy__error" role="alert">{{ t('plan.copyFailed') }}</p>
  </BottomSheet>
</template>

<style scoped lang="scss">
.copy {
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
    text-align: left;

    &:hover {
      background: var(--color-surface-muted);
    }
  }

  &__date {
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
