<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { addWeeks, getISOWeek, parseISO } from 'date-fns'
import UiEmptyState from '@/ui/UiEmptyState.vue'
import UiIcon from '@/ui/UiIcon.vue'
import UiIconButton from '@/ui/UiIconButton.vue'
import UiSegmented from '@/ui/UiSegmented.vue'
import UiSkeleton from '@/ui/UiSkeleton.vue'
import { formatDate } from '@/lib/date'
import { useActiveTeam } from '@/features/teams/composables/useActiveTeam'
import { useMyClubs } from '@/features/teams/composables/useTeams'
import EventsNav from '@/features/events/components/EventsNav.vue'
import BookingSheet from '../components/BookingSheet.vue'
import type { BookResult } from '../api'
import { useBookings, useClubTeamNames, usePitches } from '../composables/useSchedule'
import {
  bookingsOn,
  halfHours,
  isoDate,
  minutesOf,
  OPEN_FROM,
  occupant,
  openDates,
  STEP_MIN,
  teamShortName,
  timeLabel,
  timeStarted,
  type Lane,
  type Pitch,
  type SlotBooking,
} from '../logic'

/**
 * The club's pitch schedule as a calendar: Monday to Friday, 15:00–20:30 in half hours, one
 * pitch at a time with halves A and B as lanes. Booked times are blocks (own team in the accent
 * color); every free half hour can be tapped to book from there. Club of the active team.
 */
const { t, locale } = useI18n()
const { myTeams, activeTeam } = useActiveTeam()
const clubId = computed(() => activeTeam.value?.club_id ?? '')
const pitches = usePitches(clubId)
const teamNames = useClubTeamNames(clubId)
const myClubs = useMyClubs()

const rows = halfHours()
const today = isoDate(new Date())
const weekOffset = ref(0)
const days = computed(() => openDates(addWeeks(new Date(), weekOffset.value)))
const bookings = useBookings(
  clubId,
  () => days.value[0]!,
  () => days.value[4]!,
)

