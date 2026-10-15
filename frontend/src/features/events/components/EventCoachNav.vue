<script setup lang="ts">
import { useI18n } from 'vue-i18n'

/**
 * Coach view of a training: overview (answers, details), plan and groups are three views of
 * the same event. Links, so every view keeps its own address (deep links, back button).
 */
defineProps<{ eventId: string; active: 'event' | 'event-plan' | 'event-groups' }>()

const { t } = useI18n()
const views = [
  { name: 'event', labelKey: 'events.coachNav.overview' },
  { name: 'event-plan', labelKey: 'events.coachNav.plan' },
  { name: 'event-groups', labelKey: 'events.coachNav.groups' },
] as const
</script>

<template>
  <nav class="coach-nav" :aria-label="t('events.coachNav.label')">
    <RouterLink
      v-for="view in views"
      :key="view.name"
      :to="{ name: view.name, params: { eventId } }"
      replace
      class="coach-nav__link"
      :aria-current="active === view.name ? 'page' : undefined"
    >
      {{ t(view.labelKey) }}
    </RouterLink>
  </nav>
</template>

<style scoped lang="scss">
.coach-nav {
  display: grid;
  grid-auto-columns: minmax(0, 1fr);
  grid-auto-flow: column;
  gap: 4px;
  padding: 4px;
  border-radius: $radius-full;
  background: var(--color-surface-muted);

  &__link {
    @include focus-visible;

    display: grid;
    place-items: center;
    min-height: 44px;
    border-radius: $radius-full;
    color: var(--color-text);
    font-size: $font-sm;
    font-weight: 600;
    text-decoration: none;

    &[aria-current='page'] {
      background: var(--color-text);
      color: var(--color-bg);
      font-weight: 800;
    }
  }
}
</style>
