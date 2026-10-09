<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { parseISO } from 'date-fns'
import BaseButton from '@/components/BaseButton.vue'
import BaseChipGroup from '@/components/BaseChipGroup.vue'
import BaseModal from '@/components/BaseModal.vue'
import { formatDate } from '@/lib/date'
import { scheduleErrorHint, type BookResult } from '../api'
import { useBookSlot, useEndSlotBooking, useReleaseSlotDate } from '../composables/useSchedule'
import {
  freeParts,
  timeLabel,
  type Pitch,
  type PitchPart,
  type PitchSlot,
  type SlotCell,
} from '../logic'

const props = defineProps<{
  clubId: string
  pitchSlot: PitchSlot
  pitch: Pitch
  date: string
  cells: SlotCell[]
  /** The cell that was tapped. */
  cell: SlotCell
  /** Teams the user may book for (coach or club admin). */
  teams: { id: string; name: string }[]
  teamName: (teamId: string) => string
}>()

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ booked: [result: BookResult]; released: [] }>()

const { t, locale } = useI18n()
const book = useBookSlot(() => props.clubId)
const release = useReleaseSlotDate(() => props.clubId)
const end = useEndSlotBooking(() => props.clubId)

const booking = computed(() => props.cell.booking)
const dayLabel = (iso: string) => formatDate(parseISO(iso), locale.value, 'EEEEEE, P')
const summary = computed(
  () =>
    `${formatDate(parseISO(props.date), locale.value, 'EEEE, P')} · ${timeLabel(props.pitchSlot.start_time)}–${timeLabel(props.pitchSlot.end_time)} · ${props.pitch.name}`,
)

// Booking form
const part = ref<PitchPart>('full')
const teamId = ref<string>('')
const repeat = ref<'once' | 'weekly'>('once')

watch(
  open,
  (isOpen) => {
    if (!isOpen) return
    part.value = props.cell.part
    teamId.value = props.teams[0]?.id ?? ''
    repeat.value = 'once'
    book.reset()
    release.reset()
    end.reset()
  },
  { immediate: true },
)

const partOptions = computed(() =>
  freeParts(props.cells, props.pitch.splittable).map((value) => ({
    value,
    label: t(`schedule.parts.${value}`),
  })),
)
const teamOptions = computed(() =>
  props.teams.map((team) => ({ value: team.id, label: team.name })),
)
const repeatOptions = computed(() => [
  { value: 'once' as const, label: t('schedule.once', { date: dayLabel(props.date) }) },
  {
    value: 'weekly' as const,
    label: t('schedule.weekly', { date: dayLabel(props.pitchSlot.valid_until) }),
  },
])

const bookError = computed(() => {
  if (!book.isError.value) return null
  return scheduleErrorHint(book.error.value) === 'slot_taken'
    ? t('schedule.errors.taken')
    : t('schedule.errors.bookFailed')
})

async function submitBooking() {
  const result = await book.mutateAsync({
    slotId: props.pitchSlot.id,
    teamId: teamId.value,
    part: part.value,
    from: props.date,
    until: repeat.value === 'once' ? props.date : null,
  })
  open.value = false
  emit('booked', result)
}

// Release
const canManage = computed(
  () => !!booking.value && props.teams.some((team) => team.id === booking.value!.team_id),
)
const isRecurring = computed(() => !!booking.value && booking.value.valid_until > props.date)
const rangeLabel = computed(() => {
  const b = booking.value
  if (!b) return ''
  return b.valid_from === b.valid_until
    ? t('schedule.onlyOn', { date: dayLabel(b.valid_from) })
    : t('schedule.everyWeekUntil', { date: dayLabel(b.valid_until) })
})

async function releaseDate() {
  await release.mutateAsync({ bookingId: booking.value!.id, date: props.date })
  open.value = false
  emit('released')
}

async function endBooking() {
  await end.mutateAsync({ bookingId: booking.value!.id, from: props.date })
  open.value = false
  emit('released')
}
</script>

<template>
  <BaseModal
    v-model:open="open"
    :title="
      booking
        ? `${teamName(booking.team_id)} · ${t(`schedule.parts.${booking.part}`)}`
        : t('schedule.bookTitle')
    "
  >
    <div class="slot-sheet">
      <p class="slot-sheet__summary">{{ summary }}</p>

      <!-- Free: book -->
      <template v-if="!booking">
        <BaseChipGroup v-model="part" :label="t('schedule.part')" :options="partOptions" />
        <BaseChipGroup
          v-if="teams.length > 1"
          v-model="teamId"
          :label="t('schedule.team')"
          :options="teamOptions"
        />
        <BaseChipGroup v-model="repeat" :label="t('schedule.repeat')" :options="repeatOptions" />
        <p class="slot-sheet__hint">{{ t('schedule.bookHint') }}</p>
        <p v-if="bookError" class="slot-sheet__error" role="alert">{{ bookError }}</p>
      </template>

      <!-- Booked -->
      <template v-else>
        <p>{{ rangeLabel }}</p>
        <p v-if="canManage" class="slot-sheet__hint">{{ t('schedule.releaseHint') }}</p>
        <p v-if="release.isError.value || end.isError.value" class="slot-sheet__error" role="alert">
          {{ t('schedule.errors.releaseFailed') }}
        </p>
      </template>
    </div>

    <template #footer>
      <template v-if="!booking">
        <BaseButton variant="secondary" @click="open = false">{{ t('common.cancel') }}</BaseButton>
        <BaseButton :disabled="!teamId" :loading="book.isPending.value" @click="submitBooking">
          {{ t('schedule.book') }}
        </BaseButton>
      </template>
      <div v-else-if="canManage" class="slot-sheet__actions">
        <BaseButton variant="danger" block :loading="release.isPending.value" @click="releaseDate">
          {{ t('schedule.releaseDate', { date: dayLabel(date) }) }}
        </BaseButton>
        <BaseButton
          v-if="isRecurring"
          variant="secondary"
          block
          :loading="end.isPending.value"
          @click="endBooking"
        >
          {{ t('schedule.releaseFrom', { date: dayLabel(date) }) }}
        </BaseButton>
      </div>
      <BaseButton v-else variant="secondary" @click="open = false">
        {{ t('common.close') }}
      </BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped lang="scss">
.slot-sheet {
  display: flex;
  flex-direction: column;
  gap: $space-4;

  &__summary {
    font-weight: 600;
  }

  &__hint {
    font-size: $font-sm;
    color: var(--color-text-muted);
  }

  &__error {
    color: var(--color-danger);
  }

  &__actions {
    display: flex;
    flex-direction: column;
    gap: $space-2;
    width: 100%;
  }
}
</style>