const weekLabel = computed(() => {
  const first = parseISO(days.value[0]!)
  const last = parseISO(days.value[4]!)
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
const canManage = (booking: SlotBooking) =>
  bookableTeams.value.some((team) => team.id === booking.team_id)

// Other teams get distinct colors (by their place in the club), the own team the accent color.
// Blue comes last: many accent colors are blue, the own team must stand out.
const TEAM_HUES = ['#db2777', '#ea580c', '#7c3aed', '#0891b2', '#ca8a04', '#16a34a', '#2563eb']
function teamStyle(teamId: string) {
  if (ownTeamIds.value.has(teamId)) return undefined
  const index = Math.max(
    (teamNames.data.value ?? []).findIndex((team) => team.id === teamId),
    0,
  )
  return { '--team': TEAM_HUES[index % TEAM_HUES.length] }
}

// One pitch at a time.
const allPitches = computed(() =>
  [...(pitches.data.value ?? [])].sort((a, b) => a.sort_order - b.sort_order),
)
const chosenPitch = ref<string | null>(null)
const pitch = computed<Pitch | null>(
  () => allPitches.value.find((p) => p.id === chosenPitch.value) ?? allPitches.value[0] ?? null,
)
const pitchId = computed({
  get: () => pitch.value?.id ?? '',
  set: (value: string) => (chosenPitch.value = value),
})
const pitchOptions = computed(() => allPitches.value.map((p) => ({ value: p.id, label: p.name })))
const lanes = computed<Lane[]>(() => (pitch.value?.splittable ? ['a', 'b'] : ['full']))

/** Grid row (1-based) of a time; the end of the day is one past the last row. */
const rowOf = (time: string) => (minutesOf(time) - minutesOf(OPEN_FROM)) / STEP_MIN + 1

type Cell = { lane: Lane; time: string; row: number; bookable: boolean }
type Block = { booking: SlotBooking; rowStart: number; rowEnd: number; lanes: string }
const columns = computed(() =>
  days.value.map((date) => {
    const day = pitch.value ? bookingsOn(bookings.data.value ?? [], pitch.value.id, date) : []
    const cells: Cell[] = []
    for (const lane of lanes.value) {
      for (const time of rows) {
        if (occupant(day, lane, time)) continue
        cells.push({
          lane,
          time,
          row: rowOf(time),
          bookable: bookableTeams.value.length > 0 && !timeStarted(time, date),
        })
      }
    }
    const blocks: Block[] = day.map((booking) => ({
      booking,
      rowStart: rowOf(booking.start_time),
      rowEnd: rowOf(booking.end_time),
      lanes:
        booking.part === 'full' || lanes.value.length === 1
          ? '1 / -1'
          : String(lanes.value.indexOf(booking.part) + 1),
    }))
    return { date, day, cells, blocks }
  }),
)

/** Teams that appear this week (for the legend). */
const legendTeams = computed(() => {
  const ids = new Set(columns.value.flatMap((c) => c.blocks.map((b) => b.booking.team_id)))
  return [...ids].map((id) => ({
    id,
    name: teamName(id),
    short: teamShortName(teamName(id)),
    own: ownTeamIds.value.has(id),
  }))
})

const isLoading = computed(() => pitches.isPending.value || bookings.isPending.value)
const loadFailed = computed(() => pitches.isError.value || bookings.isError.value)

// Sheet
const sheet = ref<{
  date: string
  start: string
  lane: Lane
  day: SlotBooking[]
  booking: SlotBooking | null
} | null>(null)
const sheetOpen = ref(false)
const notice = ref<string | null>(null)
watch(weekOffset, () => (notice.value = null))

function openCell(date: string, day: SlotBooking[], cell: Cell) {
  notice.value = null
  sheet.value = { date, start: cell.time, lane: cell.lane, day, booking: null }
  sheetOpen.value = true
}
function openBooking(date: string, day: SlotBooking[], booking: SlotBooking) {
  notice.value = null
  sheet.value = {
    date,
    start: timeLabel(booking.start_time),
    lane: booking.part,
    day,
    booking,
  }
  sheetOpen.value = true
}
const blockActive = (date: string, block: Block) =>
  canManage(block.booking) && !timeStarted(block.booking.start_time, date)

function onBooked(result: BookResult) {
  notice.value =
    result.skipped > 0
      ? t('schedule.bookedSkipped', { n: result.booked, skipped: result.skipped })
      : t('schedule.booked', result.booked)
}

const dayShort = (date: string) => formatDate(parseISO(date), locale.value, 'EEEEEE d.M.')
const partLabel = (lane: Lane) => t(`schedule.parts.${lane}`)
function cellLabel(date: string, cell: Cell) {
  return t('schedule.freeCell', {
    day: dayShort(date),
    time: cell.time,
    part: lanes.value.length > 1 ? partLabel(cell.lane) : (pitch.value?.name ?? ''),
  })
}
function blockLabel(date: string, block: Block) {
  const b = block.booking
  return `${dayShort(date)}, ${timeLabel(b.start_time)}–${timeLabel(b.end_time)}, ${partLabel(b.part)}: ${teamName(b.team_id)}`
}
const dayName = (date: string) => formatDate(parseISO(date), locale.value, 'EEEEEE')
const dayNumber = (date: string) => formatDate(parseISO(date), locale.value, 'd')
const dayLong = (date: string) => formatDate(parseISO(date), locale.value, 'EEEE, d. MMMM')
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
      <UiSkeleton shape="block" height="420px" />
    </div>
    <p v-else-if="loadFailed" class="schedule__error" role="alert">
      {{ t('schedule.loadFailed') }}
    </p>

    <UiEmptyState
      v-else-if="!allPitches.length"
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
      <UiSegmented
        v-if="allPitches.length > 1"
        v-model="pitchId"
        as="radio"
        :label="t('schedule.pitchFilter')"
        :options="pitchOptions"
      />

      <div class="schedule__calendar" :style="{ '--rows': rows.length, '--lanes': lanes.length }">
        <!-- Day header: stays below the top bar while scrolling -->
        <div class="schedule__days" aria-hidden="true">
          <span class="schedule__corner" />
          <span
            v-for="column in columns"
            :key="`h-${column.date}`"
            class="schedule__day-head"
            :class="{ 'schedule__day-head--today': column.date === today }"
          >
            <span class="schedule__day-name">{{ dayName(column.date) }}</span>
            <span class="schedule__day-number">{{ dayNumber(column.date) }}</span>
            <span v-if="lanes.length > 1" class="schedule__lanes">
              <span v-for="lane in lanes" :key="lane">{{ lane.toUpperCase() }}</span>
            </span>
          </span>
        </div>

        <div class="schedule__body">
          <!-- Grid lines and times, one row per half hour -->
          <div
            v-for="(time, i) in rows"
            :key="time"
            class="schedule__row"
            :class="{ 'schedule__row--hour': time.endsWith(':00') }"
            :style="{ gridRow: i + 1 }"
            aria-hidden="true"
          >
            <span v-if="time.endsWith(':00')" class="schedule__hour">{{ time }}</span>
          </div>

          <section
            v-for="(column, c) in columns"
            :key="column.date"
            class="schedule__day"
            :class="{ 'schedule__day--today': column.date === today }"
            :style="{ gridColumn: c + 2 }"
            :aria-label="dayLong(column.date)"
          >
            <!-- Free half hours -->
            <component
              :is="cell.bookable ? 'button' : 'span'"
              v-for="cell in column.cells"
              :key="`${cell.lane}-${cell.time}`"
              :type="cell.bookable ? 'button' : undefined"
              class="schedule__free"
              :class="{ 'schedule__free--past': !cell.bookable }"
              :style="{ gridRow: cell.row, gridColumn: lanes.indexOf(cell.lane) + 1 }"
              :aria-label="cell.bookable ? cellLabel(column.date, cell) : undefined"
              :aria-hidden="cell.bookable ? undefined : 'true'"
              @click="cell.bookable && openCell(column.date, column.day, cell)"
            >
              <UiIcon v-if="cell.bookable" name="plus" :size="14" class="schedule__plus" />
            </component>

            <!-- Bookings -->
            <component
              :is="blockActive(column.date, block) ? 'button' : 'div'"
              v-for="block in column.blocks"
              :key="block.booking.id"
              :type="blockActive(column.date, block) ? 'button' : undefined"
              :role="blockActive(column.date, block) ? undefined : 'img'"
              class="schedule__block"
              :class="{
                'schedule__block--own': ownTeamIds.has(block.booking.team_id),
                'schedule__block--past': timeStarted(block.booking.start_time, column.date),
              }"
              :style="{
                gridRow: `${block.rowStart} / ${block.rowEnd}`,
                gridColumn: block.lanes,
                ...teamStyle(block.booking.team_id),
              }"
              :aria-label="
                blockActive(column.date, block) ? undefined : blockLabel(column.date, block)
              "
              @click="
                blockActive(column.date, block) &&
                openBooking(column.date, column.day, block.booking)
              "
            >
              <span v-if="blockActive(column.date, block)" class="visually-hidden">{{
                blockLabel(column.date, block)
              }}</span>
              <span class="schedule__team" aria-hidden="true">
                {{ teamShortName(teamName(block.booking.team_id)) }}
              </span>
              <span
                v-if="block.rowEnd - block.rowStart >= 2"
                class="schedule__time"
                aria-hidden="true"
              >
                {{ timeLabel(block.booking.start_time) }}
              </span>
            </component>
          </section>
        </div>
      </div>

      <ul class="schedule__legend" role="list">
        <li v-for="team in legendTeams" :key="team.id">
          <span
            class="schedule__swatch"
            :class="{ 'schedule__swatch--own': team.own }"
            :style="team.own ? undefined : teamStyle(team.id)"
            aria-hidden="true"
            >{{ team.short }}</span
          >
          {{ team.name }}
        </li>
        <li>
          <span class="schedule__swatch schedule__swatch--free" aria-hidden="true">+</span>
          {{ t('schedule.legendFree') }}
        </li>
      </ul>
      <p class="schedule__hint">{{ t('schedule.calendarHint') }}</p>
    </template>

    <BookingSheet
      v-if="sheet && pitch"
      v-model:open="sheetOpen"
      :club-id="clubId"
      :pitch="pitch"
      :date="sheet.date"
      :start="sheet.start"
      :lane="sheet.lane"
      :day="sheet.day"
      :booking="sheet.booking"
      :teams="bookableTeams"
      :team-name="teamName"
      @booked="onBooked"
      @released="notice = t('schedule.released')"
    />
  </section>
