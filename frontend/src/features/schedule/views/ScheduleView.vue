<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { addWeeks, getISOWeek, parseISO } from 'date-fns'
import UiChip from '@/ui/UiChip.vue'
import UiEmptyState from '@/ui/UiEmptyState.vue'
import UiIcon from '@/ui/UiIcon.vue'
import UiIconButton from '@/ui/UiIconButton.vue'
import UiSkeleton from '@/ui/UiSkeleton.vue'
import { formatDate } from '@/lib/date'
import { useActiveTeam } from '@/features/teams/composables/useActiveTeam'
import { useMyClubs } from '@/features/teams/composables/useTeams'
import EventsNav from '@/features/events/components/EventsNav.vue'
import SlotSheet from '../components/SlotSheet.vue'
import type { BookResult } from '../api'
import { useBookings, useClubTeamNames, usePitches, useSlots } from '../composables/useSchedule'
import {
  calendarHours,
  isoDate,
  slotBox,
  slotCells,
  slotStarted,
  slotsOn,
  timeLabel,
  weekDates,
  type Pitch,
  type PitchSlot,
  type SlotCell,
} from '../logic'

/**
 * The club's pitch schedule as a week calendar: days as columns, each pitch a lane, the pitch
 * times as blocks with the booked teams. Coaches tap a free part to book it or their own to
 * release it. Shown in the events tab for the club of the active team.
 */
const { t, locale } = useI18n()
const { myTeams, activeTeam } = useActiveTeam()
const clubId = computed(() => activeTeam.value?.club_id ?? '')
const pitches = usePitches(clubId)
const slots = useSlots(clubId)
const teamNames = useClubTeamNames(clubId)
const myClubs = useMyClubs()

const HOUR = 52 // px per hour
const today = isoDate(new Date())
const weekOffset = ref(0)
const days = computed(() => weekDates(addWeeks(new Date(), weekOffset.value)))
const bookings = useBookings(
  clubId,
  () => days.value[0]!,
  () => days.value[6]!,
)

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
  () => myClubs.data.value?.some((c) => c.club_id === clubId.value && c.role === 'admin') ?? false,
)
const bookableTeams = computed(() =>
  (myTeams.data.value ?? [])
    .filter((m) => m.club_id === clubId.value && (m.team_role === 'coach' || m.is_club_admin))
    .map((m) => ({ id: m.team_id, name: m.team_name })),
)
const ownTeamIds = computed(
  () =>
    new Set(
      (myTeams.data.value ?? [])
        .filter((m) => m.club_id === clubId.value && m.team_role)
        .map((m) => m.team_id),
    ),
)
const teamName = (teamId: string) =>
  teamNames.data.value?.find((team) => team.id === teamId)?.name ?? '…'

// One pitch or all of them; with all, every pitch is a lane in each day.
const pitchFilter = ref<string | null>(null)
const allPitches = computed(() =>
  [...(pitches.data.value ?? [])].sort((a, b) => a.sort_order - b.sort_order),
)
const sortedPitches = computed(() =>
  pitchFilter.value ? allPitches.value.filter((p) => p.id === pitchFilter.value) : allPitches.value,
)
// Halves A and B sit side by side, so a splittable pitch takes two parts of the day's width.
const weight = (pitch: Pitch) => (pitch.splittable ? 2 : 1)
const totalWeight = computed(() => sortedPitches.value.reduce((n, p) => n + weight(p), 0) || 1)
const laneStart = (index: number) =>
  sortedPitches.value.slice(0, index).reduce((n, p) => n + weight(p), 0) / totalWeight.value
// The calendar scrolls sideways on small screens; every part stays readable.
const dayWidth = computed(() => Math.max(112, totalWeight.value * 60))
const hours = computed(() => calendarHours(slots.data.value ?? [], days.value))
const hourMarks = computed(() =>
  Array.from({ length: hours.value.to - hours.value.from + 1 }, (_, i) => hours.value.from + i),
)

type Block = {
  slot: PitchSlot
  pitch: Pitch
  lane: number
  top: number
  height: number
  started: boolean
  cells: SlotCell[]
}
const columns = computed(() =>
  days.value.map((date) => {
    const blocks: Block[] = []
    for (const slot of slotsOn(slots.data.value ?? [], date)) {
      const lane = sortedPitches.value.findIndex((p) => p.id === slot.pitch_id)
      if (lane < 0) continue
      const pitch = sortedPitches.value[lane]!
      const box = slotBox(slot, hours.value.from)
      blocks.push({
        slot,
        pitch,
        lane,
        top: box.top * HOUR,
        height: box.height * HOUR,
        started: slotStarted(slot, date),
        cells: slotCells(slot, pitch, bookings.data.value ?? [], date),
      })
    }
    return { date, blocks }
  }),
)

