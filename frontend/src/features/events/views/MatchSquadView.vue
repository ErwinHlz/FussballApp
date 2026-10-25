<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import PageProblem from '@/ui/PageProblem.vue'
import UiSkeleton from '@/ui/UiSkeleton.vue'
import { useActiveTeam } from '@/features/teams/composables/useActiveTeam'
import EventCoachNav from '../components/EventCoachNav.vue'
import MatchSquadEditor from '../components/MatchSquadEditor.vue'
import { useEvent, useMyMember } from '../composables/useEvents'
import { useEventFormat } from '../format'

/** Coach view of a match: the squad (starters, bench, reserve), next to the overview. */
const props = defineProps<{ eventId: string }>()

const { t } = useI18n()
const fmt = useEventFormat()
const event = useEvent(() => props.eventId)
const e = computed(() => event.data.value)
const teamId = computed(() => e.value?.team_id ?? null)
const { members } = useMyMember(teamId)
const { myTeams } = useActiveTeam()
const isCoach = computed(() => {
  const team = myTeams.data.value?.find((x) => x.team_id === teamId.value)
  return !!team && (team.team_role === 'coach' || team.is_club_admin)
})
</script>

<template>
  <section class="squad-page">
    <div v-if="event.isPending.value" aria-busy="true" class="squad-page__loading">
      <h1 class="visually-hidden">{{ t('events.nomination.title') }}</h1>
      <UiSkeleton shape="block" height="48px" />
      <UiSkeleton v-for="n in 4" :key="n" shape="block" height="56px" />
    </div>
    <PageProblem
      v-else-if="event.isError.value || !e || e.type !== 'match'"
      :title="t('events.loadFailedOne')"
      :text="t('problem.hint')"
      :to="{ name: 'events' }"
      :action="t('problem.toEvents')"
    />
    <PageProblem
      v-else-if="!isCoach"
      icon="lock"
      :title="t('events.nomination.coachOnly')"
      :to="{ name: 'event' }"
      :action="t('problem.toEvent')"
    />

    <template v-else>
      <EventCoachNav :event-id="eventId" type="match" active="event-squad" />

      <header>
        <p class="squad-page__eyebrow">
          {{ fmt.title(e) }} · {{ fmt.weekdayShort(e.starts_at) }} {{ fmt.dayMonth(e.starts_at) }}
        </p>
        <h1>{{ t('events.nomination.title') }}</h1>
      </header>

      <p v-if="e.is_cancelled" class="squad-page__muted">{{ t('events.cancelledTitle') }}</p>
      <MatchSquadEditor v-else-if="members.data.value" :event="e" :members="members.data.value" />
    </template>
  </section>
</template>

<style scoped lang="scss">
.squad-page {
  display: flex;
  flex-direction: column;
  gap: $space-4;

  &__loading {
    display: flex;
    flex-direction: column;
    gap: $space-2;
  }

  &__eyebrow {
    color: var(--color-match-text);
    font-size: $font-sm;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  &__muted {
    color: var(--color-text-muted);
  }
}
</style>
