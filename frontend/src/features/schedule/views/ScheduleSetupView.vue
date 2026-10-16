<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { addDays, parseISO } from 'date-fns'
import UiIcon from '@/ui/UiIcon.vue'
import UiBadge from '@/ui/UiBadge.vue'
import UiButton from '@/ui/UiButton.vue'
import UiCard from '@/ui/UiCard.vue'
import UiInput from '@/ui/UiInput.vue'
import { formatDate } from '@/lib/date'
import SlotForm from '../components/SlotForm.vue'
import {
  useCreatePitch,
  useDeletePitch,
  useDeleteSlot,
  usePitches,
  useSlots,
} from '../composables/useSchedule'
import { timeLabel, type PitchSlot } from '../logic'
import { pitchSchema } from '../schemas'

const props = defineProps<{ clubId: string }>()

const { t, locale } = useI18n()
const pitches = usePitches(() => props.clubId)
const slots = useSlots(() => props.clubId)
const createPitch = useCreatePitch(() => props.clubId)
const deletePitch = useDeletePitch(() => props.clubId)
const deleteSlot = useDeleteSlot(() => props.clubId)

/** Pitch whose slot form is open. */
const addingSlotTo = ref<string | null>(null)
/** Two-step delete: first tap arms, second tap deletes. */
const armed = ref<string | null>(null)

const { defineField, errors, handleSubmit, resetForm } = useForm({
  validationSchema: toTypedSchema(pitchSchema),
  initialValues: { name: '', splittable: true },
})
const [name] = defineField('name')
const [splittable] = defineField('splittable')

const onCreatePitch = handleSubmit(async (values) => {
  await createPitch.mutateAsync({ clubId: props.clubId, ...values })
  resetForm()
})

const slotsByPitch = computed(() => {
  const map = new Map<string, PitchSlot[]>()
  for (const slot of slots.data.value ?? []) {
    map.set(slot.pitch_id, [...(map.get(slot.pitch_id) ?? []), slot])
  }
  // Monday first.
  for (const list of map.values())
    list.sort((a, b) => ((a.weekday + 6) % 7) - ((b.weekday + 6) % 7))
  return map
})

const weekdayName = (weekday: number) =>
  formatDate(addDays(new Date(2030, 0, 6), weekday), locale.value, 'EEEEEE')
const date = (iso: string) => formatDate(parseISO(iso), locale.value, 'P')

function confirmDelete(key: string, action: () => void) {
  if (armed.value === key) {
    armed.value = null
    action()
  } else {
    armed.value = key
  }
}
</script>

