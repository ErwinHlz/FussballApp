<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AreaNav, { type Area } from '@/ui/AreaNav.vue'
import { useActiveTeam } from '@/features/teams/composables/useActiveTeam'

/**
 * The training tab's areas for coaches: sessions, drills, tactics boards, templates. Players
 * only have the drills (their trainings are under "Termine"), so they get no bar.
 */
defineProps<{ active: 'training' | 'drills' | 'tactic-boards' | 'templates' }>()

const { t } = useI18n()
const { isCoach } = useActiveTeam()
const areas = computed<Area[]>(() => [
  { key: 'training', to: { name: 'training' }, label: t('training.nav.sessions') },
  { key: 'drills', to: { name: 'drills' }, label: t('training.nav.drills') },
  { key: 'tactic-boards', to: { name: 'tactic-boards' }, label: t('training.nav.boards') },
  { key: 'templates', to: { name: 'templates' }, label: t('training.nav.templates') },
])
</script>

<template>
  <AreaNav v-if="isCoach" :areas="areas" :active="active" :label="t('training.nav.label')" />
</template>
