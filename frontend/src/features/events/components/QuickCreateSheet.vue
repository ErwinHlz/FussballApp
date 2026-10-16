<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { addDays, format } from 'date-fns'
import BottomSheet from '@/ui/BottomSheet.vue'
import UiButton from '@/ui/UiButton.vue'
import UiChip from '@/ui/UiChip.vue'
import UiIcon, { type UiIconName } from '@/ui/UiIcon.vue'
import UiInput from '@/ui/UiInput.vue'
import { useSnackbar } from '@/ui/useSnackbar'
import { formatDate } from '@/lib/date'
import type { EventInput } from '../api'
import { useCreateEvent } from '../composables/useEvents'
import { combineDateTime } from '../schemas'
import { deadlineFromHours, suggestDate, suggestDefaults, type EventRow } from '../logic'

type Kind = 'training' | 'series' | 'match' | 'event'
type QuickKind = Exclude<Kind, 'series'>

/**
 * "+" flow: pick the type, check the suggested date, done. Place, time, length and deadline
 * come from the last event of the same type; "Alles anpassen" opens the full form with them.
 * Series go to the full form right away.
 */
const props = defineProps<{ teamId: string | null; events: EventRow[] }>()
const open = defineModel<boolean>('open', { default: false })

const { t, locale } = useI18n()
const router = useRouter()
const snackbar = useSnackbar()
const createEvent = useCreateEvent(() => props.teamId)

const kind = ref<QuickKind | null>(null)
const date = ref('')
const time = ref('')
const title = ref('')
const opponent = ref('')
const isHome = ref(true)
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

const defaults = computed(() => (kind.value ? suggestDefaults(props.events, kind.value) : null))

// Fresh start every time the sheet opens.
watch(open, (isOpen) => {
  if (!isOpen) return
  kind.value = null
  tried.value = false
})

// Suggested date and time; set again when the events arrive late, unless already edited.
let suggested = { date: '', time: '' }
function applySuggestion() {
  if (!kind.value) return
  const d = suggestDefaults(props.events, kind.value)
  suggested = { date: suggestDate(d.weekday), time: d.time }
  date.value = suggested.date
  time.value = suggested.time
}
watch(
  () => props.events,
  () => {
    if (kind.value && date.value === suggested.date && time.value === suggested.time) {
      applySuggestion()
    }
  },
)

function choose(next: Kind) {
  if (next === 'series') {
    open.value = false
    void router.push({ name: 'event-new', params: { kind: 'series' } })
    return
  }
  kind.value = next
  applySuggestion()
  title.value = ''
  opponent.value = ''
  isHome.value = true
  tried.value = false
  void showSelectedDay()
}

