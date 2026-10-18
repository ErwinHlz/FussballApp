<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import UiChipGroup from '@/ui/UiChipGroup.vue'
import UiSegmented from '@/ui/UiSegmented.vue'
import type { Pitch, PitchChoice, PitchPart } from '../logic'

/**
 * Pitch of a training: one of the club's pitches with half A, B or the whole pitch, or (when
 * allowed) another place typed in by hand. A chosen pitch puts the training into the schedule.
 */
const props = defineProps<{ pitches: Pitch[]; allowOther?: boolean }>()
const model = defineModel<PitchChoice>({ required: true })

const { t } = useI18n()
const OTHER = 'other'

const pitchKey = computed({
  get: () => model.value.pitchId ?? OTHER,
  set: (value: string) => {
    const pitch = props.pitches.find((p) => p.id === value)
    model.value = {
      pitchId: pitch?.id ?? null,
      // A pitch that cannot be split is always booked as a whole.
      part: pitch?.splittable ? model.value.part : 'full',
    }
  },
})
const part = computed({
  get: () => model.value.part,
  set: (value: PitchPart) => (model.value = { ...model.value, part: value }),
})

const pitchOptions = computed(() => [
  ...props.pitches.map((p) => ({ value: p.id, label: p.name })),
  ...(props.allowOther ? [{ value: OTHER, label: t('schedule.otherPlace') }] : []),
])
const selected = computed(() => props.pitches.find((p) => p.id === model.value.pitchId) ?? null)
const partOptions = computed(() =>
  (['full', 'a', 'b'] as PitchPart[]).map((value) => ({
    value,
    label: t(`schedule.parts.${value}`),
  })),
)
</script>

<template>
  <div class="pitch-picker">
    <UiChipGroup v-model="pitchKey" :label="t('schedule.pitch')" :options="pitchOptions" />
    <UiSegmented
      v-if="selected?.splittable"
      v-model="part"
      as="radio"
      :label="t('schedule.part')"
      :options="partOptions"
    />
  </div>
</template>

<style scoped lang="scss">
.pitch-picker {
  display: flex;
  flex-direction: column;
  gap: $space-2;
}
</style>
