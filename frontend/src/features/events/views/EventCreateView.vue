<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { addDays, format } from 'date-fns'
import ActionBar from '@/ui/ActionBar.vue'
import UiButton from '@/ui/UiButton.vue'
import UiChip from '@/ui/UiChip.vue'
import UiIcon, { type UiIconName } from '@/ui/UiIcon.vue'
import UiInput from '@/ui/UiInput.vue'
import { useSnackbar } from '@/ui/useSnackbar'
import { formatDate } from '@/lib/date'
import { useActiveTeam } from '@/features/teams/composables/useActiveTeam'
import type { EventInput } from '../api'
import LocationField from '../components/LocationField.vue'
import { useCreateEvent, useTeamEvents } from '../composables/useEvents'
import { combineDateTime } from '../schemas'
import {
  deadlineFromHours,
  deadlineOffset,
  placeSuggestions,
  shiftTime,
  suggestDate,
  suggestDefaults,
} from '../logic'

type Kind = 'training' | 'series' | 'match' | 'event'
type QuickKind = Exclude<Kind, 'series'>

/**
 * "+" page: pick the type, check date, time and place, done. Length and deadline come from the
 * last event of the same type; "Alles anpassen" opens the full form with everything chosen.
 * The type sits in the address (?kind=), so the back button returns to the choice.
 * Series go to the full form right away.
 */
const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const snackbar = useSnackbar()
const { activeTeam } = useActiveTeam()
const teamId = computed(() => activeTeam.value?.team_id ?? null)
const events = useTeamEvents(teamId)
const allEvents = computed(() => events.data.value ?? [])
const createEvent = useCreateEvent(teamId)

const kind = computed<QuickKind | null>(() => {
  const value = route.query.kind
  return value === 'training' || value === 'match' || value === 'event' ? value : null
})

const date = ref('')
const time = ref('')
const title = ref('')
const opponent = ref('')
const isHome = ref(true)
const location = ref('')
const meetTime = ref('')
const meetLocation = ref('')
const tried = ref(false)

const options: { kind: Kind; icon: UiIconName; labelKey: string; hintKey: string }[] = [
  {
    kind: 'training',
    icon: 'cone',
    labelKey: 'events.newTraining',
    hintKey: 'events.newTrainingHint',
  },
  {
    kind: 'series',
    icon: 'calendar',
    labelKey: 'events.newSeries',
    hintKey: 'events.newSeriesHint',
  },
  { kind: 'match', icon: 'users', labelKey: 'events.newMatch', hintKey: 'events.newMatchHint' },
  { kind: 'event', icon: 'star', labelKey: 'events.newEvent', hintKey: 'events.newEventHint' },
]

const defaults = computed(() => (kind.value ? suggestDefaults(allEvents.value, kind.value) : null))
const places = computed(() => placeSuggestions(allEvents.value))
const meetOffset = computed(() => defaults.value?.meetOffsetMin ?? 60)

// Suggestions from the last event of the type; set again when the events arrive late, unless
// the coach already changed them.
let suggested = { date: '', time: '', location: '', meetLocation: '' }
function applySuggestion() {
  if (!kind.value) return
  const d = suggestDefaults(allEvents.value, kind.value)
  suggested = {
    date: suggestDate(d.weekday),
    time: d.time,
    location: d.location ?? '',
    meetLocation: d.meetLocation ?? '',
  }
  date.value = suggested.date
  time.value = suggested.time
  location.value = suggested.location
  meetLocation.value = suggested.meetLocation
  meetTime.value = kind.value === 'match' ? shiftTime(d.time, -meetOffset.value) : ''
}
function untouched() {
  return (
    date.value === suggested.date &&
    time.value === suggested.time &&
    location.value === suggested.location &&
    meetLocation.value === suggested.meetLocation
  )
}
watch(
  kind,
  (next) => {
    tried.value = false
    title.value = ''
    opponent.value = ''
    isHome.value = true
    if (next) applySuggestion()
  },
  { immediate: true },
)
watch(allEvents, () => {
  if (kind.value && untouched()) applySuggestion()
})

