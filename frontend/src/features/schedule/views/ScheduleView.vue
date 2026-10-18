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
import SlotSheet from '../components/SlotSheet.vue'
import type { BookResult } from '../api'
import { useBookings, useClubTeamNames, usePitches, useSlots } from '../composables/useSchedule'
import {
  blockTarget,
  calendarHours,
  isoDate,
  slotBox,
  slotCells,
  slotStarted,
  slotsOn,
  teamShortName,
  timeLabel,
  weekDates,
  type Pitch,
  type PitchSlot,
  type SlotBooking,
  type SlotCell,
} from '../logic'

/**
 * The club's pitch schedule as a week calendar that fits the screen: seven day columns, one
 * pitch at a time (switch above), halves A and B side by side. Teams are colored blocks with a
 * short name and a legend; the own team in the accent color, free times dashed. Tapping a
 * block books a free part or releases an own one. Club of the active team.
 */
const { t, locale } = useI18n()
const { myTeams, activeTeam } = useActiveTeam()
const clubId = computed(() => activeTeam.value?.club_id ?? '')
const pitches = usePitches(clubId)
const slots = useSlots(clubId)
const teamNames = useClubTeamNames(clubId)
const myClubs = useMyClubs()

const HOUR = 44 // px per hour
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

// One pitch at a time; the one with the most times this week comes first.
const allPitches = computed(() =>
  [...(pitches.data.value ?? [])].sort((a, b) => a.sort_order - b.sort_order),
)
const chosenPitch = ref<string | null>(null)
const busiestPitch = computed(() => {
  const count = (pitch: Pitch) =>
    days.value.reduce(
      (n, date) =>
        n + slotsOn(slots.data.value ?? [], date).filter((s) => s.pitch_id === pitch.id).length,
      0,
    )
  return [...allPitches.value].sort((a, b) => count(b) - count(a))[0] ?? null
})
const pitch = computed(
  () => allPitches.value.find((p) => p.id === chosenPitch.value) ?? busiestPitch.value,
)
const pitchId = computed({
  get: () => pitch.value?.id ?? '',
  set: (value: string) => (chosenPitch.value = value),
})
const pitchOptions = computed(() => allPitches.value.map((p) => ({ value: p.id, label: p.name })))

const pitchSlots = computed(() =>
  (slots.data.value ?? []).filter((s) => s.pitch_id === pitch.value?.id),
)
const hours = computed(() => calendarHours(pitchSlots.value, days.value))
const hourMarks = computed(() =>
  Array.from({ length: hours.value.to - hours.value.from }, (_, i) => hours.value.from + i),
)

type Block = {
  slot: PitchSlot
  top: number
  height: number
  started: boolean
  cells: SlotCell[]
  target: SlotCell | null
}
const columns = computed(() =>
  days.value.map((date) => {
    const blocks: Block[] = []
    const current = pitch.value
    if (current) {
      for (const slot of slotsOn(pitchSlots.value, date)) {
        const box = slotBox(slot, hours.value.from)
        const started = slotStarted(slot, date)
        const cells = slotCells(slot, current, bookings.data.value ?? [], date)
        blocks.push({
          slot,
          top: box.top * HOUR,
          height: box.height * HOUR,
          started,
          cells,
          target: started || !bookableTeams.value.length ? null : blockTarget(cells, canManage),
        })
      }
    }
    return { date, blocks }
  }),
)

/** Teams that appear this week (for the legend). */
const legendTeams = computed(() => {
  const ids = new Set<string>()
  for (const column of columns.value)
    for (const block of column.blocks)
      for (const cell of block.cells) if (cell.booking) ids.add(cell.booking.team_id)
  return [...ids].map((id) => ({
    id,
    name: teamName(id),
    short: teamShortName(teamName(id)),
    own: ownTeamIds.value.has(id),
  }))
})

const isLoading = computed(
  () => pitches.isPending.value || slots.isPending.value || bookings.isPending.value,
)
const loadFailed = computed(
  () => pitches.isError.value || slots.isError.value || bookings.isError.value,
)

// Sheet
const sheet = ref<{ slot: PitchSlot; cells: SlotCell[]; cell: SlotCell; date: string } | null>(null)
const sheetOpen = ref(false)
const notice = ref<string | null>(null)
watch(weekOffset, () => (notice.value = null))