</template>

<style scoped lang="scss">
$gutter: 40px;

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
    gap: $space-1;
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
    background: var(--color-surface);
    font-weight: 700;
  }

  &__error {
    color: var(--color-danger);
  }

  // A calendar over the whole width: time column and five day columns.
  &__calendar {
    margin-inline: -$space-2;
    border-radius: $radius-xl;
    background: var(--color-surface);
    box-shadow: var(--shadow-sm, 0 1px 2px rgb(0 0 0 / 6%));
  }

  &__days,
  &__body {
    display: grid;
    grid-template-columns: $gutter repeat(5, minmax(0, 1fr));
  }

  &__days {
    position: sticky;
    top: calc(var(--top-bar-height, 64px) + var(--area-nav-height, 0px));
    z-index: 3;
    padding: $space-2 0 $space-1;
    border-radius: $radius-xl $radius-xl 0 0;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-surface);
  }

  &__day-head {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    line-height: 1;
  }

  &__day-name {
    color: var(--color-text-muted);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  &__day-number {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    font-family: var(--font-display);
    font-size: $font-lg;
    font-weight: 800;
  }

  &__day-head--today &__day-name {
    color: var(--color-text);
  }

  &__day-head--today &__day-number {
    background: var(--color-primary);
    color: var(--color-primary-contrast);
  }

  &__lanes {
    display: grid;
    grid-template-columns: repeat(var(--lanes), minmax(0, 1fr));
    width: 100%;
    margin-top: 2px;
    color: var(--color-text-muted);
    font-size: 10px;
    font-weight: 800;
    text-align: center;
  }

  // Fills the screen below the head; at least 34 px per half hour.
  &__body {
    position: relative;
    grid-template-rows: repeat(var(--rows), minmax(34px, 1fr));
    height: max(
      calc(var(--rows) * 34px),
      calc(
        100dvh - var(--top-bar-height, 64px) - var(--area-nav-height, 0px) - var(
            --nav-offset,
            0px
          ) -
          270px
      )
    );
    margin-bottom: $space-2;
  }

  &__row {
    position: relative;
    grid-column: 1 / -1;
    border-top: 1px dashed color-mix(in srgb, var(--color-border) 80%, transparent);

    &--hour {
      border-top: 1px solid var(--color-border);
    }
  }

  &__hour {
    position: absolute;
    top: 2px;
    left: 0;
    width: $gutter;
    padding-right: 6px;
    color: var(--color-text-muted);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    text-align: right;
  }

  &__day {
    position: relative;
    z-index: 1;
    display: grid;
    grid-row: 1 / -1;
    grid-template-columns: repeat(var(--lanes), minmax(0, 1fr));
    grid-template-rows: repeat(var(--rows), minmax(0, 1fr));
    gap: 0 2px;
    padding: 0 2px;
    border-left: 1px solid var(--color-border);

    &--today {
      background-color: color-mix(in srgb, var(--color-primary) 7%, transparent);
    }
  }

  &__free {
    @include focus-visible;

    display: grid;
    place-items: center;
    margin: 2px 0;
    padding: 0;
    border: 0;
    border-radius: 5px;
    // Visible without hover (phones): a faint tint and plus.
    background: color-mix(in srgb, var(--color-primary) 5%, transparent);
    color: color-mix(in srgb, var(--color-text-muted) 55%, transparent);
    cursor: pointer;
    transition: background-color var(--duration-fast) var(--ease-out);

    &:hover,
    &:focus-visible {
      background: color-mix(in srgb, var(--color-primary) 16%, transparent);
      color: var(--color-text);
    }

    &--past {
      cursor: default;
      background: repeating-linear-gradient(
        135deg,
        transparent 0 4px,
        color-mix(in srgb, var(--color-border) 40%, transparent) 4px 5px
      );
    }
  }

  &__plus {
    opacity: 0.8;
  }

  &__block {
    --team: var(--color-text-muted);

    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 0;
    margin: 2px 0;
    padding: 4px 2px 0;
    overflow: hidden;
    border: 1.5px solid var(--team);
    border-radius: 6px;
    background: color-mix(in srgb, var(--team) 18%, var(--color-surface));
    color: var(--color-text);
    font: inherit;
    line-height: 1.1;
    text-align: center;

    &:is(button) {
      cursor: pointer;

      &:focus-visible {
        @include focus-ring;
      }
    }

    &--own {
      border-color: var(--color-primary);
      background: var(--color-primary);
      color: var(--color-primary-contrast);
    }

    &--past {
      opacity: 0.5;
    }
  }

  &__team {
    font-family: var(--font-display);
    font-size: 12px;
    font-weight: 800;
    letter-spacing: -0.01em;
  }

  &__time {
    margin-top: 2px;
    font-size: 10px;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    opacity: 0.8;
  }

  &__legend {
    display: flex;
    flex-wrap: wrap;
    gap: $space-2 $space-4;
    margin: 0;
    font-size: $font-sm;

    li {
      display: inline-flex;
      align-items: center;
      gap: $space-2;
    }
  }

  &__swatch {
    --team: var(--color-text-muted);

    display: inline-grid;
    place-items: center;
    min-width: 34px;
    height: 22px;
    padding: 0 4px;
    border: 1.5px solid var(--team);
    border-radius: 5px;
    background: color-mix(in srgb, var(--team) 18%, var(--color-surface));
    font-family: var(--font-display);
    font-size: 12px;
    font-weight: 800;

    &--own {
      border-color: var(--color-primary);
      background: var(--color-primary);
      color: var(--color-primary-contrast);
    }

    &--free {
      border: 1.5px dashed var(--color-text-muted);
      background: transparent;
      color: var(--color-text-muted);
    }
  }

  &__hint {
    color: var(--color-text-muted);
    font-size: $font-sm;
  }
}
</style>