// Meeting time follows the kick-off until it is changed by hand.
let meetEdited = false
watch(kind, () => (meetEdited = false))
watch(time, (next, previous) => {
  if (kind.value !== 'match' || meetEdited || !next) return
  if (!previous || meetTime.value === shiftTime(previous, -meetOffset.value) || !meetTime.value)
    meetTime.value = shiftTime(next, -meetOffset.value)
})
function onMeetTime(value: string) {
  meetEdited = true
  meetTime.value = value
}

function choose(next: Kind) {
  if (next === 'series') {
    void router.push({ name: 'event-new', params: { kind: 'series' } })
    return
  }
  void router.push({ name: 'event-create', query: { kind: next } })
}

// The suggested day may be further right in the strip: bring it into view.
const daysEl = ref<HTMLElement | null>(null)
async function showSelectedDay() {
  await nextTick()
  const strip = daysEl.value
  const day = strip?.querySelector<HTMLElement>('[aria-pressed="true"]')
  // Only the strip scrolls (scrollIntoView would also move the page).
  if (strip && day) strip.scrollLeft = day.offsetLeft - (strip.clientWidth - day.offsetWidth) / 2
}
watch(date, () => void showSelectedDay())

// Quick picks: the next seven days.
const days = computed(() =>
  Array.from({ length: 7 }, (_, i) => {
    const d = addDays(new Date(), i + 1)
    return {
      value: format(d, 'yyyy-MM-dd'),
      short: formatDate(d, locale.value, 'EEEEEE d.M.'),
      long: formatDate(d, locale.value, 'EEEE, d. MMMM'),
    }
  }),
)

function offsetLabel(hours: number) {
  const { unit, n } = deadlineOffset(hours)
  return unit === 'days' ? t('events.form.offsetDays', n) : t('events.form.offsetHours', { n })
}

/** What is taken over without asking (length and deadline). */
const summary = computed(() => {
  const d = defaults.value
  if (!d || !kind.value) return []
  const rows: { label: string; value: string }[] = []
  if (kind.value !== 'match')
    rows.push({
      label: t('events.quick.duration'),
      value: t('plan.minutesShort', { n: d.durationMin }),
    })
  rows.push({
    label: t('events.form.deadlineBefore'),
    value: d.deadlineHours === null ? t('events.form.noDeadline') : offsetLabel(d.deadlineHours),
  })
  return rows
})

const missing = computed(() => {
  if (!date.value || !time.value) return true
  if (kind.value === 'event' && !title.value.trim()) return true
  if (kind.value === 'match' && !opponent.value.trim()) return true
  return false
})

const text = (value: string) => value.trim() || null

function input(): EventInput {
  const d = defaults.value!
  const startsAt = combineDateTime(date.value, time.value)
  const deadline = deadlineFromHours(startsAt, d.deadlineHours)?.toISOString() ?? null
  if (kind.value === 'match') {
    let meetAt: Date | null = null
    if (meetTime.value) {
      meetAt = combineDateTime(date.value, meetTime.value)
      // Meeting before midnight for an early kick-off: the day before.
      if (meetAt > startsAt) meetAt = new Date(meetAt.getTime() - 86_400_000)
    }
    return {
      type: 'match',
      starts_at: startsAt.toISOString(),
      ends_at: null,
      meet_at: meetAt?.toISOString() ?? null,
      meet_location: text(meetLocation.value),
      location: text(location.value),
      notes: null,
      response_deadline: deadline,
      opponent: opponent.value.trim(),
      is_home: isHome.value,
      competition: 'league',
    }
  }
  return {
    type: kind.value === 'event' ? 'event' : 'training',
    ...(kind.value === 'event' ? { title: title.value.trim() } : {}),
    starts_at: startsAt.toISOString(),
    ends_at: new Date(startsAt.getTime() + d.durationMin * 60000).toISOString(),
    location: text(location.value),
    notes: null,
    response_deadline: deadline,
  }
}

async function create() {
  tried.value = true
  if (missing.value || !kind.value) return
  const created = await createEvent.mutateAsync(input())
  const label = t(`events.quick.created.${kind.value}`)
  await router.replace({ name: 'event', params: { eventId: created.id } })
  snackbar.show({ text: label })
}

