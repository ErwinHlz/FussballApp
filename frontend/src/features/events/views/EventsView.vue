<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useLocalStorage, usePreferredReducedMotion, useWindowScroll } from '@vueuse/core'
import AppIcon from '@/components/AppIcon.vue'
import BaseButton from '@/components/BaseButton.vue'
import BaseChipGroup from '@/components/BaseChipGroup.vue'
import BaseModal from '@/components/BaseModal.vue'
import EmptyState from '@/components/EmptyState.vue'
import { useActiveTeam } from '@/features/teams/composables/useActiveTeam'
import EventCard from '../components/EventCard.vue'
import NextEventHero from '@/features/player-view/components/NextEventHero.vue'
import { nextEvent } from '@/features/player-view/logic'
import {
  activeFilterCount,
  attendAllCandidates,
  DEFAULT_EVENT_FILTER,
  filterEvents,
  splitEvents,
  unansweredEvents,
  type EventFilter,
  type EventTypeFilter,
} from '../logic'
import { useAttendAll, useMyMember, useTeamEvents } from '../composables/useEvents'

const { t } = useI18n()
const router = useRouter()
const { activeTeam, isCoach } = useActiveTeam()
const teamId = computed(() => activeTeam.value?.team_id ?? null)
const events = useTeamEvents(teamId)
const { members, myMember } = useMyMember(teamId)

const memberId = computed(() => myMember.value?.id ?? null)

// Filters are a per-device convenience (remembered in the browser).
const filter = useLocalStorage<EventFilter>(
  'rondo.eventFilter',
  { ...DEFAULT_EVENT_FILTER },
  { mergeDefaults: true },
)
const filtersOpen = ref(false)
const filterCount = computed(() => activeFilterCount(filter.value))
const typeOptions = computed(() =>
  (['all', 'training', 'match', 'event'] as const).map((value) => ({
    value,
    label: t(`events.filter.types.${value}`),
  })),
)
const filterType = computed({
  get: () => filter.value.type,
  set: (value: EventTypeFilter | EventTypeFilter[] | undefined) => {
    if (typeof value === 'string') filter.value = { ...filter.value, type: value }
  },
})
function setOnlyUnanswered(event: Event) {
  filter.value = { ...filter.value, onlyUnanswered: (event.target as HTMLInputElement).checked }
}
function resetFilter() {
  filter.value = { ...DEFAULT_EVENT_FILTER }
}

const allUpcoming = computed(() => splitEvents(events.data.value ?? []).upcoming)
const lists = computed(() =>
  splitEvents(filterEvents(events.data.value ?? [], filter.value, memberId.value)),
)
const hero = computed(() => nextEvent(lists.value.upcoming))
const moreUpcoming = computed(() => lists.value.upcoming.filter((e) => e.id !== hero.value?.id))
const unanswered = computed(() => unansweredEvents(allUpcoming.value, memberId.value))
const filteredAway = computed(
  () => !!events.data.value?.length && !lists.value.upcoming.length && filterCount.value > 0,
)

// "Attend all": every shown date that is still open and not answered yet.
const attendCandidates = computed(() => attendAllCandidates(lists.value.upcoming, memberId.value))
const attendAll = useAttendAll()
const attendOpen = ref(false)
const attendNotice = ref<string | null>(null)

async function confirmAttendAll() {
  const result = await attendAll.mutateAsync({
    eventIds: attendCandidates.value.map((e) => e.id),
    memberId: memberId.value!,
  })
  attendOpen.value = false
  attendNotice.value = result.skipped
    ? t('events.attendAll.doneSkipped', { n: result.saved, skipped: result.skipped })
    : t('events.attendAll.done', result.saved)
}

// Back to top: appears after scrolling down.
const { y } = useWindowScroll()
const reducedMotion = usePreferredReducedMotion()
const showToTop = computed(() => y.value > 500)
function toTop() {
  window.scrollTo({ top: 0, behavior: reducedMotion.value === 'reduce' ? 'auto' : 'smooth' })
}
const playerIds = computed(() =>
  (members.data.value ?? []).filter((m) => m.role === 'player').map((m) => m.id),
)

