<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/components/BaseButton.vue'
import BaseInput from '@/components/BaseInput.vue'
import BaseModal from '@/components/BaseModal.vue'
import type { Template } from '../api'
import { useCreateTemplateFromEvent } from '../composables/useTemplates'

/** Plan editor: saves the current plan as a new template. */
const props = defineProps<{ eventId: string }>()
const emit = defineEmits<{ created: [template: Template] }>()
const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const create = useCreateTemplateFromEvent()
const title = ref('')
const shared = ref(false)
const titleError = ref<string | undefined>()

watch(open, (isOpen) => {
  if (!isOpen) return
  title.value = ''
  shared.value = false
  titleError.value = undefined
  create.reset()
})

async function save() {
  const value = title.value.trim()
  if (value.length < 2 || value.length > 80) {
    titleError.value = value.length < 2 ? t('validation.minLength2') : t('validation.maxLength80')
    return
  }
  const template = await create.mutateAsync({
    eventId: props.eventId,
    title: value,
    shared: shared.value,
  })
  open.value = false
  emit('created', template)
}
</script>

<template>
  <BaseModal v-model:open="open" :title="t('templates.saveAsTitle')">
    <form class="save" novalidate @submit.prevent="save">
      <BaseInput
        v-model="title"
        :label="t('templates.name')"
        :placeholder="t('templates.namePlaceholder')"
        required
        :error="titleError"
      />
      <label class="save__check">
        <input v-model="shared" type="checkbox" class="save__box" />
        <span>
          {{ t('templates.shareLabel') }}
          <span class="save__muted">{{ t('templates.shareHint') }}</span>
        </span>
      </label>
      <p v-if="create.isError.value" class="save__error" role="alert">
        {{ t('templates.saveFailed') }}
      </p>
    </form>
    <template #footer>
      <BaseButton variant="secondary" @click="open = false">{{ t('common.cancel') }}</BaseButton>
      <BaseButton :loading="create.isPending.value" @click="save">
        {{ t('common.save') }}
      </BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped lang="scss">
.save {
  display: flex;
  flex-direction: column;
  gap: $space-4;

  &__check {
    display: flex;
    align-items: flex-start;
    gap: $space-3;
  }

  &__box {
    @include focus-visible;

    flex: none;
    width: 22px;
    height: 22px;
    margin-top: 1px;
    accent-color: var(--color-primary);
  }

  &__muted {
    display: block;
    font-size: $font-sm;
    color: var(--color-text-muted);
  }

  &__error {
    color: var(--color-danger);
  }
}
</style>
