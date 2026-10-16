<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useQuery } from '@tanstack/vue-query'
import UiEmptyState from '@/ui/UiEmptyState.vue'
import UiSegmented from '@/ui/UiSegmented.vue'
import UiSkeleton from '@/ui/UiSkeleton.vue'
import TeamNav from '@/features/squad/components/TeamNav.vue'
import { useAuthStore } from '@/stores/auth'
import { useActiveTeam } from '@/features/teams/composables/useActiveTeam'
import AttendanceChart from '../components/AttendanceChart.vue'
import StatTile from '../components/StatTile.vue'
import { fetchMemberStats, fetchTrainingAttendance } from '../api'
import {
  answerRate,
  formatHours,
  formatPercent,
  RANGES,
  rangeFor,
  reasonList,
  sortPlayers,
  teamSummary,
  trainingRate,
  type PlayerSort,
  type RangeKey,
} from '../logic'

const { t, locale } = useI18n()
const auth = useAuthStore()
const { activeTeam } = useActiveTeam()
const teamId = computed(() => activeTeam.value?.team_id ?? null)

const range = ref<RangeKey>('season')
const sort = ref<PlayerSort>('rate')
const period = computed(() => rangeFor(range.value))

const memberStats = useQuery({
  queryKey: computed(() => ['stats', 'members', teamId.value, range.value] as const),
  queryFn: () => fetchMemberStats(teamId.value!, period.value.from, period.value.to),
  enabled: computed(() => !!teamId.value),
  placeholderData: (previous) => previous,
})
const training = useQuery({
  queryKey: computed(() => ['stats', 'trainings', teamId.value, range.value] as const),
  queryFn: () => fetchTrainingAttendance(teamId.value!, period.value.from, period.value.to),
  enabled: computed(() => !!teamId.value),
  placeholderData: (previous) => previous,
})

const members = computed(() => memberStats.data.value ?? [])
const points = computed(() => training.data.value ?? [])
const summary = computed(() => teamSummary(points.value, members.value))
const me = computed(
  () => members.value.find((m) => m.user_id !== null && m.user_id === auth.userId) ?? null,
)
const players = computed(() => sortPlayers(members.value, sort.value))
const isPending = computed(() => memberStats.isPending.value || training.isPending.value)
const isError = computed(() => memberStats.isError.value || training.isError.value)
const isRefetching = computed(() => memberStats.isFetching.value || training.isFetching.value)

const rangeOptions = computed(() =>
  RANGES.map((r) => ({ value: r, label: t(`stats.ranges.${r}`) })),
)
const sortOptions = computed(() => [
  { value: 'rate' as const, label: t('stats.sort.rate') },
  { value: 'name' as const, label: t('stats.sort.name') },
])

function reasonsText(reasons: unknown) {
  return reasonList(reasons)
    .map((r) => `${t(`events.reasons.${r.reason}`)} ${r.count}×`)
    .join(' · ')
}
</script>