const createOptions = [
  {
    kind: 'training',
    icon: 'whistle',
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
] as const
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
      <div class="events__actions">
        <button
          v-if="attendCandidates.length"
          type="button"
          class="events__action events__action--text"
          @click="attendOpen = true"
        >
          <AppIcon name="check" :size="18" />
          {{ t('events.attendAll.button') }}
        </button>
        <button
          type="button"
          class="events__action"
          :class="{ 'events__action--on': filtersOpen || filterCount > 0 }"
          :aria-expanded="filtersOpen"
          aria-controls="events-filters"
          :aria-label="
            filterCount
              ? t('events.filter.labelActive', { n: filterCount })
              : t('events.filter.label')
          "
          @click="filtersOpen = !filtersOpen"
        >
          <AppIcon name="filter" :size="20" />
          <span v-if="filterCount" class="events__badge" aria-hidden="true">{{ filterCount }}</span>
        </button>
        <button
          v-if="isCoach"
          type="button"
          class="events__action events__action--primary"
          :aria-label="t('events.createLabel')"
          :title="t('events.createLabel')"
          @click="createOpen = true"
        >
          <AppIcon name="plus" :size="24" />
        </button>
      </div>
    </header>

    <section
      v-if="filtersOpen"
      id="events-filters"
      class="events__filters"
      :aria-label="t('events.filter.label')"
    >
      <BaseChipGroup
        v-model="filterType"
        :label="t('events.filter.type')"
        :options="typeOptions"
        :columns="4"
      />
      <label v-if="memberId" class="events__check">
        <input
          type="checkbox"
          class="events__box"
          :checked="filter.onlyUnanswered"
          @change="setOnlyUnanswered"
        />
        {{ t('events.filter.onlyUnanswered') }}
      </label>
      <BaseButton v-if="filterCount" variant="ghost" @click="resetFilter">
        {{ t('events.filter.reset') }}
      </BaseButton>
    </section>

    <p v-if="attendNotice" class="events__notice" role="status">✓ {{ attendNotice }}</p>

    <button
      v-if="unanswered.length"
      type="button"
      class="events__reminder"
      @click="scrollToFirstUnanswered"
    >
      <span class="events__reminder-icon" aria-hidden="true">!</span>
      {{ t('events.reminder', unanswered.length) }}
    </button>

    <p v-if="events.isPending.value" class="events__muted">{{ t('common.loading') }}</p>
    <p v-else-if="events.isError.value" class="events__error" role="alert">
      {{ t('events.loadFailed') }}
    </p>

    <template v-else>
      <NextEventHero
        v-if="hero"
        :id="`event-${hero.id}`"
        :event="hero"
        :my-member="myMember"
        :is-coach="isCoach"
      />
      <h2 v-if="hero && moreUpcoming.length" class="events__subtitle">
        {{ t('player.moreEvents') }}
      </h2>
      <ul v-if="moreUpcoming.length" class="events__list" role="list">
        <li v-for="event in moreUpcoming" :id="`event-${event.id}`" :key="event.id">
          <EventCard
            :event="event"
            :my-member="myMember"
            :is-coach="isCoach"
            :player-ids="playerIds"
          />
        </li>
      </ul>
      <EmptyState
        v-else-if="!hero && filteredAway"
        icon="filter"
        :title="t('events.filter.emptyTitle')"
        :text="t('events.filter.emptyText')"
      >
        <BaseButton variant="secondary" @click="resetFilter">
          {{ t('events.filter.reset') }}
        </BaseButton>
      </EmptyState>
      <EmptyState
        v-else-if="!hero"
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
            <EventCard
              :event="event"
              :my-member="null"
              :is-coach="isCoach"
              :player-ids="playerIds"
            />
          </li>
        </ul>
      </details>
    </template>

    <BaseModal v-model:open="createOpen" :title="t('events.createLabel')">
      <ul class="events__options" role="list">
        <li v-for="option in createOptions" :key="option.kind">
          <button
            type="button"
            class="events__option"
            :class="`events__option--${option.kind}`"
            @click="create(option.kind)"
          >
            <span class="events__option-icon" aria-hidden="true">
              <AppIcon :name="option.icon" :size="22" />
            </span>
            <span class="events__option-text">
              <span class="events__option-label">{{ t(option.labelKey) }}</span>
              <span class="events__muted">{{ t(option.hintKey) }}</span>
            </span>
          </button>
        </li>
      </ul>
    </BaseModal>

    <BaseModal v-model:open="attendOpen" :title="t('events.attendAll.title')">
      <p>{{ t('events.attendAll.text', attendCandidates.length) }}</p>
      <p class="events__muted">{{ t('events.attendAll.hint') }}</p>
      <p v-if="attendAll.isError.value" class="events__error" role="alert">
        {{ t('events.attendAll.failed') }}
      </p>
      <template #footer>
        <BaseButton variant="secondary" @click="attendOpen = false">
          {{ t('common.cancel') }}
        </BaseButton>
        <BaseButton :loading="attendAll.isPending.value" @click="confirmAttendAll">
          {{ t('events.attendAll.confirm', attendCandidates.length) }}
        </BaseButton>
      </template>
    </BaseModal>

    <!-- Back to top -->
    <button
      v-if="showToTop"
      type="button"
      class="events__totop"
      :aria-label="t('events.toTop')"
      :title="t('events.toTop')"
      @click="toTop"
    >
      <AppIcon name="arrowUp" :size="22" />
    </button>
  </section>
</template>

<style scoped lang="scss">
.events {
  display: flex;
  flex-direction: column;
  gap: $space-4;

  &__head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: $space-2;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
  }

  &__action {
    @include focus-visible;

    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: $space-1;
    min-width: $touch-target;
    height: $touch-target;
    padding: 0 $space-2;
    border: 1px solid var(--color-border);
    border-radius: $radius-full;
    background: var(--color-surface);
    color: var(--color-text);
    font-weight: 700;
    cursor: pointer;

    &--text {
      padding: 0 $space-2 0 6px;
      border-color: color-mix(in srgb, var(--color-success) 45%, var(--color-border));
      color: var(--color-success);
      font-size: $font-sm;
    }

    &--on {
      border-color: var(--color-primary);
      color: var(--color-primary);
    }

    &--primary {
      border-color: var(--color-primary);
      background: var(--color-primary);
      color: var(--color-primary-contrast);

      &:hover {
        background: var(--color-primary-hover);
      }
    }
  }

  &__badge {
    position: absolute;
    top: -4px;
    right: -4px;
    display: grid;
    place-items: center;
    min-width: 18px;
    height: 18px;
    padding: 0 4px;
    border-radius: $radius-full;
    background: var(--color-primary);
    color: var(--color-primary-contrast);
    font-size: $font-xs;
    font-weight: 800;
  }

  &__filters {
    display: flex;
    flex-direction: column;
    gap: $space-3;
    padding: $space-3;
    border: 1px solid var(--color-border);
    border-radius: $radius-lg;
    background: var(--color-surface);
  }

  &__check {
    display: flex;
    align-items: center;
    gap: $space-3;
    min-height: $touch-target;
    font-weight: 600;
  }

  &__box {
    @include focus-visible;

    width: 22px;
    height: 22px;
    accent-color: var(--color-primary);
  }

  &__notice {
    color: var(--color-success);
    font-weight: 600;
  }

  // Back to top: small and see-through so it never hides content.
  &__totop {
    @include focus-visible;

    position: fixed;
    right: max($space-4, calc((100vw - 720px) / 2 + #{$space-4}));
    bottom: calc(#{$bottom-nav-height} + #{$space-3} + env(safe-area-inset-bottom, 0px));
    z-index: 20;
    display: grid;
    place-items: center;
    width: $touch-target;
    height: $touch-target;
    border: 1px solid var(--color-border);
    border-radius: $radius-full;
    background: color-mix(in srgb, var(--color-surface) 70%, transparent);
    color: var(--color-text);
    box-shadow: var(--shadow-sm);
    backdrop-filter: blur(6px);
    opacity: 0.85;
    cursor: pointer;

    &:hover,
    &:focus-visible {
      opacity: 1;
    }
  }

  &__options {
    display: flex;
    flex-direction: column;
    gap: $space-2;
  }

  &__option {
    @include focus-visible;

    --option-color: var(--color-training);

    display: flex;
    align-items: center;
    gap: $space-3;
    width: 100%;
    min-height: 64px;
    padding: $space-2 $space-3;
    border: 1px solid var(--color-border);
    border-left: 4px solid var(--option-color);
    border-radius: $radius-md;
    background: var(--color-surface);
    color: var(--color-text);
    text-align: left;

    &:hover {
      background: var(--color-surface-muted);
    }

    &--match {
      --option-color: var(--color-match);
    }

    &--event {
      --option-color: var(--color-event);
    }
  }

  &__option-icon {
    display: grid;
    flex: none;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: $radius-full;
    background: color-mix(in srgb, var(--option-color) 15%, var(--color-surface));
    color: var(--option-color);
  }

  &__option-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__option-label {
    font-weight: 700;
  }

  &__reminder {
    @include focus-visible;

    display: flex;
    align-items: center;
    gap: $space-3;
    min-height: $touch-target;
    padding: $space-3 $space-4;
    border: 2px solid var(--color-warning);
    border-radius: $radius-lg;
    background: color-mix(in srgb, var(--color-warning) 12%, var(--color-surface));
    font-weight: 700;
    text-align: left;
  }

  &__reminder-icon {
    display: grid;
    flex-shrink: 0;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: $radius-full;
    background: var(--color-warning);
    color: #fff;
    font-weight: 800;
  }

  &__subtitle {
    font-size: $font-lg;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: $space-3;
  }

  &__past {
    margin-top: $space-2;
  }

  &__past-summary {
    @include focus-visible;

    display: flex;
    align-items: center;
    min-height: $touch-target;
    margin-bottom: $space-3;
    font-weight: 700;
    color: var(--color-text-muted);
    cursor: pointer;
  }

  &__muted {
    color: var(--color-text-muted);
  }

  &__error {
    color: var(--color-danger);
  }
}
</style>
