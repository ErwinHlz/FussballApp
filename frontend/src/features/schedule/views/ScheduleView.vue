<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { addWeeks, getISOWeek, parseISO } from 'date-fns'
import { useSwipe } from '@vueuse/core'
import UiEmptyState from '@/ui/UiEmptyState.vue'
import UiIcon from '@/ui/UiIcon.vue'
import UiIconButton from '@/ui/UiIconButton.vue'
import UiSkeleton from '@/ui/UiSkeleton.vue'
import { formatDate } from '@/lib/date'
import { useClub, useMyClubs, useMyTeams } from '@/features/teams/composables/useTeams'
import SlotSheet from '../components/SlotSheet.vue'
import type { BookResult } from '../api'
import { useBookings, useClubTeamNames, usePitches, useSlots } from '../composables/useSchedule'
import {
  isoDate,
  slotCells,
  slotStarted,
  slotsOn,
  timeLabel,
  weekDates,
  type Pitch,
  type PitchSlot,
  type SlotCell,
} from '../logic'

const props = defineProps<{ clubId: string }>()

const { t, locale } = useI18n()
const club = useClub(() => props.clubId)
const pitches = usePitches(() => props.clubId)
const slots = useSlots(() => props.clubId)
const teamNames = useClubTeamNames(() => props.clubId)
const myTeams = useMyTeams()
const myClubs = useMyClubs()

const today = isoDate(new Date())
const weekOffset = ref(0)
const days = computed(() => weekDates(addWeeks(new Date(), weekOffset.value)))
const selectedDate = ref(today)
const selected = computed(() =>
  days.value.includes(selectedDate.value) ? selectedDate.value : days.value[0]!,
)
const bookings = useBookings(
  () => props.clubId,
  () => days.value[0]!,
  () => days.value[6]!,
)

function moveWeek(delta: number) {
  weekOffset.value += delta
  selectedDate.value = weekOffset.value === 0 ? today : days.value[0]!
}

/** Next or previous day, crossing into the neighbouring week at the edges. */
function moveDay(delta: 1 | -1) {
  const next = days.value.indexOf(selected.value) + delta
  if (next >= 0 && next < 7) {
    selectedDate.value = days.value[next]!
    return
  }
  weekOffset.value += delta
  selectedDate.value = days.value[delta === 1 ? 0 : 6]!
}

// Swipe left/right over the day plan changes the day (like turning pages).
const swipeArea = useTemplateRef<HTMLElement>('swipeArea')
useSwipe(swipeArea, {
  threshold: 60,
  onSwipeEnd: (_event, direction) => {
    if (direction === 'left') moveDay(1)
    else if (direction === 'right') moveDay(-1)
  },
})

const weekLabel = computed(() => {
  const first = parseISO(days.value[0]!)
  const last = parseISO(days.value[6]!)
  const pattern = t('events.dayMonthPattern')
  return t('schedule.weekLabel', {
    week: getISOWeek(first),
    range: `${formatDate(first, locale.value, pattern)} – ${formatDate(last, locale.value, pattern)}`,
  })
})

const isAdmin = computed(
  () => myClubs.data.value?.some((c) => c.club_id === props.clubId && c.role === 'admin') ?? false,
)
const bookableTeams = computed(() =>
  (myTeams.data.value ?? [])
    .filter((m) => m.club_id === props.clubId && (m.team_role === 'coach' || m.is_club_admin))
    .map((m) => ({ id: m.team_id, name: m.team_name })),
)
const ownTeamIds = computed(
  () =>
    new Set(
      (myTeams.data.value ?? [])
        .filter((m) => m.club_id === props.clubId && m.team_role)
        .map((m) => m.team_id),
    ),
)
const teamName = (teamId: string) =>
  teamNames.data.value?.find((team) => team.id === teamId)?.name ?? '…'

const hasSlots = (date: string) => slotsOn(slots.data.value ?? [], date).length > 0

/** Pitches with their slots on the selected day. */
const dayPlan = computed(() => {
  const daySlots = slotsOn(slots.data.value ?? [], selected.value)
  return (pitches.data.value ?? [])
    .map((pitch) => ({
      pitch,
      rows: daySlots
        .filter((slot) => slot.pitch_id === pitch.id)
        .map((slot) => ({
          slot,
          started: slotStarted(slot, selected.value),
          cells: slotCells(slot, pitch, bookings.data.value ?? [], selected.value),
        })),
    }))
    .filter((entry) => entry.rows.length)
})

const isLoading = computed(
  () => pitches.isPending.value || slots.isPending.value || bookings.isPending.value,
)
const loadFailed = computed(
  () => pitches.isError.value || slots.isError.value || bookings.isError.value,
)

