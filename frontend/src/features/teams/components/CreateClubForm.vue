<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import UiButton from '@/ui/UiButton.vue'
import UiInput from '@/ui/UiInput.vue'
import type { Club } from '../api'
import { clubSchema } from '../schemas'
import { useCreateClub } from '../composables/useTeams'

const emit = defineEmits<{ created: [club: Club] }>()

const { t } = useI18n()
const createClub = useCreateClub()

const { defineField, errors, handleSubmit } = useForm({
  validationSchema: toTypedSchema(clubSchema),
})
const [name] = defineField('name')

const onSubmit = handleSubmit(async (values) => {
  const club = await createClub.mutateAsync(values.name)
  emit('created', club)
})
</script>

<template>
  <form class="create-club" novalidate @submit="onSubmit">
    <UiInput
      v-model="name"
      :label="t('clubs.name')"
      :placeholder="t('clubs.namePlaceholder')"
      required
      :error="errors.name ? t(errors.name) : undefined"
    />
    <p v-if="createClub.isError.value" class="create-club__error" role="alert">
      {{ t('clubs.createFailed') }}
    </p>
    <UiButton type="submit" block :loading="createClub.isPending.value">
      {{ t('clubs.create') }}
    </UiButton>
  </form>
</template>

<style scoped lang="scss">
.create-club {
  display: flex;
  flex-direction: column;
  gap: $space-4;

  &__error {
    color: var(--color-danger);
  }
}
</style>
