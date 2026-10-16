<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AreaNav, { type Area } from '@/ui/AreaNav.vue'

/** The team tab's areas: squad, statistics and the teams and clubs overview. */
defineProps<{ active: 'squad' | 'stats' | 'teams' }>()

const { t } = useI18n()
const areas = computed<Area[]>(() => [
  { key: 'squad', to: { name: 'squad' }, label: t('squad.title') },
  { key: 'stats', to: { name: 'stats' }, label: t('stats.title') },
  { key: 'teams', to: { name: 'teams' }, label: t('teams.nav') },
])
</script>

<template>
  <AreaNav :areas="areas" :active="active" :label="t('teams.navLabel')" />
</template>