<template>
  <section class="setup">
    <header>
      <h1>{{ t('schedule.setup') }}</h1>
      <p class="setup__muted">{{ t('schedule.setupIntro') }}</p>
    </header>

    <p v-if="pitches.isPending.value" class="setup__muted">{{ t('common.loading') }}</p>

    <UiCard v-for="pitch in pitches.data.value" :key="pitch.id" class="setup__pitch">
      <div class="setup__pitch-head">
        <h2 class="setup__pitch-name">{{ pitch.name }}</h2>
        <UiBadge v-if="pitch.splittable" tone="training">{{ t('schedule.splittable') }}</UiBadge>
      </div>

      <ul v-if="slotsByPitch.get(pitch.id)?.length" class="setup__slots" role="list">
        <li v-for="slot in slotsByPitch.get(pitch.id)" :key="slot.id" class="setup__slot">
          <span class="setup__slot-text">
            <strong>{{ weekdayName(slot.weekday) }}</strong>
            {{ timeLabel(slot.start_time) }}–{{ timeLabel(slot.end_time) }}
            <span class="setup__muted">
              {{ date(slot.valid_from) }} – {{ date(slot.valid_until) }}
            </span>
          </span>
          <UiButton
            :variant="armed === slot.id ? 'danger' : 'ghost'"
            :aria-label="armed === slot.id ? undefined : t('schedule.deleteSlot')"
            :loading="deleteSlot.isPending.value && deleteSlot.variables.value === slot.id"
            @click="confirmDelete(slot.id, () => deleteSlot.mutate(slot.id))"
          >
            <template v-if="armed === slot.id">{{ t('schedule.confirmDelete') }}</template>
            <UiIcon v-else name="x" :size="18" />
          </UiButton>
        </li>
      </ul>
      <p v-else class="setup__muted">{{ t('schedule.noSlots') }}</p>
      <p
        v-if="armed === pitch.id || slotsByPitch.get(pitch.id)?.some((s) => s.id === armed)"
        class="setup__warning"
      >
        {{ t('schedule.deleteWarning') }}
      </p>

      <UiButton
        variant="secondary"
        block
        :aria-expanded="addingSlotTo === pitch.id"
        @click="addingSlotTo = addingSlotTo === pitch.id ? null : pitch.id"
      >
        {{ addingSlotTo === pitch.id ? t('common.close') : t('schedule.addSlot') }}
      </UiButton>
      <SlotForm
        v-if="addingSlotTo === pitch.id"
        :club-id="clubId"
        :pitch-id="pitch.id"
        @saved="addingSlotTo = null"
      />

      <UiButton
        :variant="armed === pitch.id ? 'danger' : 'ghost'"
        block
        :loading="deletePitch.isPending.value && deletePitch.variables.value === pitch.id"
        @click="confirmDelete(pitch.id, () => deletePitch.mutate(pitch.id))"
      >
        {{ armed === pitch.id ? t('schedule.confirmDelete') : t('schedule.deletePitch') }}
      </UiButton>
    </UiCard>

    <p
      v-if="deleteSlot.isError.value || deletePitch.isError.value"
      class="setup__error"
      role="alert"
    >
      {{ t('schedule.errors.saveFailed') }}
    </p>

    <UiCard>
      <form class="setup__form" novalidate @submit="onCreatePitch">
        <h2 class="setup__pitch-name">{{ t('schedule.addPitch') }}</h2>
        <UiInput
          v-model="name"
          :label="t('schedule.pitchName')"
          :placeholder="t('schedule.pitchNamePlaceholder')"
          required
          :error="errors.name ? t(errors.name) : undefined"
        />
        <label class="setup__check">
          <input v-model="splittable" type="checkbox" class="setup__box" />
          <span>
            {{ t('schedule.splittableLabel') }}
            <span class="setup__muted">{{ t('schedule.splittableHint') }}</span>
          </span>
        </label>
        <p v-if="createPitch.isError.value" class="setup__error" role="alert">
          {{ t('schedule.errors.saveFailed') }}
        </p>
        <UiButton type="submit" block :loading="createPitch.isPending.value">
          <template #icon><UiIcon name="plus" :size="18" /></template>
          {{ t('schedule.addPitch') }}
        </UiButton>
      </form>
    </UiCard>
  </section>
</template>

<style scoped lang="scss">
.setup {
  display: flex;
  flex-direction: column;
  gap: $space-4;

  &__pitch,
  &__form {
    display: flex;
    flex-direction: column;
    gap: $space-3;
  }

  &__pitch-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $space-2;
  }

  &__pitch-name {
    font-size: $font-lg;
  }

  &__slots {
    display: flex;
    flex-direction: column;
  }

  &__slot {
    display: flex;
    align-items: center;
    gap: $space-2;
    min-height: $touch-target;

    & + & {
      border-top: 1px solid var(--color-border);
    }
  }

  &__slot-text {
    flex: 1;
    min-width: 0;
    font-variant-numeric: tabular-nums;
  }

  &__check {
    display: flex;
    align-items: flex-start;
    gap: $space-3;
  }

  &__box {
    @include focus-visible;

    flex: none;
    width: 22px;
    height: 22px;
    margin-top: 1px;
    accent-color: var(--color-primary);
  }

  &__muted {
    display: block;
    font-size: $font-sm;
    color: var(--color-text-muted);
  }

  &__warning {
    font-size: $font-sm;
    color: var(--color-warning);
    font-weight: 600;
  }

  &__error {
    color: var(--color-danger);
  }
}
</style>
