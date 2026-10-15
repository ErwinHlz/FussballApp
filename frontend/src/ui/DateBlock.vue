<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatDate } from '@/lib/date'

/** Fixture-list style date: weekday above day and month, in the event type's text color. */
const props = withDefaults(
  defineProps<{ date: string | Date; tone?: 'training' | 'match' | 'event' | 'neutral' }>(),
  { tone: 'neutral' },
)

const { locale } = useI18n()
const iso = computed(() => new Date(props.date).toISOString())
const weekday = computed(() => formatDate(props.date, locale.value, 'EEEEEE').toUpperCase())
const day = computed(() => formatDate(props.date, locale.value, 'dd.MM.'))
const weekdayLong = computed(() => formatDate(props.date, locale.value, 'EEEE'))
</script>

<template>
  <!-- Screen readers hear the full weekday; the visible day and month stay in the name. -->
  <time class="date-block" :class="`date-block--${tone}`" :datetime="iso">
    <span class="date-block__weekday" aria-hidden="true">{{ weekday }}</span>
    <span class="visually-hidden">{{ weekdayLong }}, </span>
    <span class="date-block__day">{{ day }}</span>
  </time>
</template>

<style scoped lang="scss">
.date-block {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  align-items: center;
  width: 56px;
  font-family: var(--font-display);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  color: var(--color-text);

  @each $tone in training, match, event {
    &--#{$tone} {
      color: var(--color-#{$tone}-text);
    }
  }

  &__weekday {
    font-size: $font-sm;
    letter-spacing: 0.06em;
  }

  &__day {
    font-size: $font-xl;
  }
}
</style>