const isLoading = computed(
  () => pitches.isPending.value || slots.isPending.value || bookings.isPending.value,
)
const loadFailed = computed(
  () => pitches.isError.value || slots.isError.value || bookings.isError.value,
)

// Start with today in view, scrolled down to its first pitch time (or the week's first one on
// a weekday, so a long weekend slot does not leave the evenings out of sight).
const scroller = ref<HTMLElement | null>(null)
async function showToday() {
  await nextTick()
  if (!scroller.value) return
  const index = days.value.indexOf(today)
  scroller.value.scrollLeft = index > 0 ? index * dayWidth.value - 8 : 0
  const column = columns.value[Math.max(index, 0)]
  const weekdays = columns.value.slice(0, 5).flatMap((c) => c.blocks)
  const blocks = column?.blocks.length ? column.blocks : weekdays
  const first = Math.min(...blocks.map((b) => b.top))
  scroller.value.scrollTop = Number.isFinite(first) ? Math.max(first - 12, 0) : 0
}
watch([isLoading, weekOffset], () => void showToday(), { immediate: true })

// Sheet
const sheet = ref<{
  slot: PitchSlot
  pitch: Pitch
  cells: SlotCell[]
  cell: SlotCell
  date: string
} | null>(null)
const sheetOpen = ref(false)
const notice = ref<string | null>(null)

function canOpen(cell: SlotCell, started: boolean) {
  if (started || !bookableTeams.value.length) return false
  return !cell.booking || bookableTeams.value.some((team) => team.id === cell.booking!.team_id)
}

function openCell(block: Block, cell: SlotCell, date: string) {
  notice.value = null
  sheet.value = { slot: block.slot, pitch: block.pitch, cells: block.cells, cell, date }
  sheetOpen.value = true
}

function onBooked(result: BookResult) {
  notice.value =
    result.skipped > 0
      ? t('schedule.bookedSkipped', { n: result.booked, skipped: result.skipped })
      : t('schedule.booked', result.booked)
}

function cellText(cell: SlotCell) {
  return cell.booking ? teamName(cell.booking.team_id) : t('schedule.free')
}
/** Full description for screen readers: day, time, pitch, part and who has it. */
function cellLabel(block: Block, cell: SlotCell, date: string) {
  // Ends with the visible text (e.g. "A U17"), so speech input finds it.
  const part = cell.part === 'full' ? '' : `${cell.part.toUpperCase()} `
  const time = `${timeLabel(block.slot.start_time)}–${timeLabel(block.slot.end_time)}`
  return `${formatDate(parseISO(date), locale.value, 'EEEEEE d.M.')}, ${time}, ${block.pitch.name}, ${part}${cellText(cell)}`
}
const dayName = (date: string) => formatDate(parseISO(date), locale.value, 'EEEEEE')
const dayNumber = (date: string) => formatDate(parseISO(date), locale.value, 'd.M.')
</script>