// Sheet
const sheet = ref<{ slot: PitchSlot; pitch: Pitch; cells: SlotCell[]; cell: SlotCell } | null>(null)
const sheetOpen = ref(false)
const notice = ref<string | null>(null)

function canOpen(cell: SlotCell, started: boolean) {
  if (started || !bookableTeams.value.length) return false
  return !cell.booking || bookableTeams.value.some((team) => team.id === cell.booking!.team_id)
}

function openCell(pitch: Pitch, slot: PitchSlot, cells: SlotCell[], cell: SlotCell) {
  notice.value = null
  sheet.value = { slot, pitch, cells, cell }
  sheetOpen.value = true
}

function onBooked(result: BookResult) {
  notice.value =
    result.skipped > 0
      ? t('schedule.bookedSkipped', { n: result.booked, skipped: result.skipped })
      : t('schedule.booked', result.booked)
}

function cellLabel(cell: SlotCell) {
  const part = cell.part === 'full' ? '' : `${cell.part.toUpperCase()} · `
  return `${part}${cell.booking ? teamName(cell.booking.team_id) : t('schedule.free')}`
}
</script>

<template>
  <section class="schedule">
    <header class="schedule__head">
      <div>
        <p class="schedule__eyebrow">{{ club.data.value?.name }}</p>
        <h1>{{ t('schedule.title') }}</h1>
      </div>
      <RouterLink
        v-if="isAdmin"
        class="schedule__setup"
        :to="{ name: 'club-schedule-setup', params: { clubId } }"
      >
        <UiIcon name="building" :size="18" />
        {{ t('schedule.setup') }}
      </RouterLink>
    </header>

    <nav class="schedule__week" :aria-label="t('schedule.weekNav')">
      <UiIconButton
        icon="chevronLeft"
        variant="ghost"
        :label="t('schedule.previousWeek')"
        @click="moveWeek(-1)"
      />
      <p class="schedule__week-label" aria-live="polite">{{ weekLabel }}</p>
      <UiIconButton
        icon="chevronRight"
        variant="ghost"
        :label="t('schedule.nextWeek')"
        @click="moveWeek(1)"
      />
    </nav>

    <div class="schedule__days" role="group" :aria-label="t('schedule.day')">
      <button
        v-for="day in days"
        :key="day"
        type="button"
        class="schedule__day"
        :class="{
          'schedule__day--selected': day === selected,
          'schedule__day--today': day === today,
        }"
        :aria-pressed="day === selected"
        @click="selectedDate = day"
      >
        <span class="schedule__day-name">{{ formatDate(parseISO(day), locale, 'EEEEEE') }}</span>
        <span class="schedule__day-number">{{ formatDate(parseISO(day), locale, 'd') }}</span>
        <span v-if="hasSlots(day)" class="schedule__day-dot" aria-hidden="true" />
      </button>
    </div>

    <div ref="swipeArea" class="schedule__swipe">
      <p v-if="notice" class="schedule__notice" role="status">✓ {{ notice }}</p>

      <div v-if="isLoading" aria-busy="true" class="schedule__loading">
        <UiSkeleton shape="block" height="140px" />
      </div>
      <p v-else-if="loadFailed" class="schedule__error" role="alert">
        {{ t('schedule.loadFailed') }}
      </p>

      <UiEmptyState
        v-else-if="!slots.data.value?.length"
        icon="calendar"
        :title="t('schedule.emptyTitle')"
        :text="isAdmin ? t('schedule.emptyAdmin') : t('schedule.emptyText')"
      >
        <RouterLink
          v-if="isAdmin"
          class="schedule__setup"
          :to="{ name: 'club-schedule-setup', params: { clubId } }"
        >
          {{ t('schedule.setup') }}
        </RouterLink>
      </UiEmptyState>

      <p v-else-if="!dayPlan.length" class="schedule__muted">{{ t('schedule.noSlotsToday') }}</p>

      <section
        v-for="{ pitch, rows } in dayPlan"
        v-else
        :key="pitch.id"
        class="schedule__pitch"
        :aria-label="pitch.name"
      >
        <h2 class="schedule__pitch-name">{{ pitch.name }}</h2>
        <ul class="schedule__slots" role="list">
          <li
            v-for="row in rows"
            :key="row.slot.id"
            class="schedule__slot"
            :class="{ 'schedule__slot--past': row.started }"
          >
            <span class="schedule__time">
              {{ timeLabel(row.slot.start_time) }}<br />{{ timeLabel(row.slot.end_time) }}
            </span>
            <div class="schedule__cells" :style="{ '--cells': row.cells.length }">
              <component
                :is="canOpen(cell, row.started) ? 'button' : 'div'"
                v-for="cell in row.cells"
                :key="cell.part"
                :type="canOpen(cell, row.started) ? 'button' : undefined"
                class="schedule__cell"
                :class="{
                  'schedule__cell--free': !cell.booking,
                  'schedule__cell--own': cell.booking && ownTeamIds.has(cell.booking.team_id),
                  'schedule__cell--action': canOpen(cell, row.started),
                }"
                @click="canOpen(cell, row.started) && openCell(pitch, row.slot, row.cells, cell)"
              >
                {{ cellLabel(cell) }}
              </component>
            </div>
          </li>
        </ul>
      </section>

      <p class="schedule__swipe-hint">{{ t('schedule.swipeHint') }}</p>
    </div>

    <SlotSheet
      v-if="sheet"
      v-model:open="sheetOpen"
      :club-id="clubId"
      :pitch-slot="sheet.slot"
      :pitch="sheet.pitch"
      :date="selected"
      :cells="sheet.cells"
      :cell="sheet.cell"
      :teams="bookableTeams"
      :team-name="teamName"
      @booked="onBooked"
      @released="notice = t('schedule.released')"
    />
  </section>
