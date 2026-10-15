<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatDate } from '@/lib/date'

export type WeekDay = {
  /** Local date as yyyy-MM-dd. */
  date: string
  marks: ('training' | 'match' | 'event')[]
}

/**
 * Monday-to-Sunday strip with a mark per event type. Marks differ in shape (round training,
 * square match, diamond event), not only in color.
 */
const props = defineProps<{ days: WeekDay[]; today: string; label: string }>()
const selected = defineModel<string | null>({ default: null })

const { t, locale } = useI18n()

const items = computed(() =>
  props.days.map((day) => {
    const date = new Date(`${day.date}T12:00:00`)
    const marks = [...new Set(day.marks)]
    const after = [formatDate(date, locale.value, 'MMMM')]
    if (day.date === props.today) after.push(t('ui.week.today'))
    for (const mark of marks) after.push(t(`ui.week.${mark}`))
    return {
      ...day,
      marks,
      weekday: formatDate(date, locale.value, 'EEEEEE').toUpperCase(),
      weekdayLong: formatDate(date, locale.value, 'EEEE'),
      dayOfMonth: formatDate(date, locale.value, 'd'),
      isToday: day.date === props.today,
      // Read after the visible day number: "Freitag, 16. Oktober, Training".
      rest: `. ${after.join(', ')}`,
    }
  }),
)
</script>

<template>
  <nav class="week-strip" :aria-label="label">
    <ol class="week-strip__days" role="list">
      <li v-for="day in items" :key="day.date">
        <button
          type="button"
          class="week-strip__day"
          :class="{ 'week-strip__day--today': day.isToday }"
          :aria-pressed="selected === day.date"
          @click="selected = selected === day.date ? null : day.date"
        >
          <span class="week-strip__weekday" aria-hidden="true">{{ day.weekday }}</span>
          <span class="visually-hidden">{{ day.weekdayLong }}, </span>
          <span class="week-strip__number">{{ day.dayOfMonth }}</span>
          <span class="visually-hidden">{{ day.rest }}</span>
          <span class="week-strip__marks" aria-hidden="true">
            <span
              v-for="mark in day.marks"
              :key="mark"
              class="week-strip__mark"
              :class="`week-strip__mark--${mark}`"
            />
          </span>
        </button>
      </li>
    </ol>
  </nav>
</template>

<style scoped lang="scss">
.week-strip {
  &__days {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 4px;
    margin: 0;
  }

  &__day {
    @include focus-visible;

    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    width: 100%;
    min-height: 64px;
    padding: 6px 0 8px;
    border: 2px solid transparent;
    border-radius: $radius-lg;
    background: transparent;
    color: var(--color-text);

    &--today {
      border-color: var(--color-primary);
    }

    &[aria-pressed='true'] {
      background: var(--color-text);
      color: var(--color-bg);
    }
  }

  &__weekday {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.04em;
    opacity: 0.8;
  }

  &__number {
    font-family: var(--font-display);
    font-size: $font-xl;
    font-weight: 800;
    line-height: 1;
  }

  &__marks {
    display: flex;
    gap: 3px;
    height: 8px;
    align-items: center;
  }

  &__mark {
    width: 7px;
    height: 7px;

    &--training {
      border-radius: 50%;
      background: var(--color-training-text);
    }

    &--match {
      border-radius: 1px;
      background: var(--color-match-text);
    }

    &--event {
      background: var(--color-event-text);
      transform: rotate(45deg) scale(0.85);
    }
  }
}
</style>