<template>
  <section class="stats">
    <TeamNav active="stats" />
    <h1>{{ t('stats.title') }}</h1>

    <!-- The period scopes everything below. -->
    <UiSegmented v-model="range" as="radio" :label="t('stats.range')" :options="rangeOptions" />

    <div v-if="isPending" aria-busy="true" class="stats__loading">
      <UiSkeleton shape="block" height="120px" />
      <UiSkeleton shape="block" height="200px" />
    </div>
    <p v-else-if="isError" class="stats__error" role="alert">{{ t('stats.loadFailed') }}</p>

    <UiEmptyState
      v-else-if="!summary.trainings && !summary.matches"
      icon="calendar"
      :title="t('stats.empty')"
      :text="t('stats.emptyHint')"
    />

    <div v-else class="stats__content" :class="{ 'stats__content--refetching': isRefetching }">
      <!-- Own numbers (players and coaches who are in the squad) -->
      <section v-if="me && me.role === 'player'" aria-labelledby="stats-me" class="stats__section">
        <h2 id="stats-me" class="stats__subtitle">{{ t('stats.me') }}</h2>
        <div class="stats__tiles">
          <StatTile
            :label="t('stats.trainingRate')"
            :value="formatPercent(trainingRate(me))"
            :sub="t('stats.teamAverage', { value: formatPercent(summary.attendanceRate) })"
          />
          <StatTile
            :label="t('stats.trainingTime')"
            :value="t('stats.hours', { n: formatHours(me.training_minutes, locale) })"
            :sub="t('stats.trainingsOf', { yes: me.trainings_yes, total: me.trainings_total })"
          />
          <StatTile
            :label="t('stats.matches')"
            :value="`${me.matches_yes} / ${me.matches_total}`"
            :sub="
              t('stats.nominations', { starter: me.starter, bench: me.bench, reserve: me.reserve })
            "
          />
          <StatTile :label="t('stats.answerRate')" :value="formatPercent(answerRate(me))" />
        </div>
      </section>

      <!-- Team -->
      <section aria-labelledby="stats-team" class="stats__section">
        <h2 id="stats-team" class="stats__subtitle">{{ t('stats.team') }}</h2>
        <div class="stats__tiles">
          <StatTile
            :label="t('stats.avgAttendance')"
            :value="formatPercent(summary.attendanceRate)"
          />
          <StatTile
            :label="t('stats.avgPlayers')"
            :value="
              summary.averagePlayers === null ? '–' : summary.averagePlayers.toLocaleString(locale)
            "
          />
          <StatTile :label="t('stats.trainings')" :value="String(summary.trainings)" />
          <StatTile :label="t('stats.matches')" :value="String(summary.matches)" />
        </div>
        <AttendanceChart v-if="points.length" :points="points" :title="t('stats.chart.title')" />
      </section>

      <!-- Players (visible to the whole team) -->
      <section aria-labelledby="stats-players" class="stats__section">
        <div class="stats__row">
          <h2 id="stats-players" class="stats__subtitle">{{ t('stats.players') }}</h2>
          <UiSegmented
            v-model="sort"
            as="radio"
            :label="t('stats.sortLabel')"
            :options="sortOptions"
          />
        </div>
        <ul class="stats__players" role="list">
          <li
            v-for="m in players"
            :key="m.member_id"
            class="player"
            :class="{ 'player--me': m.member_id === me?.member_id }"
          >
            <div class="player__head">
              <span class="player__name">
                {{ m.display_name }}
                <span v-if="m.member_id === me?.member_id" class="player__you"
                  >({{ t('common.you') }})</span
                >
              </span>
              <span class="player__rate">{{ formatPercent(trainingRate(m)) }}</span>
            </div>
            <div
              class="player__meter"
              role="meter"
              :aria-valuenow="trainingRate(m) ?? 0"
              aria-valuemin="0"
              aria-valuemax="100"
              :aria-label="t('stats.trainingRateOf', { name: m.display_name })"
            >
              <span class="player__fill" :style="{ width: `${trainingRate(m) ?? 0}%` }" />
            </div>
            <p class="player__meta">
              {{ t('stats.trainingsOf', { yes: m.trainings_yes, total: m.trainings_total }) }}
              · {{ t('stats.hours', { n: formatHours(m.training_minutes, locale) }) }}
              <template v-if="m.matches_total">
                · {{ t('stats.matchesShort', { yes: m.matches_yes, total: m.matches_total }) }}
              </template>
              <template v-if="m.starter + m.bench + m.reserve">
                · {{ t('stats.nominatedShort', { n: m.starter + m.bench + m.reserve }) }}
              </template>
            </p>
            <p v-if="reasonsText(m.decline_reasons)" class="player__reasons">
              {{ t('stats.declines') }}: {{ reasonsText(m.decline_reasons) }}
            </p>
          </li>
        </ul>
      </section>
    </div>
  </section>
</template>

<style scoped lang="scss">
.stats {
  display: flex;
  flex-direction: column;
  gap: $space-4;

  &__content {
    display: flex;
    flex-direction: column;
    gap: $space-5;
    transition: opacity var(--duration-fast) var(--ease-out);

    // Refetch keeps the frame: previous numbers stay, slightly dimmed.
    &--refetching {
      opacity: 0.6;
    }
  }

  &__section {
    display: flex;
    flex-direction: column;
    gap: $space-3;
  }

  &__row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: $space-2;
  }

  &__subtitle {
    font-size: $font-lg;
  }

  &__tiles {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: $space-2;
  }

  &__players {
    display: flex;
    flex-direction: column;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: $radius-lg;
  }

  &__loading {
    display: flex;
    flex-direction: column;
    gap: $space-3;
  }

  &__muted {
    color: var(--color-text-muted);
  }

  &__error {
    color: var(--color-danger);
  }
}

.player {
  display: flex;
  flex-direction: column;
  gap: $space-1;
  padding: $space-3;

  & + & {
    border-top: 1px solid var(--color-border);
  }

  &--me {
    background: color-mix(in srgb, var(--color-training) 8%, var(--color-surface));
  }

  &__you {
    font-weight: 400;
    color: var(--color-text-muted);
  }

  &__head {
    display: flex;
    justify-content: space-between;
    gap: $space-2;
  }

  &__name {
    font-weight: 700;
    overflow-wrap: anywhere;
  }

  &__rate {
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  // Meter: fill in the series color, track a lighter step of the same hue.
  &__meter {
    height: 8px;
    overflow: hidden;
    border-radius: $radius-full;
    background: color-mix(in srgb, var(--color-training) 18%, var(--color-surface));
  }

  &__fill {
    display: block;
    height: 100%;
    border-radius: $radius-full;
    background: var(--color-training);
  }

  &__meta,
  &__reasons {
    font-size: $font-sm;
    color: var(--color-text-muted);
  }
}
</style>
