<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useLocalStorage, usePreferredReducedMotion, useWindowScroll } from '@vueuse/core'
import BottomSheet from '@/ui/BottomSheet.vue'
import UiButton from '@/ui/UiButton.vue'
import UiChip from '@/ui/UiChip.vue'
import UiEmptyState from '@/ui/UiEmptyState.vue'
import UiIcon, { type UiIconName } from '@/ui/UiIcon.vue'
import UiIconButton from '@/ui/UiIconButton.vue'
import UiSkeleton from '@/ui/UiSkeleton.vue'
import UiSwitch from '@/ui/UiSwitch.vue'
import { useSnackbar } from '@/ui/useSnackbar'
import { formatDate } from '@/lib/date'
import { useActiveTeam } from '@/features/teams/composables/useActiveTeam'
import DeclineSheet from '../components/DeclineSheet.vue'
import EventRow from '../components/EventRow.vue'
import { useAnswer } from '../composables/useAnswer'
import { useAttendAll, useMyMember, useTeamEvents } from '../composables/useEvents'
import { useEventFormat } from '../format'
import {
  activeFilterCount,
  attendAllCandidates,
  DEFAULT_EVENT_FILTER,
  filterEvents,
  groupByWeek,
  splitEvents,
  unansweredEvents,
  type AttendanceStatus,
  type EventFilter,
  type EventTypeFilter,
  type TeamEvent,
  type WeekGroup,
} from '../logic'

const { t, locale } = useI18n()
const router = useRouter()
const fmt = useEventFormat()
const snackbar = useSnackbar()
const { activeTeam, isCoach } = useActiveTeam()
const teamId = computed(() => activeTeam.value?.team_id ?? null)
const events = useTeamEvents(teamId)
const { members, myMember } = useMyMember(teamId)
const memberId = computed(() => myMember.value?.id ?? null)
const playerIds = computed(() =>
  (members.data.value ?? []).filter((m) => m.role === 'player').map((m) => m.id),
)

// Filters are a per-device convenience (remembered in the browser).
const filter = useLocalStorage<EventFilter>(
  'rondo.eventFilter',
  { ...DEFAULT_EVENT_FILTER },
  { mergeDefaults: true },
)
const filterOpen = ref(false)
const filterCount = computed(() => activeFilterCount(filter.value))
const types: EventTypeFilter[] = ['all', 'training', 'match', 'event']
function setType(type: EventTypeFilter) {
  filter.value = { ...filter.value, type }
}
const onlyUnanswered = computed({
  get: () => filter.value.onlyUnanswered,
  set: (value: boolean) => (filter.value = { ...filter.value, onlyUnanswered: value }),
})
function resetFilter() {
  filter.value = { ...DEFAULT_EVENT_FILTER }
}

const allUpcoming = computed(() => splitEvents(events.data.value ?? []).upcoming)
const lists = computed(() =>
  splitEvents(filterEvents(events.data.value ?? [], filter.value, memberId.value)),
)
const weeks = computed(() => groupByWeek(lists.value.upcoming))
const unanswered = computed(() => unansweredEvents(allUpcoming.value, memberId.value))
const filteredAway = computed(
  () => !!events.data.value?.length && !lists.value.upcoming.length && filterCount.value > 0,
)

function weekTitle(week: WeekGroup<TeamEvent>) {
  if (week.kind !== 'week') return t(`events.weeks.${week.kind}`)
  return t('events.weeks.range', {
    from: formatDate(week.start, locale.value, 'd.M.'),
    to: formatDate(week.end, locale.value, 'd.M.'),
  })
}

const { answer, decline, declining } = useAnswer()
function onAnswer(event: TeamEvent, status: AttendanceStatus) {
  if (!memberId.value) return
  const previous = event.attendances.find((a) => a.member_id === memberId.value) ?? null
  const label = `${fmt.title(event)} · ${fmt.weekdayShort(event.starts_at)} ${fmt.dayMonth(event.starts_at)}`
  answer(event, memberId.value, previous, status, label)
}

// "Attend all": every shown date that is still open and not answered yet.
const attendCandidates = computed(() => attendAllCandidates(lists.value.upcoming, memberId.value))
const attendAll = useAttendAll()
const attendOpen = ref(false)
async function confirmAttendAll() {
  try {
    const result = await attendAll.mutateAsync({
      eventIds: attendCandidates.value.map((e) => e.id),
      memberId: memberId.value!,
    })
    snackbar.show({
      text: result.skipped
        ? t('events.attendAll.doneSkipped', { n: result.saved, skipped: result.skipped })
        : t('events.attendAll.done', result.saved),
    })
  } catch {
    snackbar.show({ text: t('events.attendAll.failed'), tone: 'error' })
  }
  attendOpen.value = false
}

