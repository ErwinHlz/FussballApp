<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import BaseButton from '@/components/BaseButton.vue'
import BaseInput from '@/components/BaseInput.vue'
import AuthShell from '../components/AuthShell.vue'
import { forgotPasswordSchema } from '../schemas'
import { authErrorKind } from '../api'
import { useRequestPasswordReset } from '../composables/useAuth'

const { t } = useI18n()
const requestReset = useRequestPasswordReset()

const { defineField, errors, handleSubmit } = useForm({
  validationSchema: toTypedSchema(forgotPasswordSchema),
})
const [email] = defineField('email')

const sentTo = ref<string | null>(null)
const mailboxUrl = import.meta.env.DEV ? 'http://127.0.0.1:54324' : null
const errorMessage = computed(() =>
  requestReset.isError.value ? t(`auth.errors.${authErrorKind(requestReset.error.value)}`) : null,
)

const onSubmit = handleSubmit(async (values) => {
  await requestReset.mutateAsync(values.email)
  sentTo.value = values.email
})
</script>

<template>
  <AuthShell
    :title="t('auth.forgotPasswordTitle')"
    :intro="sentTo ? undefined : t('auth.forgotPasswordIntro')"
  >
    <div v-if="sentTo" class="auth-form" role="status">
      <p>{{ t('auth.resetLinkSent', { email: sentTo }) }}</p>
      <p v-if="mailboxUrl">
        {{ t('auth.devMailbox') }}
        <a :href="mailboxUrl" target="_blank" rel="noopener">{{ mailboxUrl }}</a>
      </p>
    </div>

    <form v-else class="auth-form" novalidate @submit="onSubmit">
      <BaseInput
        v-model="email"
        :label="t('auth.email')"
        type="email"
        autocomplete="email"
        required
        :error="errors.email ? t(errors.email) : undefined"
      />
      <p v-if="errorMessage" class="auth-form__error" role="alert">{{ errorMessage }}</p>
      <BaseButton type="submit" size="lg" block :loading="requestReset.isPending.value">
        {{ t('auth.sendResetLink') }}
      </BaseButton>
    </form>

    <template #footer>
      <RouterLink :to="{ name: 'login' }">{{ t('auth.backToSignIn') }}</RouterLink>
    </template>
  </AuthShell>
</template>