</template>

<style scoped lang="scss">
.schedule {
  display: flex;
  flex-direction: column;
  gap: $space-4;

  &__head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: $space-2;
  }

  &__eyebrow {
    font-size: $font-sm;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-text-muted);
  }

  &__setup {
    @include focus-visible;

    display: inline-flex;
    align-items: center;
    gap: $space-1;
    min-height: $touch-target;
    font-weight: 600;
    text-decoration: none;
  }

  &__week {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__week-label {
    font-weight: 700;
    text-align: center;
  }

  &__days {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: $space-1;
  }

  &__day {
    @include focus-visible;

    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    min-height: 56px;
    padding: $space-1 0;
    border: 1px solid var(--color-border);
    border-radius: $radius-md;
    background: var(--color-surface);
    color: var(--color-text);

    &--today .schedule__day-number {
      color: var(--color-primary);
    }

    &--selected {
      border-color: var(--color-primary);
      background: var(--color-primary);
      color: var(--color-primary-contrast);

      .schedule__day-number {
        color: inherit;
      }
    }
  }

  &__day-name {
    font-size: $font-sm;
  }

  &__day-number {
    font-weight: 700;
  }

  &__day-dot {
    position: absolute;
    bottom: 4px;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: currentColor;
    opacity: 0.6;
  }

  &__notice {
    color: var(--color-success);
    font-weight: 600;
  }

  &__pitch {
    display: flex;
    flex-direction: column;
    gap: $space-2;
  }

  &__pitch-name {
    font-size: $font-lg;
  }

  &__slots {
    display: flex;
    flex-direction: column;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: $radius-lg;
  }

  &__slot {
    display: flex;
    align-items: stretch;
    gap: $space-3;
    padding: $space-2 $space-3;

    & + & {
      border-top: 1px solid var(--color-border);
    }

    &--past {
      opacity: 0.55;
    }
  }

  &__time {
    flex: none;
    width: 3.2rem;
    font-size: $font-sm;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    line-height: 1.4;
  }

  &__cells {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(var(--cells), minmax(0, 1fr));
    gap: $space-2;
  }

  &__cell {
    display: flex;
    align-items: center;
    min-height: $touch-target;
    padding: $space-1 $space-2;
    border: 1px solid var(--color-border);
    border-radius: $radius-md;
    background: var(--color-surface-muted);
    color: var(--color-text);
    font: inherit;
    font-size: $font-sm;
    font-weight: 600;
    text-align: left;
    overflow-wrap: anywhere;

    &--free {
      border-style: dashed;
      background: transparent;
      color: var(--color-text-muted);
      font-weight: 500;
    }

    &--own {
      border-color: var(--color-primary);
      background: color-mix(in srgb, var(--color-primary) 14%, transparent);
    }

    &--action {
      @include focus-visible;

      cursor: pointer;

      &.schedule__cell--free {
        border-color: var(--color-primary);
        color: var(--color-primary);
      }
    }
  }

  &__swipe {
    display: flex;
    flex-direction: column;
    gap: $space-4;
    // Horizontal swipes change the day; vertical scrolling stays with the page.
    touch-action: pan-y;
  }

  &__loading {
    display: flex;
    flex-direction: column;
  }

  &__swipe-hint {
    color: var(--color-text-muted);
    font-size: $font-xs;
    text-align: center;
  }

  &__muted {
    color: var(--color-text-muted);
  }

  &__error {
    color: var(--color-danger);
  }
}
</style>