<template>
  <section class="schedule">
    <EventsNav active="events-schedule" />

    <header class="schedule__head">
      <h1>{{ t('schedule.title') }}</h1>
      <RouterLink
        v-if="isAdmin && clubId"
        class="schedule__setup"
        :to="{ name: 'club-schedule-setup', params: { clubId } }"
      >
        <UiIcon name="settings" :size="18" />
        {{ t('schedule.setup') }}
      </RouterLink>
    </header>

    <nav class="schedule__week" :aria-label="t('schedule.weekNav')">
      <UiIconButton
        icon="chevronLeft"
        variant="ghost"
        :label="t('schedule.previousWeek')"
        @click="weekOffset--"
      />
      <p class="schedule__week-label" aria-live="polite">{{ weekLabel }}</p>
      <UiIconButton
        icon="chevronRight"
        variant="ghost"
        :label="t('schedule.nextWeek')"
        @click="weekOffset++"
      />
      <button
        v-if="weekOffset !== 0"
        type="button"
        class="schedule__today"
        :title="t('schedule.thisWeek')"
        @click="weekOffset = 0"
      >
        {{ t('schedule.today') }}
      </button>
    </nav>

    <p v-if="notice" class="schedule__notice" role="status">✓ {{ notice }}</p>

    <div v-if="isLoading" aria-busy="true">
      <UiSkeleton shape="block" height="320px" />
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

    <template v-else>
      <div
        v-if="allPitches.length > 1"
        class="schedule__pitches"
        role="group"
        :aria-label="t('schedule.pitchFilter')"
      >
        <UiChip :model-value="!pitchFilter" @update:model-value="pitchFilter = null">
          {{ t('schedule.allPitches') }}
        </UiChip>
        <UiChip
          v-for="pitch in allPitches"
          :key="pitch.id"
          :model-value="pitchFilter === pitch.id"
          @update:model-value="pitchFilter = pitch.id"
        >
          {{ pitch.name }}
        </UiChip>
      </div>

      <div
        ref="scroller"
        class="schedule__calendar"
        :style="{ '--day-width': `${dayWidth}px`, '--hour': `${HOUR}px` }"
      >
        <div class="schedule__grid">
          <!-- Corner and day headers -->
          <div class="schedule__corner" aria-hidden="true" />
          <div
            v-for="column in columns"
            :key="`h-${column.date}`"
            class="schedule__day-head"
            :class="{ 'schedule__day-head--today': column.date === today }"
          >
            <span class="schedule__day-name">{{ dayName(column.date) }}</span>
            <span class="schedule__day-number">{{ dayNumber(column.date) }}</span>
            <span
              class="schedule__lanes"
              aria-hidden="true"
              :style="{ gridTemplateColumns: sortedPitches.map((p) => `${weight(p)}fr`).join(' ') }"
            >
              <span v-for="pitch in sortedPitches" :key="pitch.id" class="schedule__lane-name">
                {{ pitch.name }}
              </span>
            </span>
          </div>

          <!-- Hours -->
          <div class="schedule__hours" aria-hidden="true">
            <span
              v-for="(hour, i) in hourMarks"
              :key="hour"
              class="schedule__hour"
              :style="{ top: `${i * HOUR}px` }"
            >
              {{ String(hour).padStart(2, '0') }}
            </span>
          </div>

          <!-- Days -->
          <section
            v-for="column in columns"
            :key="column.date"
            class="schedule__day"
            :class="{ 'schedule__day--today': column.date === today }"
            :aria-label="formatDate(parseISO(column.date), locale, 'EEEE, d. MMMM')"
            :style="{ height: `${(hours.to - hours.from) * HOUR}px` }"
          >
            <div
              v-for="block in column.blocks"
              :key="block.slot.id"
              class="schedule__block"
              :class="{ 'schedule__block--past': block.started }"
              :style="{
                top: `${block.top}px`,
                height: `${block.height}px`,
                left: `${laneStart(block.lane) * 100}%`,
                width: `${(weight(block.pitch) / totalWeight) * 100}%`,
              }"
            >
              <component
                :is="canOpen(cell, block.started) ? 'button' : 'div'"
                v-for="cell in block.cells"
                :key="cell.part"
                :type="canOpen(cell, block.started) ? 'button' : undefined"
                class="schedule__cell"
                :class="{
                  'schedule__cell--free': !cell.booking,
                  'schedule__cell--own': cell.booking && ownTeamIds.has(cell.booking.team_id),
                  'schedule__cell--action': canOpen(cell, block.started),
                }"
                :aria-label="cellLabel(block, cell, column.date)"
                :role="canOpen(cell, block.started) ? undefined : 'img'"
                @click="canOpen(cell, block.started) && openCell(block, cell, column.date)"
              >
                <span v-if="cell.part !== 'full'" class="schedule__part">
                  {{ cell.part.toUpperCase() }}{{ ' ' }}
                </span>
                <span class="schedule__team">{{ cellText(cell) }}</span>
              </component>
            </div>
          </section>
        </div>
      </div>
      <ul class="schedule__legend" role="list">
        <li>
          <span class="schedule__swatch schedule__swatch--own" />{{ t('schedule.legendOwn') }}
        </li>
        <li>
          <span class="schedule__swatch schedule__swatch--taken" />{{ t('schedule.legendTaken') }}
        </li>
        <li>
          <span class="schedule__swatch schedule__swatch--free" />{{ t('schedule.legendFree') }}
        </li>
      </ul>
      <p class="schedule__hint">{{ t('schedule.calendarHint') }}</p>
    </template>

    <SlotSheet
      v-if="sheet"
      v-model:open="sheetOpen"
      :club-id="clubId"
      :pitch-slot="sheet.slot"
      :pitch="sheet.pitch"
      :date="sheet.date"
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
$gutter: 36px;