/** Full form with what was chosen so far. */
function customize() {
  if (!kind.value) return
  const d = defaults.value!
  const query: Record<string, string> = { date: date.value, time: time.value }
  if (location.value.trim()) query.location = location.value.trim()
  if (kind.value !== 'match') query.duration = String(d.durationMin)
  if (d.deadlineHours !== null) query.deadline = String(d.deadlineHours)
  if (kind.value === 'event' && title.value) query.title = title.value
  if (kind.value === 'match') {
    if (opponent.value) query.opponent = opponent.value
    query.venue = isHome.value ? 'home' : 'away'
    if (meetTime.value) query.meetTime = meetTime.value
    if (meetLocation.value.trim()) query.meetLocation = meetLocation.value.trim()
  }
  void router.push({ name: 'event-new', params: { kind: kind.value }, query })
}

const heading = computed(() =>
  kind.value ? t(`events.form.newTitle.${kind.value}`) : t('events.createLabel'),
)
</script>

<template>
  <section class="create">
    <h1>{{ heading }}</h1>

    <ul v-if="!kind" class="create__options" role="list">
      <li v-for="option in options" :key="option.kind">
        <button
          type="button"
          class="create__option"
          :class="`create__option--${option.kind}`"
          @click="choose(option.kind)"
        >
          <span class="create__option-icon" aria-hidden="true">
            <UiIcon :name="option.icon" :size="24" />
          </span>
          <span class="create__option-text">
            <span class="create__option-label">{{ t(option.labelKey) }}</span>
            <span class="create__option-hint">{{ t(option.hintKey) }}</span>
          </span>
          <UiIcon name="chevronRight" :size="20" class="create__option-chevron" />
        </button>
      </li>
    </ul>

    <form v-else class="create__form" novalidate @submit.prevent="create">
      <UiInput
        v-if="kind === 'event'"
        v-model="title"
        :label="t('events.form.eventTitle')"
        :placeholder="t('events.form.eventTitlePlaceholder')"
        required
        :error="tried && !title.trim() ? t('validation.required') : undefined"
      />
      <template v-if="kind === 'match'">
        <UiInput
          v-model="opponent"
          :label="t('events.form.opponent')"
          required
          :error="tried && !opponent.trim() ? t('validation.required') : undefined"
        />
        <div class="create__row" role="group" :aria-label="t('events.form.venue')">
          <UiChip :model-value="isHome" @update:model-value="isHome = true">
            {{ t('events.home') }}
          </UiChip>
          <UiChip :model-value="!isHome" @update:model-value="isHome = false">
            {{ t('events.away') }}
          </UiChip>
        </div>
      </template>

      <fieldset class="create__fieldset">
        <legend class="create__legend">{{ t('events.form.date') }}</legend>
        <div ref="daysEl" class="create__days">
          <button
            v-for="day in days"
            :key="day.value"
            type="button"
            class="create__day"
            :aria-pressed="date === day.value"
            @click="date = day.value"
          >
            <span aria-hidden="true">{{ day.short }}</span>
            <span class="visually-hidden">{{ day.long }}</span>
          </button>
        </div>
      </fieldset>
      <div class="create__row create__row--fields">
        <UiInput v-model="date" :label="t('events.quick.otherDate')" type="date" />
        <UiInput
          v-model="time"
          :label="kind === 'match' ? t('events.form.kickoff') : t('events.form.startTime')"
          type="time"
        />
      </div>

      <!-- Match: meeting point (time and place) before the venue -->
      <fieldset v-if="kind === 'match'" class="create__fieldset create__meet">
        <legend class="create__legend">{{ t('events.meet') }}</legend>
        <UiInput
          :model-value="meetTime"
          :label="t('events.form.meetTime')"
          type="time"
          :hint="t('events.quick.meetHint')"
          @update:model-value="onMeetTime"
        />
        <LocationField
          v-model="meetLocation"
          :label="t('events.form.meetLocation')"
          :suggestions="places"
        />
      </fieldset>

      <LocationField
        v-model="location"
        :label="kind === 'match' ? t('events.form.venueLocation') : t('events.form.location')"
        :suggestions="places"
      />

      <div v-if="summary.length" class="create__summary">
        <p class="create__summary-title">{{ t('events.quick.fromLast') }}</p>
        <dl class="create__summary-list">
          <div v-for="row in summary" :key="row.label" class="create__summary-row">
            <dt>{{ row.label }}</dt>
            <dd>{{ row.value }}</dd>
          </div>
        </dl>
      </div>
      <p v-if="createEvent.isError.value" class="create__error" role="alert">
        {{ t('events.form.saveFailed') }}
      </p>
      <button type="button" class="create__more" @click="customize">
        {{ t('events.quick.customize') }}
      </button>
    </form>

    <ActionBar v-if="kind" :label="heading">
      <UiButton block :loading="createEvent.isPending.value" @click="create">
        {{ t('events.quick.create') }}
      </UiButton>
    </ActionBar>
  </section>
