<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { parseISO } from 'date-fns'
import UiButton from '@/ui/UiButton.vue'
import UiChipGroup from '@/ui/UiChipGroup.vue'
import BottomSheet from '@/ui/BottomSheet.vue'
import { formatDate } from '@/lib/date'
import { scheduleErrorHint, type BookResult } from '../api'
import { useBookPitch, useEndSlotBooking, useReleaseSlotDate } from '../composables/useSchedule'
import {
  freeParts,
  minutesOf,
  possibleDurations,
  seasonEnd,
  timeLabel,
  timeOf,
  type Lane,
  type Pitch,
  type PitchPart,
  type SlotBooking,
} from '../logic'

/**
 * Booking a free half hour (start fixed by the tap): length, part of the pitch, team and
 * once or every week. Or, for an own booking: give back this date or all from it on.
 */
const props = defineProps<{
  clubId: string
  pitch: Pitch
  date: string
  /** Free half hour that was tapped ('HH:mm'); unused for a booking. */
  start: string
  /** Lane that was tapped: preferred part. */
  lane: Lane
  /** All bookings of the pitch on that date. */
  day: SlotBooking[]
  /** Booking that was tapped (release), or null (book). */
  booking: SlotBooking | null
  /** Teams the user may book for (coach or club admin). */
  teams: { id: string; name: string }[]
  teamName: (teamId: string) => string
}>()

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ booked: [result: BookResult]; released: [] }>()

const { t, locale } = useI18n()
const book = useBookPitch(() => props.clubId)
const release = useReleaseSlotDate(() => props.clubId)
const end = useEndSlotBooking(() => props.clubId)

const dayLabel = (iso: string) => formatDate(parseISO(iso), locale.value, 'EEEEEE, P')

// Booking form
const part = ref<PitchPart>('full')
const duration = ref(90)
const teamId = ref('')
const repeat = ref<'once' | 'weekly'>('weekly')

const durations = computed(() => possibleDurations(props.day, part.value, props.start))
const endTime = computed(() => timeOf(minutesOf(props.start) + duration.value))

watch(
  open,
  (isOpen) => {
    if (!isOpen) return
    // The tapped lane if it can be booked from here, otherwise the first part that can.
    const parts = freeParts(
      props.day,
      props.pitch.splittable,
      props.start,
      timeOf(minutesOf(props.start) + 30),
    )
    part.value = parts.includes(props.lane) ? props.lane : (parts[0] ?? 'full')
    const lengths = possibleDurations(props.day, part.value, props.start)
    duration.value = lengths.includes(90) ? 90 : (lengths.at(-1) ?? 30)
    teamId.value = props.teams[0]?.id ?? ''
    repeat.value = 'weekly'
    book.reset()
    release.reset()
    end.reset()
  },
  { immediate: true },
)
// Another part may leave less time: keep the length possible.
watch(durations, (lengths) => {
  if (!lengths.includes(duration.value)) duration.value = lengths.at(-1) ?? 30
})

const partOptions = computed(() =>
  freeParts(
    props.day,
    props.pitch.splittable,
    props.start,
    timeOf(minutesOf(props.start) + 30),
  ).map((value) => ({ value, label: t(`schedule.parts.${value}`) })),
)
// Chip groups work with strings.
const durationKey = computed({
  get: () => String(duration.value),
  set: (value: string) => (duration.value = Number(value)),
})
const durationOptions = computed(() =>
  durations.value.map((minutes) => ({
    value: String(minutes),
    label: t('schedule.duration', { n: minutes }),
  })),
)
const teamOptions = computed(() =>
  props.teams.map((team) => ({ value: team.id, label: team.name })),
)
const repeatOptions = computed(() => [
  {
    value: 'weekly' as const,
    label: t('schedule.weekly', { date: dayLabel(seasonEnd(props.date)) }),
  },
  { value: 'once' as const, label: t('schedule.once', { date: dayLabel(props.date) }) },
])

const summary = computed(() => {
  const from = props.booking ? timeLabel(props.booking.start_time) : props.start
  const to = props.booking ? timeLabel(props.booking.end_time) : endTime.value
  return `${formatDate(parseISO(props.date), locale.value, 'EEEE, P')} · ${from}–${to} · ${props.pitch.name}`
})