// Back to top: appears after scrolling down.
const { y } = useWindowScroll()
const reducedMotion = usePreferredReducedMotion()
const showToTop = computed(() => y.value > 500)
function toTop() {
  window.scrollTo({ top: 0, behavior: reducedMotion.value === 'reduce' ? 'auto' : 'smooth' })
}

const createOptions: {
  kind: 'training' | 'series' | 'match' | 'event'
  icon: UiIconName
  labelKey: string
  hintKey: string
}[] = [
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
const createOpen = ref(false)
async function create(kind: (typeof createOptions)[number]['kind']) {
  createOpen.value = false
  await router.push({ name: 'event-new', params: { kind } })
}

function scrollToFirstUnanswered() {
  const first = unanswered.value[0]
  if (first) document.getElementById(`event-${first.id}`)?.scrollIntoView({ behavior: 'smooth' })
}
</script>

<template>
  <section class="events">
    <header class="events__head">
      <h1>{{ t('events.title') }}</h1>
      <UiIconButton
        icon="filter"
        :label="
          filterCount
            ? t('events.filter.labelActive', { n: filterCount })
            : t('events.filter.label')
        "
        :class="{ 'events__filter--on': filterCount > 0 }"
        aria-haspopup="dialog"
        @click="filterOpen = true"
      >
        <UiIcon name="filter" :size="22" />
        <span v-if="filterCount" class="events__badge" aria-hidden="true">{{ filterCount }}</span>
      </UiIconButton>
      <UiIconButton
        v-if="isCoach"
        icon="plus"
        variant="primary"
        :label="t('events.createLabel')"
        aria-haspopup="dialog"
        @click="createOpen = true"
      />
    </header>

    <div v-if="unanswered.length || attendCandidates.length" class="events__tools">
      <button
        v-if="unanswered.length"
        type="button"
        class="events__reminder"
        @click="scrollToFirstUnanswered"
      >
        <UiIcon name="alert" :size="18" />
        {{ t('events.reminder', unanswered.length) }}
      </button>
      <UiButton
        v-if="attendCandidates.length"
        variant="secondary"
        icon="check"
        @click="attendOpen = true"
      >
        {{ t('events.attendAll.button') }}
      </UiButton>
    </div>

    <div v-if="events.isPending.value" class="events__list" aria-busy="true">
      <UiSkeleton v-for="n in 4" :key="n" shape="block" height="120px" />
    </div>
    <p v-else-if="events.isError.value" class="events__error" role="alert">
      {{ t('events.loadFailed') }}
    </p>

    <template v-else>
      <section
        v-for="week in weeks"
        :key="week.key"
        class="events__week"
        :aria-labelledby="`week-${week.key}`"
      >
        <h2 :id="`week-${week.key}`" class="events__week-title">{{ weekTitle(week) }}</h2>
        <ul class="events__list" role="list">
          <li v-for="event in week.events" :id="`event-${event.id}`" :key="event.id">
            <EventRow
              :event="event"
              :my-member="myMember"
              :is-coach="isCoach"
              :player-ids="playerIds"
              @answer="onAnswer(event, $event)"
            />
          </li>
        </ul>
      </section>

      <UiEmptyState
        v-if="!weeks.length && filteredAway"
        icon="filter"
        :title="t('events.filter.emptyTitle')"
        :text="t('events.filter.emptyText')"
      >
        <UiButton variant="secondary" @click="resetFilter">{{ t('events.filter.reset') }}</UiButton>
      </UiEmptyState>
      <UiEmptyState
        v-else-if="!weeks.length"
        icon="calendar"
        :title="t('events.empty')"
        :text="isCoach ? t('events.emptyHintCoach') : t('events.emptyHint')"
      />

      <details v-if="lists.past.length" class="events__past">
        <summary class="events__past-summary">
          {{ t('events.past', { count: lists.past.length }) }}
        </summary>
        <ul class="events__list" role="list">
          <li v-for="event in lists.past" :key="event.id">
            <EventRow
              :event="event"
              :my-member="null"
              :is-coach="isCoach"
              :player-ids="playerIds"
            />
          </li>
        </ul>
      </details>
    </template>

    <Transition name="events-fade">
      <UiIconButton
        v-if="showToTop"
        icon="arrowUp"
        :label="t('events.toTop')"
        class="events__to-top"
        @click="toTop"
      />
    </Transition>

    <DeclineSheet :request="declining" @decline="decline" @cancel="declining = null" />

    <BottomSheet v-model:open="filterOpen" :title="t('events.filter.label')">
      <div class="events__filters">
        <fieldset class="events__fieldset">
          <legend class="events__legend">{{ t('events.filter.type') }}</legend>
          <div class="events__chips">
            <UiChip
              v-for="type in types"
              :key="type"
              :model-value="filter.type === type"
              @update:model-value="setType(type)"
            >
              {{ t(`events.filter.types.${type}`) }}
            </UiChip>
          </div>
        </fieldset>
        <UiSwitch
          v-if="memberId"
          v-model="onlyUnanswered"
          :label="t('events.filter.onlyUnanswered')"
        />
      </div>
      <template #footer>
        <UiButton variant="secondary" :disabled="!filterCount" @click="resetFilter">
          {{ t('events.filter.reset') }}
        </UiButton>
        <UiButton @click="filterOpen = false">
          {{ t('events.filter.show', { n: lists.upcoming.length }) }}
        </UiButton>
      </template>
    </BottomSheet>

    <BottomSheet v-model:open="createOpen" :title="t('events.createLabel')">
      <ul class="events__options" role="list">
        <li v-for="option in createOptions" :key="option.kind">
          <button
            type="button"
            class="events__option"
            :class="`events__option--${option.kind}`"
            @click="create(option.kind)"
          >
            <span class="events__option-icon" aria-hidden="true">
              <UiIcon :name="option.icon" :size="24" />
            </span>
            <span class="events__option-text">
              <span class="events__option-label">{{ t(option.labelKey) }}</span>
              <span class="events__option-hint">{{ t(option.hintKey) }}</span>
            </span>
          </button>
        </li>
      </ul>
    </BottomSheet>

    <BottomSheet v-model:open="attendOpen" :title="t('events.attendAll.title')">
      <p>{{ t('events.attendAll.text', attendCandidates.length) }}</p>
      <p class="events__hint">{{ t('events.attendAll.hint') }}</p>
      <template #footer>
        <UiButton variant="secondary" @click="attendOpen = false">{{
          t('common.cancel')
        }}</UiButton>
        <UiButton :loading="attendAll.isPending.value" @click="confirmAttendAll">
          {{ t('events.attendAll.confirm', { n: attendCandidates.length }) }}
        </UiButton>
      </template>
    </BottomSheet>
  </section>
</template>

<style scoped lang="scss">
.events {
  display: flex;
  flex-direction: column;
  gap: $space-4;

  &__head {
    display: flex;
    align-items: center;
    gap: $space-2;

    h1 {
      flex: 1;
    }
  }

  &__filter--on {
    position: relative;
    outline: 2px solid var(--color-primary);
  }

  &__badge {
    position: absolute;
    top: -2px;
    right: -2px;
    display: grid;
    place-items: center;
    min-width: 20px;
    height: 20px;
    border-radius: $radius-full;
    background: var(--color-primary);
    color: var(--color-primary-contrast);
    font-size: $font-xs;
    font-weight: 800;
  }

  &__tools {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: $space-2;
  }

  &__reminder {
    @include focus-visible;

    display: inline-flex;
    flex: 1 1 200px;
    align-items: center;
    gap: $space-2;
    min-height: $touch-target;
    padding: $space-2 $space-3;
    border: 2px dashed var(--color-maybe);
    border-radius: $radius-lg;
    background: transparent;
    color: var(--color-text);
    font-weight: 700;
    text-align: left;

    :deep(.ui-icon) {
      color: var(--color-maybe-text);
    }
  }

  &__week {
    display: flex;
    flex-direction: column;
    gap: $space-2;
  }

  &__week-title {
    position: sticky;
    top: var(--top-bar-height, 64px);
    z-index: 5;
    padding: $space-2 0;
    background: var(--color-bg);
    font-size: $font-xl;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: $space-2;
    margin: 0;
  }

  &__error {
    color: var(--color-danger);
  }

  &__past-summary {
    @include focus-visible;

    min-height: $touch-target;
    padding: $space-2 0;
    color: var(--color-text-muted);
    font-weight: 700;
    cursor: pointer;
  }

  &__past .events__list {
    opacity: 0.8;
  }

  &__to-top {
    position: fixed;
    right: $space-4;
    bottom: calc(var(--nav-offset, 0px) + #{$space-3});
    z-index: 30;
    opacity: 0.85;
    box-shadow: var(--shadow-md);
  }

  &__filters {
    display: flex;
    flex-direction: column;
    gap: $space-4;
  }

  &__fieldset {
    margin: 0;
    padding: 0;
    border: 0;
  }

  &__legend {
    margin-bottom: $space-2;
    font-weight: 800;
  }

  &__chips {
    display: flex;
    flex-wrap: wrap;
    gap: $space-2;
  }

  &__hint {
    margin-top: $space-2;
    color: var(--color-text-muted);
    font-size: $font-sm;
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
}

.events-fade-enter-active,
.events-fade-leave-active {
  transition: opacity var(--duration-medium) var(--ease-out);
}

.events-fade-enter-from,
.events-fade-leave-to {
  opacity: 0;
}
</style>
