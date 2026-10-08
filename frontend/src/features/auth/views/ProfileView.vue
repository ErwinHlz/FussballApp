<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import BaseButton from '@/components/BaseButton.vue'
import BaseCard from '@/components/BaseCard.vue'
import BaseInput from '@/components/BaseInput.vue'
import { useAuthStore } from '@/stores/auth'
import { profileSchema } from '../schemas'
import { useProfile, useUpdateProfile } from '../composables/useProfile'
import { useSignOut } from '../composables/useAuth'

const { t } = useI18n()
const auth = useAuthStore()
const profile = useProfile()
const updateProfile = useUpdateProfile()
const signOut = useSignOut()

const { defineField, errors, handleSubmit, resetForm, meta } = useForm({
  validationSchema: toTypedSchema(profileSchema),
})
const [displayName] = defineField('displayName')
const saved = ref(false)

watch(
  () => profile.data.value,
  (value) => {
    if (value) resetForm({ values: { displayName: value.display_name } })
  },
  { immediate: true },
)

const onSubmit = handleSubmit(async (values) => {
  saved.value = false
  const updated = await updateProfile.mutateAsync({ display_name: values.displayName })
  resetForm({ values: { displayName: updated.display_name } })
  saved.value = true
})
</script>

<template>
  <section class="profile">
    <h1 class="profile__title">{{ t('profile.title') }}</h1>

    <p v-if="profile.isPending.value" class="profile__status">{{ t('common.loading') }}</p>

    <BaseCard v-else-if="profile.isError.value">
      <p role="alert">{{ t('profile.loadFailed') }}</p>
      <BaseButton variant="secondary" @click="profile.refetch()">{{
        t('common.retry')
      }}</BaseButton>
    </BaseCard>

    <BaseCard v-else>
      <form class="profile__form" novalidate @submit="onSubmit">
        <BaseInput
          v-model="displayName"
          :label="t('profile.displayName')"
          :hint="t('profile.displayNameHint')"
          autocomplete="nickname"
          required
          :error="errors.displayName ? t(errors.displayName) : undefined"
          @update:model-value="saved = false"
        />
        <div class="profile__email">
          <span class="profile__label">{{ t('auth.email') }}</span>
          <span>{{ auth.user?.email }}</span>
        </div>
        <p v-if="updateProfile.isError.value" class="profile__error" role="alert">
          {{ t('profile.saveFailed') }}
        </p>
        <p v-if="saved" class="profile__saved" role="status">✓ {{ t('profile.saved') }}</p>
        <BaseButton
          type="submit"
          block
          :disabled="!meta.dirty"
          :loading="updateProfile.isPending.value"
        >
          {{ t('common.save') }}
        </BaseButton>
      </form>
    </BaseCard>

    <BaseButton
      variant="secondary"
      block
      :loading="signOut.isPending.value"
      @click="signOut.mutate()"
    >
      {{ t('auth.signOut') }}
    </BaseButton>
    <p v-if="signOut.isError.value" class="profile__error" role="alert">
      {{ t('auth.signOutFailed') }}
    </p>
  </section>
</template>

<style scoped lang="scss">
.profile {
  display: flex;
  flex-direction: column;
  gap: $space-4;

  &__form {
    display: flex;
    flex-direction: column;
    gap: $space-4;
  }

  &__email {
    display: flex;
    flex-direction: column;
    gap: $space-1;
    overflow-wrap: anywhere;
  }

  &__label {
    font-weight: 600;
    font-size: $font-sm;
  }

  &__status {
    color: var(--color-text-muted);
  }

  &__error {
    color: var(--color-danger);
  }

  &__saved {
    color: var(--color-success);
    font-weight: 600;
  }
}
</style>