// The suggested day may be further right in the strip: bring it into view.
const daysEl = ref<HTMLElement | null>(null)
async function showSelectedDay() {
  await nextTick()
  daysEl.value
    ?.querySelector<HTMLElement>('[aria-pressed="true"]')
    ?.scrollIntoView({ block: 'nearest', inline: 'center' })
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

const summary = computed(() => {
  const d = defaults.value
  if (!d || !kind.value) return []
  const rows: { label: string; value: string }[] = []
  if (d.location) rows.push({ label: t('events.form.location'), value: d.location })
  if (kind.value !== 'match')
    rows.push({
      label: t('events.quick.duration'),
      value: t('plan.minutesShort', { n: d.durationMin }),
    })
  if (d.deadlineHours !== null)
    rows.push({
      label: t('events.form.deadline'),
      value: t('events.form.hoursBefore', d.deadlineHours),
    })
  if (kind.value === 'match' && (d.meetOffsetMin !== null || d.meetLocation)) {
    const parts = [
      d.meetOffsetMin !== null ? t('events.quick.minutesBefore', { n: d.meetOffsetMin }) : null,
      d.meetLocation,
    ].filter(Boolean)
    rows.push({ label: t('events.meet'), value: parts.join(' · ') })
  }
  return rows
})

const missing = computed(() => {
  if (!date.value || !time.value) return true
  if (kind.value === 'event' && !title.value.trim()) return true
  if (kind.value === 'match' && !opponent.value.trim()) return true
  return false
})

function input(): EventInput {
  const d = defaults.value!
  const startsAt = combineDateTime(date.value, time.value)
  const deadline = deadlineFromHours(startsAt, d.deadlineHours)?.toISOString() ?? null
  if (kind.value === 'match') {
    return {
      type: 'match',
      starts_at: startsAt.toISOString(),
      ends_at: null,
      meet_at:
        d.meetOffsetMin !== null
          ? new Date(startsAt.getTime() - d.meetOffsetMin * 60000).toISOString()
          : null,
      meet_location: d.meetLocation,
      location: d.location,
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
    location: d.location,
    notes: null,
    response_deadline: deadline,
  }
}

async function create() {
  tried.value = true
  if (missing.value || !kind.value) return
  const created = await createEvent.mutateAsync(input())
  const label = t(`events.quick.created.${kind.value}`)
  open.value = false
  await router.push({ name: 'event', params: { eventId: created.id } })
  snackbar.show({ text: label })
}

/** Full form with what was chosen so far. */
function customize() {
  if (!kind.value) return
  const d = defaults.value!
  const query: Record<string, string> = { date: date.value, time: time.value }
  if (d.location) query.location = d.location
  if (kind.value !== 'match') query.duration = String(d.durationMin)
  if (d.deadlineHours !== null) query.deadline = String(d.deadlineHours)
  if (kind.value === 'event' && title.value) query.title = title.value
  if (kind.value === 'match') {
    if (opponent.value) query.opponent = opponent.value
    query.venue = isHome.value ? 'home' : 'away'
    if (d.meetLocation) query.meetLocation = d.meetLocation
  }
  open.value = false
  void router.push({ name: 'event-new', params: { kind: kind.value }, query })
}

const sheetTitle = computed(() =>
  kind.value ? t(`events.form.newTitle.${kind.value}`) : t('events.createLabel'),
)
</script>

<template>
  <BottomSheet v-model:open="open" :title="sheetTitle">
    <ul v-if="!kind" class="quick__options" role="list">
      <li v-for="option in options" :key="option.kind">
        <button
          type="button"
          class="quick__option"
          :class="`quick__option--${option.kind}`"
          @click="choose(option.kind)"
        >
          <span class="quick__option-icon" aria-hidden="true">
            <UiIcon :name="option.icon" :size="24" />
          </span>
          <span class="quick__option-text">
            <span class="quick__option-label">{{ t(option.labelKey) }}</span>
            <span class="quick__option-hint">{{ t(option.hintKey) }}</span>
          </span>
        </button>
      </li>
    </ul>

    <form v-else class="quick" novalidate @submit.prevent="create">
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
        <div class="quick__row" role="group" :aria-label="t('events.form.venue')">
          <UiChip :model-value="isHome" @update:model-value="isHome = true">
            {{ t('events.home') }}
          </UiChip>
          <UiChip :model-value="!isHome" @update:model-value="isHome = false">
            {{ t('events.away') }}
          </UiChip>
        </div>
      </template>

      <fieldset class="quick__fieldset">
        <legend class="quick__legend">{{ t('events.form.date') }}</legend>
        <div ref="daysEl" class="quick__days">
          <button
            v-for="day in days"
            :key="day.value"
            type="button"
            class="quick__day"
            :aria-pressed="date === day.value"
            @click="date = day.value"
          >
            <span aria-hidden="true">{{ day.short }}</span>
            <span class="visually-hidden">{{ day.long }}</span>
          </button>
        </div>
      </fieldset>
      <div class="quick__row quick__row--fields">
        <UiInput v-model="date" :label="t('events.quick.otherDate')" type="date" />
        <UiInput
          v-model="time"
          :label="kind === 'match' ? t('events.form.kickoff') : t('events.form.startTime')"
          type="time"
        />
      </div>

      <dl v-if="summary.length" class="quick__summary">
        <p class="quick__summary-title">{{ t('events.quick.fromLast') }}</p>
        <div v-for="row in summary" :key="row.label" class="quick__summary-row">
          <dt>{{ row.label }}</dt>
          <dd>{{ row.value }}</dd>
        </div>
      </dl>
      <p v-if="createEvent.isError.value" class="quick__error" role="alert">
        {{ t('events.form.saveFailed') }}
      </p>
      <button type="button" class="quick__more" @click="customize">
        {{ t('events.quick.customize') }}
      </button>
    </form>

    <template v-if="kind" #footer>
      <UiButton variant="secondary" @click="kind = null">{{ t('common.back') }}</UiButton>
      <UiButton :loading="createEvent.isPending.value" @click="create">
        {{ t('events.quick.create') }}
      </UiButton>
    </template>
  </BottomSheet>
</template>

<style scoped lang="scss">
.quick {
  display: flex;
  flex-direction: column;
  gap: $space-4;

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
    min-height: 68px;
    padding: $space-3;
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
    width: 44px;
    height: 44px;
    border: 2px dashed var(--color-chalk);
    border-radius: 50%;
    color: var(--option-color);
  }

  &__option-text {
    display: flex;
    flex-direction: column;
  }

  &__option-label {
    font-weight: 800;
  }

  &__option-hint {
    color: var(--color-text-muted);
    font-size: $font-sm;
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
    margin: 0;
    padding: 0;
    border: 0;
  }

  &__legend {
    margin-bottom: $space-2;
    font-size: $font-sm;
    font-weight: 700;
  }

  &__days {
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
