<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { format } from 'date-fns'
import BaseButton from '@/components/BaseButton.vue'
import BaseChipGroup from '@/components/BaseChipGroup.vue'
import BaseInput from '@/components/BaseInput.vue'
import { DECLINE_REASONS, type DeclineReason } from '@/features/events/logic'
import { absenceRange } from '../logic'
import { useCreateAbsences } from '../composables/useAbsences'

/** Enter an absence for one or more squad entries (own memberships or, as coach, a player). */
const props = defineProps<{ memberIds: string[] }>()
const emit = defineEmits<{ created: [declined: number] }>()

const { t } = useI18n()
const create = useCreateAbsences()

const today = format(new Date(), 'yyyy-MM-dd')
const from = ref(today)
const to = ref(today)
const reason = ref<DeclineReason>('vacation')
const note = ref('')
const declined = ref<number | null>(null)

const range = computed(() => absenceRange(from.value, to.value))
const reasonOptions = computed(() =>
  DECLINE_REASONS.map((r) => ({ value: r, label: t(`events.reasons.${r}`) })),
)
const reasonModel = computed({
  get: () => reason.value,
  set: (v: DeclineReason | DeclineReason[] | undefined) => {
    if (typeof v === 'string') reason.value = v
  },
})

async function submit() {
  if (!range.value || !props.memberIds.length) return
  try {
    declined.value = await create.mutateAsync({
      memberIds: props.memberIds,
      ...range.value,
      reason: reason.value,
      note: note.value.trim() || null,
    })
    emit('created', declined.value)
    note.value = ''
  } catch {
    // Shown via create.isError.
  }
}
</script>

<template>
  <form class="absence-form" novalidate @submit.prevent="submit">
    <div class="absence-form__row">
      <BaseInput v-model="from" :label="t('absences.from')" type="date" required />
      <BaseInput
        v-model="to"
        :label="t('absences.to')"
        type="date"
        required
        :error="range ? undefined : t('validation.dateRange')"
      />
    </div>
    <BaseChipGroup
      v-model="reasonModel"
      :label="t('events.reasonLabel')"
      :options="reasonOptions"
    />
    <BaseInput
      v-model="note"
      :label="t('events.reasonNote')"
      :placeholder="t('absences.notePlaceholder')"
    />
    <p class="absence-form__hint">{{ t('absences.hint') }}</p>
    <p v-if="create.isError.value" class="absence-form__error" role="alert">
      {{ t('absences.failed') }}
    </p>
    <p v-else-if="declined !== null" class="absence-form__done" role="status">
      ✓ {{ t('absences.created', declined) }}
    </p>
    <BaseButton type="submit" block :disabled="!range" :loading="create.isPending.value">
      {{ t('absences.save') }}
    </BaseButton>
  </form>
</template>

<style scoped lang="scss">
.absence-form {
  display: flex;
  flex-direction: column;
  gap: $space-3;

  &__row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: $space-2;
  }

  &__hint {
    font-size: $font-sm;
    color: var(--color-text-muted);
  }

  &__error {
    color: var(--color-danger);
  }

  &__done {
    color: var(--color-success);
    font-weight: 600;
  }
}
</style>
