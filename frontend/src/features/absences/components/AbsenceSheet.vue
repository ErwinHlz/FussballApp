<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useQuery } from '@tanstack/vue-query'
import BottomSheet from '@/ui/BottomSheet.vue'
import { useSnackbar } from '@/ui/useSnackbar'
import { useAuthStore } from '@/stores/auth'
import { fetchMyMemberIds } from '../api'
import AbsenceForm from './AbsenceForm.vue'

/**
 * "I'm away": one absence for all own squad entries, from wherever it is needed (start page,
 * decline sheet, profile). Confirms with a snackbar.
 */
const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const auth = useAuthStore()
const snackbar = useSnackbar()
const memberIds = useQuery({
  queryKey: computed(() => ['my-member-ids', auth.userId] as const),
  queryFn: () => fetchMyMemberIds(auth.userId!),
  enabled: computed(() => !!auth.userId),
})

function onCreated(declined: number) {
  open.value = false
  snackbar.show({ text: t('absences.created', declined) })
}
</script>

<template>
  <BottomSheet v-model:open="open" :title="t('absences.add')">
    <p class="absence-sheet__intro">{{ t('absences.intro') }}</p>
    <AbsenceForm
      v-if="memberIds.data.value?.length"
      :member-ids="memberIds.data.value"
      @created="onCreated"
    />
  </BottomSheet>
</template>

<style scoped lang="scss">
.absence-sheet__intro {
  margin-bottom: $space-3;
  color: var(--color-text-muted);
  font-size: $font-sm;
}
</style>
