<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import BaseButton from '@/components/BaseButton.vue'
import BaseInput from '@/components/BaseInput.vue'
import AuthShell from '../components/AuthShell.vue'
import { MIN_PASSWORD_LENGTH, registerSchema } from '../schemas'
import { safeRedirect } from '../redirect'
import { authErrorKind } from '../api'
import { useSignUp } from '../composables/useAuth'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const signUp = useSignUp()

const { defineField, errors, handleSubmit } = useForm({
  validationSchema: toTypedSchema(registerSchema),
})
const [displayName] = defineField('displayName')
const [email] = defineField('email')
const [password] = defineField('password')
const [passwordConfirm] = defineField('passwordConfirm')

const confirmationSentTo = ref<string | null>(null)
const redirectPath = computed(() => safeRedirect(route.query.redirect))
const redirectQuery = computed(() =>
  route.query.redirect ? { redirect: route.query.redirect } : undefined,
)
const errorMessage = computed(() =>
  signUp.isError.value ? t(`auth.errors.${authErrorKind(signUp.error.value)}`) : null,
)

const onSubmit = handleSubmit(async (values) => {
  const { signedIn } = await signUp.mutateAsync({
    email: values.email,
    password: values.password,
    displayName: values.displayName,
    redirectPath: redirectPath.value,
  })
  if (signedIn) {
    await router.replace(redirectPath.value)
  } else {
    confirmationSentTo.value = values.email
  }
})
</script>

<template>
  <AuthShell
    :title="confirmationSentTo ? t('auth.confirmEmailTitle') : t('auth.createAccount')"
    :intro="confirmationSentTo ? undefined : t('auth.registerIntro')"
  >
    <p v-if="confirmationSentTo" role="status">
      {{ t('auth.confirmEmailText', { email: confirmationSentTo }) }}
    </p>

    <form v-else class="auth-form" novalidate @submit="onSubmit">
      <BaseInput
        v-model="displayName"
        :label="t('profile.displayName')"
        :hint="t('profile.displayNameHint')"
        autocomplete="name"
        required
        :error="errors.displayName ? t(errors.displayName) : undefined"
      />
      <BaseInput
        v-model="email"
        :label="t('auth.email')"
        type="email"
        autocomplete="email"
        required
        :error="errors.email ? t(errors.email) : undefined"
      />
      <BaseInput
        v-model="password"
        :label="t('auth.password')"
        type="password"
        autocomplete="new-password"
        :hint="t('auth.passwordHint', { min: MIN_PASSWORD_LENGTH })"
        required
        :error="errors.password ? t(errors.password, { min: MIN_PASSWORD_LENGTH }) : undefined"
      />
      <BaseInput
        v-model="passwordConfirm"
        :label="t('auth.passwordConfirm')"
        type="password"
        autocomplete="new-password"
        required
        :error="errors.passwordConfirm ? t(errors.passwordConfirm) : undefined"
      />
      <p v-if="errorMessage" class="auth-form__error" role="alert">{{ errorMessage }}</p>
      <BaseButton type="submit" size="lg" block :loading="signUp.isPending.value">
        {{ t('auth.createAccount') }}
      </BaseButton>
    </form>

    <template #footer>
      <span>{{ t('auth.haveAccount') }}</span>
      <RouterLink :to="{ name: 'login', query: redirectQuery }">{{ t('auth.signIn') }}</RouterLink>
    </template>
  </AuthShell>
</template>