function openBlock(block: Block, date: string) {
  if (!block.target) return
  notice.value = null
  sheet.value = { slot: block.slot, cells: block.cells, cell: block.target, date }
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
/** Full description for screen readers: day, time, pitch and every part. */
function blockLabel(block: Block, date: string) {
  const time = `${timeLabel(block.slot.start_time)}–${timeLabel(block.slot.end_time)}`
  const parts = block.cells
    .map((cell) =>
      cell.part === 'full' ? cellText(cell) : `${cell.part.toUpperCase()} ${cellText(cell)}`,
    )
    .join(', ')
  return `${formatDate(parseISO(date), locale.value, 'EEEEEE d.M.')}, ${time}, ${pitch.value?.name}: ${parts}`
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
      <UiSkeleton shape="block" height="360px" />
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
      <UiSegmented
        v-if="allPitches.length > 1"
        v-model="pitchId"
        as="radio"
        :label="t('schedule.pitchFilter')"
        :options="pitchOptions"
      />

      <div class="schedule__calendar" :style="{ '--hour': `${HOUR}px` }">
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
          </span>
        </div>

        <div class="schedule__body" :style="{ height: `${(hours.to - hours.from) * HOUR}px` }">
          <div class="schedule__hours" aria-hidden="true">
            <span
              v-for="(hour, i) in hourMarks"
              :key="hour"
              class="schedule__hour"
              :style="{ top: `${i * HOUR}px` }"
            >
              {{ hour }}
            </span>
          </div>

          <section
            v-for="column in columns"
            :key="column.date"
            class="schedule__day"
            :class="{ 'schedule__day--today': column.date === today }"
            :aria-label="dayLong(column.date)"
          >
            <component
              :is="block.target ? 'button' : 'div'"
              v-for="block in column.blocks"
              :key="block.slot.id"
              :type="block.target ? 'button' : undefined"
              :role="block.target ? undefined : 'img'"
              class="schedule__block"
              :class="{
                'schedule__block--past': block.started,
                'schedule__block--action': !!block.target,
              }"
              :style="{ top: `${block.top}px`, height: `${block.height}px` }"
              :aria-label="block.target ? undefined : blockLabel(block, column.date)"
              @click="openBlock(block, column.date)"
            >
              <!-- Buttons are named by their (hidden) text, so the name contains what is seen. -->
              <span v-if="block.target" class="visually-hidden">{{
                blockLabel(block, column.date)
              }}</span>
              <span
                v-for="cell in block.cells"
                :key="cell.part"
                class="schedule__cell"
                :class="{
                  'schedule__cell--free': !cell.booking,
                  'schedule__cell--own': cell.booking && ownTeamIds.has(cell.booking.team_id),
                }"
                :style="cell.booking ? teamStyle(cell.booking.team_id) : undefined"
                aria-hidden="true"
              >
                <span v-if="cell.part !== 'full'" class="schedule__part">
                  {{ cell.part.toUpperCase() }}
                </span>
                <span v-if="cell.booking" class="schedule__team">
                  {{ teamShortName(teamName(cell.booking.team_id)) }}
                </span>
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
          <span class="schedule__swatch schedule__swatch--free" aria-hidden="true" />
          {{ t('schedule.legendFree') }}
        </li>
      </ul>
      <p class="schedule__hint">{{ t('schedule.calendarHint') }}</p>
    </template>

    <SlotSheet
      v-if="sheet && pitch"
      v-model:open="sheetOpen"
      :club-id="clubId"
      :pitch-slot="sheet.slot"
      :pitch="pitch"
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
$gutter: 26px;

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

  // The whole week on one screen: full width, seven equal columns.
  &__calendar {
    margin-inline: -$space-2;
    border-radius: $radius-xl;
    background: var(--color-surface);
    box-shadow: var(--shadow-sm, 0 1px 2px rgb(0 0 0 / 6%));
  }

  &__days,
  &__body {
    display: grid;
    grid-template-columns: $gutter repeat(7, minmax(0, 1fr));
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

  &__body {
    position: relative;
    margin-bottom: $space-2;
  }

  &__hours {
    position: relative;
  }

  &__hour {
    position: absolute;
    right: 4px;
    color: var(--color-text-muted);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    transform: translateY(-50%);

    &:first-child {
      transform: translateY(2px);
    }
  }

  &__day {
    position: relative;
    // Hour lines.
    background-image: linear-gradient(
      to bottom,
      color-mix(in srgb, var(--color-border) 70%, transparent) 1px,
      transparent 1px
    );
    background-size: 100% var(--hour);

    &--today {
      background-color: color-mix(in srgb, var(--color-primary) 7%, transparent);
    }
  }

  &__block {
    position: absolute;
    inset-inline: 2px;
    display: flex;
    gap: 2px;
    padding: 0;
    border: 0;
    background: transparent;
    font: inherit;
    text-align: left;

    &--action {
      cursor: pointer;

      &:focus-visible {
        @include focus-ring;

        border-radius: 8px;
      }
    }

    &--past {
      opacity: 0.45;
    }
  }

  &__cell {
    --team: var(--color-text-muted);

    display: flex;
    flex: 1 1 0;
    flex-direction: column;
    align-items: center;
    min-width: 0;
    padding-top: 3px;
    overflow: hidden;
    border: 1.5px solid var(--team);
    border-radius: 6px;
    background: color-mix(in srgb, var(--team) 18%, var(--color-surface));
    color: var(--color-text);
    line-height: 1.1;

    &--own {
      border-color: var(--color-primary);
      background: var(--color-primary);
      color: var(--color-primary-contrast);
    }

    &--free {
      border: 1.5px dashed color-mix(in srgb, var(--color-text-muted) 60%, transparent);
      background: transparent;
      color: var(--color-text-muted);
    }
  }

  &__part {
    font-size: 10px;
    font-weight: 800;
    opacity: 0.75;
  }

  &__team {
    font-family: var(--font-display);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: -0.02em;
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
    }
  }

  &__hint {
    color: var(--color-text-muted);
    font-size: $font-sm;
  }
}
</style>
