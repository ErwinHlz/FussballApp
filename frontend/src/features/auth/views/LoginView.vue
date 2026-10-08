<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import BaseButton from '@/components/BaseButton.vue'
import BaseInput from '@/components/BaseInput.vue'
import AuthShell from '../components/AuthShell.vue'
import { loginSchema } from '../schemas'
import { safeRedirect } from '../redirect'
import { authErrorKind } from '../api'
import { useSignIn } from '../composables/useAuth'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const signIn = useSignIn()

const { defineField, errors, handleSubmit } = useForm({
  validationSchema: toTypedSchema(loginSchema),
})
const [email] = defineField('email')
const [password] = defineField('password')

const redirectQuery = computed(() =>
  route.query.redirect ? { redirect: route.query.redirect } : undefined,
)
const errorMessage = computed(() =>
  signIn.isError.value ? t(`auth.errors.${authErrorKind(signIn.error.value)}`) : null,
)

const onSubmit = handleSubmit(async (values) => {
  await signIn.mutateAsync(values)
  await router.replace(safeRedirect(route.query.redirect))
})
</script>

<template>
  <AuthShell :title="t('auth.signIn')">
    <form class="auth-form" novalidate @submit="onSubmit">
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
        autocomplete="current-password"
        required
        :error="errors.password ? t(errors.password) : undefined"
      />
      <RouterLink class="auth-form__link" :to="{ name: 'forgot-password' }">
        {{ t('auth.forgotPassword') }}
      </RouterLink>
      <p v-if="errorMessage" class="auth-form__error" role="alert">{{ errorMessage }}</p>
      <BaseButton type="submit" size="lg" block :loading="signIn.isPending.value">
        {{ t('auth.signIn') }}
      </BaseButton>
    </form>

    <template #footer>
      <span>{{ t('auth.noAccount') }}</span>
      <RouterLink :to="{ name: 'register', query: redirectQuery }">
        {{ t('auth.createAccount') }}
      </RouterLink>
    </template>
  </AuthShell>
</template>
