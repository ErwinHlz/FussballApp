<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/AppIcon.vue'
import BaseButton from '@/components/BaseButton.vue'
import EmptyState from '@/components/EmptyState.vue'
import { useActiveTeam } from '@/features/teams/composables/useActiveTeam'
import EventCard from '../components/EventCard.vue'
import NextEventHero from '@/features/player-view/components/NextEventHero.vue'
import { nextEvent } from '@/features/player-view/logic'
import { splitEvents, unansweredEvents } from '../logic'
import { useMyMember, useTeamEvents } from '../composables/useEvents'

const { t } = useI18n()
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

const createLinks = [
  { kind: 'training', icon: 'whistle', labelKey: 'events.newTraining' },
  { kind: 'series', icon: 'calendar', labelKey: 'events.newSeries' },
  { kind: 'match', icon: 'users', labelKey: 'events.newMatch' },
] as const

function scrollToFirstUnanswered() {
  const first = unanswered.value[0]
  if (first) document.getElementById(`event-${first.id}`)?.scrollIntoView({ behavior: 'smooth' })
}
</script>

<template>
  <section class="events">
    <h1>{{ t('events.title') }}</h1>

    <nav v-if="isCoach" class="events__create" :aria-label="t('events.createLabel')">
      <RouterLink
        v-for="link in createLinks"
        :key="link.kind"
        v-slot="{ navigate }"
        custom
        :to="{ name: 'event-new', params: { kind: link.kind } }"
      >
        <BaseButton variant="secondary" @click="navigate">
          <template #icon><AppIcon :name="link.icon" :size="18" /></template>
          {{ t(link.labelKey) }}
        </BaseButton>
      </RouterLink>
    </nav>

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
  </section>
</template>

<style scoped lang="scss">
.events {
  display: flex;
  flex-direction: column;
  gap: $space-4;

  &__create {
    display: flex;
    flex-wrap: wrap;
    gap: $space-2;
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
