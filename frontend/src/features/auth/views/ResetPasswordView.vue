<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import UiButton from '@/ui/UiButton.vue'
import UiInput from '@/ui/UiInput.vue'
import { useAuthStore } from '@/stores/auth'
import AuthShell from '../components/AuthShell.vue'
import { MIN_PASSWORD_LENGTH, resetPasswordSchema } from '../schemas'
import { authErrorKind } from '../api'
import { useUpdatePassword } from '../composables/useAuth'
import { DEFAULT_AUTHENTICATED_PATH } from '../redirect'

// Reached via the password-reset email: the link signs the user in (recovery session).
const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const updatePassword = useUpdatePassword()

const { defineField, errors, handleSubmit } = useForm({
  validationSchema: toTypedSchema(resetPasswordSchema),
})
const [password] = defineField('password')
const [passwordConfirm] = defineField('passwordConfirm')

const errorMessage = computed(() =>
  updatePassword.isError.value
    ? t(`auth.errors.${authErrorKind(updatePassword.error.value)}`)
    : null,
)

const onSubmit = handleSubmit(async (values) => {
  await updatePassword.mutateAsync(values.password)
  await router.replace(DEFAULT_AUTHENTICATED_PATH)
})
</script>

<template>
  <AuthShell :title="t('auth.resetPasswordTitle')">
    <form v-if="auth.isAuthenticated" class="auth-form" novalidate @submit="onSubmit">
      <UiInput
        v-model="password"
        :label="t('auth.newPassword')"
        type="password"
        autocomplete="new-password"
        :hint="t('auth.passwordHint', { min: MIN_PASSWORD_LENGTH })"
        required
        :error="errors.password ? t(errors.password, { min: MIN_PASSWORD_LENGTH }) : undefined"
      />
      <UiInput
        v-model="passwordConfirm"
        :label="t('auth.passwordConfirm')"
        type="password"
        autocomplete="new-password"
        required
        :error="errors.passwordConfirm ? t(errors.passwordConfirm) : undefined"
      />
      <p v-if="errorMessage" class="auth-form__error" role="alert">{{ errorMessage }}</p>
      <UiButton type="submit" size="lg" block :loading="updatePassword.isPending.value">
        {{ t('auth.savePassword') }}
      </UiButton>
    </form>

    <p v-else role="alert">{{ t('auth.resetLinkInvalid') }}</p>

    <template v-if="!auth.isAuthenticated" #footer>
      <RouterLink :to="{ name: 'forgot-password' }">{{ t('auth.requestNewLink') }}</RouterLink>
    </template>
  </AuthShell>
</template>