</template>

<style scoped lang="scss">
.create {
  display: flex;
  flex-direction: column;
  gap: $space-4;

  &__form {
    display: flex;
    flex-direction: column;
    gap: $space-4;
  }

  &__options {
    display: flex;
    flex-direction: column;
    gap: $space-2;
    margin: 0;
  }

  &__option {
    --option-color: var(--color-training-text);

    @include focus-visible;

    display: flex;
    align-items: center;
    gap: $space-3;
    width: 100%;
    min-height: 76px;
    padding: $space-3 $space-4;
    border: 0;
    border-radius: $radius-lg;
    background: var(--color-surface);
    color: var(--color-text);
    text-align: left;

    &--match {
      --option-color: var(--color-match-text);
    }

    &--event {
      --option-color: var(--color-event-text);
    }
  }

  &__option-icon {
    display: grid;
    flex-shrink: 0;
    place-items: center;
    width: 48px;
    height: 48px;
    border: 2px dashed var(--color-chalk);
    border-radius: 50%;
    color: var(--option-color);
  }

  &__option-text {
    display: flex;
    flex: 1;
    flex-direction: column;
  }

  &__option-label {
    font-family: var(--font-display);
    font-size: $font-xl;
    font-weight: 800;
  }

  &__option-hint {
    color: var(--color-text-muted);
    font-size: $font-sm;
  }

  &__option-chevron {
    color: var(--color-text-muted);
  }

  &__row {
    display: flex;
    flex-wrap: wrap;
    gap: $space-2;

    &--fields > * {
      flex: 1 1 140px;
    }
  }

  &__fieldset {
    // Fieldsets are at least as wide as their content; the day strip has to scroll instead.
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }

  &__meet {
    display: flex;
    flex-direction: column;
    gap: $space-3;
    padding: $space-3 $space-4 $space-2;
    border: 2px dashed var(--color-chalk);
    border-radius: $radius-lg;
  }

  &__legend {
    margin-bottom: $space-2;
    font-size: $font-sm;
    font-weight: 700;
  }

  &__meet &__legend {
    padding: 0 $space-1;
  }

  &__days {
    position: relative;
    display: flex;
    gap: $space-2;
    margin: 0 (-$space-4);
    padding: 0 $space-4 $space-1;
    overflow-x: auto;
  }

  &__day {
    @include focus-visible;

    flex-shrink: 0;
    min-width: 76px;
    min-height: 52px;
    padding: 0 $space-2;
    border: 2px solid var(--color-border);
    border-radius: $radius-lg;
    background: var(--color-surface);
    color: var(--color-text);
    font-family: var(--font-display);
    font-size: $font-lg;
    font-weight: 800;

    &[aria-pressed='true'] {
      border-color: var(--color-text);
      background: var(--color-text);
      color: var(--color-bg);
    }
  }

  &__summary {
    display: flex;
    flex-direction: column;
    gap: $space-1;
    margin: 0;
    padding: $space-3 $space-4;
    border: 2px dashed var(--color-chalk);
    border-radius: $radius-lg;
  }

  &__summary-list {
    display: flex;
    flex-direction: column;
    gap: $space-1;
    margin: 0;
  }

  &__summary-title {
    color: var(--color-text-muted);
    font-size: $font-sm;
    font-weight: 700;
  }

  &__summary-row {
    display: flex;
    justify-content: space-between;
    gap: $space-3;

    dt {
      color: var(--color-text-muted);
    }

    dd {
      margin: 0;
      font-weight: 700;
      text-align: right;
    }
  }

  &__more {
    @include focus-visible;

    align-self: flex-start;
    min-height: $touch-target;
    padding: 0;
    border: 0;
    background: none;
    color: var(--color-text);
    font-weight: 800;
    text-decoration: underline;
    text-decoration-color: var(--color-primary);
    text-decoration-thickness: 2px;
    text-underline-offset: 4px;
  }

  &__error {
    color: var(--color-danger);
  }
}
</style>
