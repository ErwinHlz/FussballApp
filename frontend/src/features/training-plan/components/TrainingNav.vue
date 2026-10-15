<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActiveTeam } from '@/features/teams/composables/useActiveTeam'

/**
 * The training tab's areas: sessions, drill library, tactics boards and templates (the last two
 * for coaches). Links, so each area keeps its address and the back button works.
 */
defineProps<{ active: 'training' | 'drills' | 'tactic-boards' | 'templates' }>()

const { t } = useI18n()
const { isCoach } = useActiveTeam()
const areas = computed(() => [
  { name: 'training', label: t('training.nav.sessions') },
  { name: 'drills', label: t('training.nav.drills') },
  ...(isCoach.value
    ? [
        { name: 'tactic-boards', label: t('training.nav.boards') },
        { name: 'templates', label: t('training.nav.templates') },
      ]
    : []),
])
</script>

<template>
  <nav class="training-nav" :aria-label="t('training.nav.label')">
    <RouterLink
      v-for="area in areas"
      :key="area.name"
      :to="{ name: area.name }"
      class="training-nav__link"
      :aria-current="active === area.name ? 'page' : undefined"
    >
      {{ area.label }}
    </RouterLink>
  </nav>
</template>

<style scoped lang="scss">
.training-nav {
  display: flex;
  gap: $space-2;
  margin-inline: -$space-4;
  padding: 2px $space-4 $space-1;
  overflow-x: auto;
  scrollbar-width: none;

  &__link {
    @include focus-visible;

    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    min-height: $touch-target;
    padding: 0 $space-4;
    border: 2px solid var(--color-border);
    border-radius: $radius-full;
    color: var(--color-text);
    font-size: $font-sm;
    font-weight: 700;
    text-decoration: none;

    &[aria-current='page'] {
      border-color: var(--color-text);
      background: var(--color-text);
      color: var(--color-bg);
      font-weight: 800;
    }
  }
}
</style>
