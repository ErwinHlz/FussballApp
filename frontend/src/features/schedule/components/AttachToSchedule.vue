<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { format } from 'date-fns'
import BottomSheet from '@/ui/BottomSheet.vue'
import UiButton from '@/ui/UiButton.vue'
import UiIcon from '@/ui/UiIcon.vue'
import UiSwitch from '@/ui/UiSwitch.vue'
import { useSnackbar } from '@/ui/useSnackbar'
import type { EventRow } from '@/features/events/logic'
import { scheduleErrorHint } from '../api'
import { useAttachEvents, usePitches } from '../composables/useSchedule'
import { bookingProblem, pitchFromLocation, type PitchChoice } from '../logic'
import PitchPicker from './PitchPicker.vue'

/**
 * For coaches on a training that is not in the club's schedule yet (created by hand or before
 * the schedule existed): enter it on a pitch, optionally with all upcoming dates of its series.
 */
const props = defineProps<{
  event: Pick<EventRow, 'id' | 'starts_at' | 'ends_at' | 'location' | 'series_id'>
  clubId: string
}>()

const { t } = useI18n()
const snackbar = useSnackbar()
const pitches = usePitches(() => props.clubId)
const clubPitches = computed(() => pitches.data.value ?? [])
const attach = useAttachEvents(() => props.clubId)

const open = ref(false)
const choice = ref<PitchChoice>({ pitchId: null, part: 'full' })
const wholeSeries = ref(true)
const failed = ref<string | null>(null)

watch(open, (isOpen) => {
  if (!isOpen) return
  failed.value = null
  wholeSeries.value = true
  choice.value = pitchFromLocation(clubPitches.value, props.event.location) ?? {
    pitchId: clubPitches.value[0]?.id ?? null,
    part: 'full',
  }
})

/** Times outside Monday to Friday, 15:00–20:30 or not in half hours cannot be entered. */
const problem = computed(() => {
  if (!props.event.ends_at) return 'time' as const
  const start = new Date(props.event.starts_at)
  const minutes = (new Date(props.event.ends_at).getTime() - start.getTime()) / 60000
  return bookingProblem(start.getDay(), format(start, 'HH:mm'), minutes)
})

async function submit() {
  if (!choice.value.pitchId) return
  failed.value = null
  try {
    const result = await attach.mutateAsync({
      eventId: props.event.id,
      pitchId: choice.value.pitchId,
      part: choice.value.part,
      wholeSeries: !!props.event.series_id && wholeSeries.value,
    })
    open.value = false
    snackbar.show({
      text: result.skipped
        ? t('schedule.attach.doneSkipped', { n: result.booked, skipped: result.skipped })
        : t('schedule.attach.done', result.booked),
    })
  } catch (error) {
    failed.value =
      scheduleErrorHint(error) === 'slot_taken'
        ? t('schedule.errors.pitchTaken')
        : t('schedule.errors.bookFailed')
  }
}
</script>

<template>
  <div v-if="clubPitches.length" class="attach">
    <p class="attach__text">
      <UiIcon name="calendar" :size="18" />
      {{ t('schedule.attach.missing') }}
    </p>
    <UiButton variant="secondary" block aria-haspopup="dialog" @click="open = true">
      {{ t('schedule.attach.button') }}
    </UiButton>

    <BottomSheet v-model:open="open" :title="t('schedule.attach.title')">
      <div class="attach__sheet">
        <p v-if="problem" class="attach__error" role="alert">
          {{ t(`schedule.problems.${problem}`) }}
        </p>
        <template v-else>
          <PitchPicker v-model="choice" :pitches="clubPitches" />
          <UiSwitch
            v-if="event.series_id"
            v-model="wholeSeries"
            :label="t('schedule.attach.wholeSeries')"
          />
          <p class="attach__hint">{{ t('schedule.attach.hint') }}</p>
          <p v-if="failed" class="attach__error" role="alert">{{ failed }}</p>
        </template>
      </div>
      <template #footer>
        <UiButton variant="secondary" @click="open = false">{{ t('common.cancel') }}</UiButton>
        <UiButton
          :disabled="!!problem || !choice.pitchId"
          :loading="attach.isPending.value"
          @click="submit"
        >
          {{ t('schedule.attach.confirm') }}
        </UiButton>
      </template>
    </BottomSheet>
  </div>
</template>

<style scoped lang="scss">
.attach {
  display: flex;
  flex-direction: column;
  gap: $space-2;
  padding: $space-3 $space-4;
  border: 2px dashed var(--color-chalk);
  border-radius: $radius-lg;

  &__text {
    display: flex;
    align-items: center;
    gap: $space-2;
    color: var(--color-text-muted);
    font-size: $font-sm;
    font-weight: 700;
  }

  &__sheet {
    display: flex;
    flex-direction: column;
    gap: $space-4;
  }

  &__hint {
    color: var(--color-text-muted);
    font-size: $font-sm;
  }

  &__error {
    color: var(--color-danger);
  }
}
</style>