.schedule {
  display: flex;
  flex-direction: column;
  gap: $space-3;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $space-2;
  }

  &__setup {
    @include focus-visible;

    display: inline-flex;
    align-items: center;
    gap: $space-1;
    min-height: $touch-target;
    color: var(--color-text);
    font-weight: 700;
    text-decoration: underline;
    text-decoration-color: var(--color-primary);
    text-decoration-thickness: 2px;
    text-underline-offset: 4px;
  }

  &__week {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $space-2;
  }

  &__week-label {
    flex: 1;
    font-family: var(--font-display);
    font-size: $font-lg;
    font-weight: 800;
    text-align: center;
  }

  &__today {
    @include focus-visible;

    flex-shrink: 0;
    min-height: $touch-target;
    padding: 0 $space-3;
    border: 2px solid var(--color-border);
    border-radius: $radius-full;
    background: transparent;
    color: var(--color-text);
    font-weight: 800;
  }

  &__notice {
    padding: $space-2 $space-3;
    border-radius: $radius-md;
    background: var(--color-yes-bg, var(--color-surface));
    font-weight: 700;
  }

  &__error {
    color: var(--color-danger);
  }

  &__legend {
    display: flex;
    flex-wrap: wrap;
    gap: $space-1 $space-4;
    margin: 0;
    color: var(--color-text-muted);
    font-size: $font-sm;

    li {
      display: inline-flex;
      align-items: center;
      gap: $space-1;
    }
  }

  &__swatch {
    width: 14px;
    height: 14px;
    border-radius: 4px;

    &--own {
      background: var(--color-primary);
    }

    &--taken {
      background: var(--color-surface-muted);
      outline: 1px solid var(--color-border);
    }

    &--free {
      border: 2px dashed var(--color-primary);
    }
  }

  // Own scroll area in both directions; day headers and the hour column stay put.
  &__calendar {
    // Exactly the rest of the screen below the page head (title, week, pitches).
    height: calc(
      100dvh - var(--top-bar-height, 64px) - var(--area-nav-height, 0px) - var(--nav-offset, 0px) -
        196px
    );
    min-height: 300px;
    margin-inline: -$space-4;
    overflow: auto;
    border-block: 1px solid var(--color-border);
    background: var(--color-surface);
    overscroll-behavior-x: contain;
  }

  &__grid {
    display: grid;
    grid-template-columns: $gutter repeat(7, var(--day-width));
    width: max-content;
  }

  &__corner,
  &__hours {
    position: sticky;
    left: 0;
    z-index: 2;
    background: var(--color-surface);
  }

  &__corner {
    top: 0;
    z-index: 4;
    border-bottom: 1px solid var(--color-border);
  }

  &__day-head {
    position: sticky;
    top: 0;
    z-index: 3;
    background: var(--color-surface);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: $space-2 2px $space-1;
    border-bottom: 1px solid var(--color-border);
    border-left: 1px solid var(--color-border);
    line-height: 1.1;

    &--today {
      background: color-mix(in srgb, var(--color-primary) 14%, var(--color-surface));
    }
  }

  &__day-name {
    color: var(--color-text-muted);
    font-size: $font-xs;
    font-weight: 800;
    text-transform: uppercase;
  }

  &__day-number {
    font-family: var(--font-display);
    font-size: $font-lg;
    font-weight: 800;
  }

  &__pitches {
    display: flex;
    gap: $space-2;
    margin-inline: -$space-4;
    padding: 0 $space-4 2px;
    overflow-x: auto;
    scrollbar-width: none;

    > * {
      flex-shrink: 0;
    }
  }

  &__lanes {
    display: grid;
    width: 100%;
    margin-top: 2px;
  }

  &__lane-name {
    @include truncate;

    padding: 0 2px;
    color: var(--color-text-muted);
    font-size: 10px;
    font-weight: 700;
    text-align: center;
  }

  &__hours {
    position: sticky;
    border-right: 1px solid var(--color-border);
  }

  &__hour {
    position: absolute;
    right: 4px;
    color: var(--color-text-muted);
    font-size: $font-xs;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    transform: translateY(-50%);

    &:first-child {
      transform: none;
    }
  }

  &__day {
    position: relative;
    border-left: 1px solid var(--color-border);
    // Hour lines.
    background-image: linear-gradient(to bottom, var(--color-border) 1px, transparent 1px);
    background-size: 100% var(--hour);

    &--today {
      background-color: color-mix(in srgb, var(--color-primary) 6%, transparent);
    }
  }

  &__block {
    position: absolute;
    display: flex;
    gap: 2px;
    padding: 2px;

    &--past {
      opacity: 0.5;
    }
  }

  &__cell {
    display: flex;
    flex: 1 1 0;
    flex-direction: column;
    justify-content: flex-start;
    min-height: 0;
    padding: 2px 4px;
    overflow: hidden;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-surface-muted);
    color: var(--color-text);
    font: inherit;
    font-size: $font-xs;
    line-height: 1.15;
    text-align: left;

    &--free {
      border: 2px dashed var(--color-primary);
      background: transparent;
      color: var(--color-text-muted);
    }

    &--own {
      border-color: var(--color-primary);
      background: var(--color-primary);
      color: var(--color-primary-contrast);
    }

    &--action {
      cursor: pointer;

      &:focus-visible {
        @include focus-ring;
      }
    }
  }

  &__part {
    font-weight: 800;
    opacity: 0.8;
  }

  &__team {
    font-weight: 800;
    hyphens: auto;
    overflow-wrap: break-word;
  }

  &__hint {
    color: var(--color-text-muted);
    font-size: $font-sm;
  }
}
</style>
