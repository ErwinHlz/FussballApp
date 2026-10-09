<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { addDays } from 'date-fns'
import BaseButton from '@/components/BaseButton.vue'
import BaseChipGroup from '@/components/BaseChipGroup.vue'
import BaseInput from '@/components/BaseInput.vue'
import { formatDate } from '@/lib/date'
import { scheduleErrorHint } from '../api'
import { useCreateSlots } from '../composables/useSchedule'
import { defaultSeason } from '../logic'
import { slotSchema } from '../schemas'

const props = defineProps<{ clubId: string; pitchId: string }>()
const emit = defineEmits<{ saved: [] }>()

const { t, locale } = useI18n()
const createSlots = useCreateSlots(() => props.clubId)
const season = defaultSeason()

const { defineField, errors, handleSubmit } = useForm({
  validationSchema: toTypedSchema(slotSchema),
  initialValues: {
    weekdays: [] as string[],
    startTime: '17:00',
    endTime: '18:30',
    validFrom: season.from,
    validUntil: season.until,
  },
})
const [weekdays] = defineField('weekdays')
const [startTime] = defineField('startTime')
const [endTime] = defineField('endTime')
const [validFrom] = defineField('validFrom')
const [validUntil] = defineField('validUntil')

const weekdayOptions = computed(() =>
  [1, 2, 3, 4, 5, 6, 0].map((d) => ({
    value: String(d),
    // 2030-01-06 is a Sunday: add d days to get the weekday name.
    label: formatDate(addDays(new Date(2030, 0, 6), d), locale.value, 'EEEEEE'),
  })),
)

const err = (key: keyof typeof errors.value) => {
  const message = errors.value[key]
  return message ? t(message) : undefined
}

const saveError = computed(() => {
  if (!createSlots.isError.value) return null
  return scheduleErrorHint(createSlots.error.value) === 'slot_overlap'
    ? t('schedule.errors.overlap')
    : t('schedule.errors.saveFailed')
})

const onSubmit = handleSubmit(async (values) => {
  await createSlots.mutateAsync({
    clubId: props.clubId,
    pitchId: props.pitchId,
    weekdays: values.weekdays.map(Number),
    startTime: values.startTime,
    endTime: values.endTime,
    validFrom: values.validFrom,
    validUntil: values.validUntil,
  })
  emit('saved')
})
</script>

<template>
  <form class="slot-form" novalidate @submit="onSubmit">
    <BaseChipGroup
      v-model="weekdays"
      :label="t('events.form.weekdays')"
      :options="weekdayOptions"
      :columns="7"
      multiple
    />
    <p v-if="err('weekdays')" class="slot-form__error" role="alert">{{ err('weekdays') }}</p>
    <div class="slot-form__row">
      <BaseInput
        v-model="startTime"
        :label="t('schedule.from')"
        type="time"
        required
        :error="err('startTime')"
      />
      <BaseInput
        v-model="endTime"
        :label="t('schedule.until')"
        type="time"
        required
        :error="err('endTime')"
      />
    </div>
    <div class="slot-form__row">
      <BaseInput
        v-model="validFrom"
        :label="t('schedule.seasonFrom')"
        type="date"
        required
        :error="err('validFrom')"
      />
      <BaseInput
        v-model="validUntil"
        :label="t('schedule.seasonUntil')"
        type="date"
        required
        :error="err('validUntil')"
      />
    </div>
    <p v-if="saveError" class="slot-form__error" role="alert">{{ saveError }}</p>
    <BaseButton type="submit" block :loading="createSlots.isPending.value">
      {{ t('schedule.addSlot') }}
    </BaseButton>
  </form>
</template>

<style scoped lang="scss">
.slot-form {
  display: flex;
  flex-direction: column;
  gap: $space-3;

  &__row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: $space-2;
  }

  &__error {
    color: var(--color-danger);
  }
}
</style>