const bookError = computed(() => {
  if (!book.isError.value) return null
  return scheduleErrorHint(book.error.value) === 'slot_taken'
    ? t('schedule.errors.taken')
    : t('schedule.errors.bookFailed')
})

async function submitBooking() {
  const result = await book.mutateAsync({
    pitchId: props.pitch.id,
    teamId: teamId.value,
    part: part.value,
    start: props.start,
    end: endTime.value,
    from: props.date,
    until: repeat.value === 'once' ? props.date : null,
  })
  open.value = false
  emit('booked', result)
}

// Release
const canManage = computed(
  () => !!props.booking && props.teams.some((team) => team.id === props.booking!.team_id),
)
const isRecurring = computed(() => !!props.booking && props.booking.valid_until > props.date)
const rangeLabel = computed(() => {
  const b = props.booking
  if (!b) return ''
  return b.valid_from === b.valid_until
    ? t('schedule.onlyOn', { date: dayLabel(b.valid_from) })
    : t('schedule.everyWeekUntil', { date: dayLabel(b.valid_until) })
})

async function releaseDate() {
  await release.mutateAsync({ bookingId: props.booking!.id, date: props.date })
  open.value = false
  emit('released')
}

async function endBooking() {
  await end.mutateAsync({ bookingId: props.booking!.id, from: props.date })
  open.value = false
  emit('released')
}
</script>

<template>
  <BottomSheet
    v-model:open="open"
    :title="
      booking
        ? `${teamName(booking.team_id)} · ${t(`schedule.parts.${booking.part}`)}`
        : t('schedule.bookTitle')
    "
  >
    <div class="booking-sheet">
      <p class="booking-sheet__summary">{{ summary }}</p>

      <!-- Free: book -->
      <template v-if="!booking">
        <UiChipGroup
          v-model="durationKey"
          :label="t('schedule.length')"
          :options="durationOptions"
        />
        <UiChipGroup
          v-if="partOptions.length > 1"
          v-model="part"
          :label="t('schedule.part')"
          :options="partOptions"
        />
        <UiChipGroup
          v-if="teams.length > 1"
          v-model="teamId"
          :label="t('schedule.team')"
          :options="teamOptions"
        />
        <UiChipGroup v-model="repeat" :label="t('schedule.repeat')" :options="repeatOptions" />
        <p class="booking-sheet__hint">{{ t('schedule.bookHint') }}</p>
        <p v-if="bookError" class="booking-sheet__error" role="alert">{{ bookError }}</p>
      </template>

      <!-- Booked -->
      <template v-else>
        <p>{{ rangeLabel }}</p>
        <p v-if="canManage" class="booking-sheet__hint">{{ t('schedule.releaseHint') }}</p>
        <p
          v-if="release.isError.value || end.isError.value"
          class="booking-sheet__error"
          role="alert"
        >
          {{ t('schedule.errors.releaseFailed') }}
        </p>
      </template>
    </div>

    <template #footer>
      <template v-if="!booking">
        <UiButton variant="secondary" @click="open = false">{{ t('common.cancel') }}</UiButton>
        <UiButton :disabled="!teamId" :loading="book.isPending.value" @click="submitBooking">
          {{ t('schedule.bookUntil', { time: endTime }) }}
        </UiButton>
      </template>
      <div v-else-if="canManage" class="booking-sheet__actions">
        <UiButton variant="danger" block :loading="release.isPending.value" @click="releaseDate">
          {{ t('schedule.releaseDate', { date: dayLabel(date) }) }}
        </UiButton>
        <UiButton
          v-if="isRecurring"
          variant="secondary"
          block
          :loading="end.isPending.value"
          @click="endBooking"
        >
          {{ t('schedule.releaseFrom', { date: dayLabel(date) }) }}
        </UiButton>
      </div>
      <UiButton v-else variant="secondary" @click="open = false">
        {{ t('common.close') }}
      </UiButton>
    </template>
  </BottomSheet>
</template>

<style scoped lang="scss">
.booking-sheet {
  display: flex;
  flex-direction: column;
  gap: $space-4;

  &__summary {
    font-weight: 700;
  }

  &__hint {
    color: var(--color-text-muted);
    font-size: $font-sm;
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
