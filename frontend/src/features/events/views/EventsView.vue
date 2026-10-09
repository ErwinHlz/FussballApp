<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/AppIcon.vue'
import BaseModal from '@/components/BaseModal.vue'
import EmptyState from '@/components/EmptyState.vue'
import { useActiveTeam } from '@/features/teams/composables/useActiveTeam'
import EventCard from '../components/EventCard.vue'
import NextEventHero from '@/features/player-view/components/NextEventHero.vue'
import { nextEvent } from '@/features/player-view/logic'
import { splitEvents, unansweredEvents } from '../logic'
import { useMyMember, useTeamEvents } from '../composables/useEvents'

const { t } = useI18n()
const router = useRouter()
const { activeTeam, isCoach } = useActiveTeam()
const teamId = computed(() => activeTeam.value?.team_id ?? null)
const events = useTeamEvents(teamId)
const { members, myMember } = useMyMember(teamId)

const lists = computed(() => splitEvents(events.data.value ?? []))
const hero = computed(() => nextEvent(lists.value.upcoming))
const moreUpcoming = computed(() => lists.value.upcoming.filter((e) => e.id !== hero.value?.id))
const unanswered = computed(() =>
  unansweredEvents(lists.value.upcoming, myMember.value?.id ?? null),
)
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
  <section class="events" :class="{ 'events--with-fab': isCoach }">
    <h1>{{ t('events.title') }}</h1>

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

    <!-- New date: floating button for coaches -->
    <button
      v-if="isCoach"
      type="button"
      class="events__fab"
      :aria-label="t('events.createLabel')"
      :title="t('events.createLabel')"
      @click="createOpen = true"
    >
      <AppIcon name="plus" :size="28" />
    </button>

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
  </section>
</template>

<style scoped lang="scss">
.events {
  display: flex;
  flex-direction: column;
  gap: $space-4;

  // Room so the floating button never covers the last card's answer buttons.
  &--with-fab {
    padding-bottom: 72px;
  }

  // Bottom right above the tab bar, aligned with the centered content on wide screens.
  &__fab {
    @include focus-visible;

    position: fixed;
    right: max($space-4, calc((100vw - 720px) / 2 + #{$space-4}));
    bottom: calc(#{$bottom-nav-height} + #{$space-4} + env(safe-area-inset-bottom, 0px));
    z-index: 20;
    display: grid;
    place-items: center;
    width: 56px;
    height: 56px;
    border: 0;
    border-radius: $radius-full;
    background: var(--color-primary);
    color: var(--color-primary-contrast);
    box-shadow: var(--shadow-lg);
    cursor: pointer;

    &:hover {
      background: var(--color-primary-hover);
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
