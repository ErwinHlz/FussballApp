<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatDate } from '@/lib/date'
import { percent, type TrainingPoint } from '../logic'

/**
 * Participation per training as columns (single series, so no legend: the title names it).
 * Thin columns with rounded tops, recessive hairline grid, per-column tooltip on hover/focus,
 * value label only on the latest column, and a table view with every value.
 */
const props = defineProps<{ points: TrainingPoint[]; title: string }>()

const MAX_COLUMNS = 24

const { t, locale } = useI18n()
const showTable = ref(false)
const active = ref<string | null>(null)

const columns = computed(() =>
  props.points.slice(-MAX_COLUMNS).map((p) => ({
    ...p,
    rate: percent(p.yes_count, p.players) ?? 0,
    date: formatDate(p.starts_at, locale.value, 'EEEEEE dd.MM.'),
  })),
)
const hidden = computed(() => Math.max(0, props.points.length - MAX_COLUMNS))
const activeColumn = computed(() => columns.value.find((c) => c.event_id === active.value) ?? null)
const lastId = computed(() => columns.value.at(-1)?.event_id ?? null)

function describe(c: (typeof columns.value)[number]) {
  return t('stats.chart.point', {
    date: c.date,
    yes: c.yes_count,
    players: c.players,
    rate: c.rate,
  })
}
</script>

<template>
  <figure class="chart">
    <figcaption class="chart__head">
      <span class="chart__title">{{ title }}</span>
      <button
        type="button"
        class="chart__toggle"
        :aria-pressed="showTable"
        @click="showTable = !showTable"
      >
        {{ showTable ? t('stats.chart.asChart') : t('stats.chart.asTable') }}
      </button>
    </figcaption>
    <p v-if="hidden" class="chart__note">
      {{ t('stats.chart.latestOnly', { n: columns.length }) }}
    </p>

    <table v-if="showTable" class="chart__table">
      <thead>
        <tr>
          <th scope="col">{{ t('stats.chart.date') }}</th>
          <th scope="col">{{ t('stats.chart.yes') }}</th>
          <th scope="col">{{ t('stats.chart.rate') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="c in [...columns].reverse()" :key="c.event_id">
          <td>{{ c.date }}</td>
          <td>{{ c.yes_count }} / {{ c.players }}</td>
          <td>{{ c.rate }} %</td>
        </tr>
      </tbody>
    </table>

    <div v-else class="chart__plot" @pointerleave="active = null">
      <!-- Recessive y grid: 0 / 50 / 100 %. -->
      <div class="chart__grid" aria-hidden="true">
        <span
          v-for="tick in [100, 50, 0]"
          :key="tick"
          class="chart__gridline"
          :style="{ bottom: `${tick}%` }"
        >
          <span class="chart__tick">{{ tick }} %</span>
        </span>
      </div>

      <div class="chart__columns" role="list" :aria-label="title">
        <button
          v-for="c in columns"
          :key="c.event_id"
          type="button"
          role="listitem"
          class="chart__slot"
          :class="{ 'chart__slot--active': active === c.event_id }"
          :aria-label="describe(c)"
          @pointerenter="active = c.event_id"
          @focus="active = c.event_id"
          @blur="active = null"
          @click="active = c.event_id"
        >
          <span class="chart__bar" :style="{ height: `${c.rate}%` }">
            <span v-if="c.event_id === lastId" class="chart__value" aria-hidden="true"
              >{{ c.rate }} %</span
            >
          </span>
        </button>
      </div>

      <div v-if="activeColumn" class="chart__tooltip" role="status">
        <strong>{{ activeColumn.rate }} %</strong>
        <span
          >{{ activeColumn.date }} ·
          {{
            t('stats.chart.yesOf', { yes: activeColumn.yes_count, players: activeColumn.players })
          }}</span
        >
      </div>

      <div class="chart__axis" aria-hidden="true">
        <span>{{ columns[0]?.date }}</span>
        <span>{{ columns.at(-1)?.date }}</span>
      </div>
    </div>
  </figure>
</template>

<style scoped lang="scss">
.chart {
  --chart-height: 160px;

  display: flex;
  flex-direction: column;
  gap: $space-2;
  margin: 0;
  padding: $space-3;
  border: 1px solid var(--color-border);
  border-radius: $radius-lg;
  background: var(--color-surface);

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $space-2;
  }

  &__title {
    font-weight: 700;
  }

  &__toggle {
    @include focus-visible;

    min-height: $touch-target;
    padding: 0 $space-2;
    border: 0;
    background: transparent;
    color: var(--color-primary);
    font-size: $font-sm;
    font-weight: 700;
  }

  &__note {
    font-size: $font-xs;
    color: var(--color-text-muted);
  }

  &__plot {
    position: relative;
    padding: $space-4 0 0 36px;
  }

  &__grid {
    position: absolute;
    inset: $space-4 0 calc(#{$space-5} + 2px) 36px;
    height: var(--chart-height);
    pointer-events: none;
  }

  &__gridline {
    position: absolute;
    left: 0;
    right: 0;
    border-top: 1px solid var(--color-border);
  }

  &__tick {
    position: absolute;
    right: calc(100% + 6px);
    transform: translateY(-50%);
    font-size: $font-xs;
    color: var(--color-text-muted);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  &__columns {
    position: relative;
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: var(--chart-height);
  }

  &__slot {
    display: flex;
    flex: 1 1 0;
    align-items: flex-end;
    justify-content: center;
    min-width: 0;
    height: 100%;
    padding: 0;
    border: 0;
    border-radius: $radius-sm;
    background: transparent;
    cursor: pointer;

    &:focus-visible {
      @include focus-ring;
    }

    &--active {
      background: color-mix(in srgb, var(--color-text) 6%, transparent);
    }
  }

  &__bar {
    position: relative;
    width: 100%;
    max-width: 24px;
    min-height: 2px;
    border-radius: 4px 4px 0 0;
    background: var(--color-training);
  }

  &__slot--active &__bar {
    filter: brightness(1.15);
  }

  &__value {
    position: absolute;
    bottom: calc(100% + 2px);
    left: 50%;
    transform: translateX(-50%);
    font-size: $font-xs;
    font-weight: 700;
    color: var(--color-text);
    white-space: nowrap;
  }

  &__tooltip {
    position: absolute;
    top: 0;
    right: 0;
    display: flex;
    flex-direction: column;
    padding: $space-1 $space-2;
    border: 1px solid var(--color-border);
    border-radius: $radius-md;
    background: var(--color-surface);
    box-shadow: var(--shadow-md);
    font-size: $font-xs;
    color: var(--color-text-muted);
    pointer-events: none;

    strong {
      font-size: $font-md;
      color: var(--color-text);
    }
  }

  &__axis {
    display: flex;
    justify-content: space-between;
    margin-top: $space-1;
    font-size: $font-xs;
    color: var(--color-text-muted);
  }

  &__table {
    width: 100%;
    border-collapse: collapse;
    font-size: $font-sm;
    font-variant-numeric: tabular-nums;

    th,
    td {
      padding: $space-2;
      border-bottom: 1px solid var(--color-border);
      text-align: left;
    }

    th {
      font-size: $font-xs;
      color: var(--color-text-muted);
    }
  }
}
</style>
