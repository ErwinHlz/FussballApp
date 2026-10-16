<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { format } from 'date-fns'
import UiButton from '@/ui/UiButton.vue'
import UiInput from '@/ui/UiInput.vue'
import BottomSheet from '@/ui/BottomSheet.vue'
import { deleteMyAccount, exportMyData, isSoleAdminError } from '../api'

const { t } = useI18n()
const router = useRouter()
const queryClient = useQueryClient()

const exporting = ref(false)
const exportFailed = ref(false)
const deleteOpen = ref(false)
const confirmation = ref('')
const confirmWord = computed(() => t('account.confirmWord'))

const remove = useMutation({
  mutationFn: deleteMyAccount,
  onSuccess: async () => {
    queryClient.clear()
    await router.replace({ name: 'login', query: { deleted: '1' } })
  },
})

async function download() {
  exporting.value = true
  exportFailed.value = false
  try {
    const data = await exportMyData()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `rondo-daten-${format(new Date(), 'yyyy-MM-dd')}.json`
    link.click()
    URL.revokeObjectURL(url)
  } catch {
    exportFailed.value = true
  } finally {
    exporting.value = false
  }
}

function openDelete() {
  confirmation.value = ''
  remove.reset()
  deleteOpen.value = true
}
</script>

<template>
  <div class="account">
    <p class="account__text">{{ t('account.exportText') }}</p>
    <UiButton variant="secondary" block :loading="exporting" @click="download">
      {{ t('account.export') }}
    </UiButton>
    <p v-if="exportFailed" class="account__error" role="alert">{{ t('account.exportFailed') }}</p>

    <UiButton variant="ghost" block @click="openDelete">{{ t('account.delete') }}</UiButton>

    <BottomSheet v-model:open="deleteOpen" :title="t('account.deleteTitle')">
      <div class="account__dialog">
        <p>{{ t('account.deleteText') }}</p>
        <ul class="account__list">
          <li>{{ t('account.deleteItems.memberships') }}</li>
          <li>{{ t('account.deleteItems.answers') }}</li>
          <li>{{ t('account.deleteItems.clubs') }}</li>
        </ul>
        <UiInput
          v-model="confirmation"
          :label="t('account.confirmLabel', { word: confirmWord })"
          autocomplete="off"
        />
        <p v-if="remove.isError.value" class="account__error" role="alert">
          {{
            isSoleAdminError(remove.error.value)
              ? t('account.soleAdmin')
              : t('account.deleteFailed')
          }}
        </p>
      </div>
      <template #footer>
        <UiButton variant="secondary" @click="deleteOpen = false">{{
          t('common.cancel')
        }}</UiButton>
        <UiButton
          variant="danger"
          :disabled="confirmation.trim().toUpperCase() !== confirmWord.toUpperCase()"
          :loading="remove.isPending.value"
          @click="remove.mutate()"
        >
          {{ t('account.deleteFinal') }}
        </UiButton>
      </template>
    </BottomSheet>
  </div>
</template>

<style scoped lang="scss">
.account {
  display: flex;
  flex-direction: column;
  gap: $space-2;

  &__text {
    font-size: $font-sm;
    color: var(--color-text-muted);
  }

  &__dialog {
    display: flex;
    flex-direction: column;
    gap: $space-3;
  }

  &__list {
    padding-left: $space-5;
    font-size: $font-sm;
  }

  &__error {
    color: var(--color-danger);
  }
}
</style>
