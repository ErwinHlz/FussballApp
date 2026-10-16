<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import UiButton from '@/ui/UiButton.vue'
import UiInput from '@/ui/UiInput.vue'
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
const [consent] = defineField('consent')

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
      <UiInput
        v-model="displayName"
        :label="t('profile.displayName')"
        :hint="t('profile.displayNameHint')"
        autocomplete="name"
        required
        :error="errors.displayName ? t(errors.displayName) : undefined"
      />
      <UiInput
        v-model="email"
        :label="t('auth.email')"
        type="email"
        autocomplete="email"
        required
        :error="errors.email ? t(errors.email) : undefined"
      />
      <UiInput
        v-model="password"
        :label="t('auth.password')"
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
      <div class="consent">
        <label class="consent__label">
          <input
            v-model="consent"
            class="consent__box"
            type="checkbox"
            :aria-invalid="!!errors.consent"
            :aria-describedby="errors.consent ? 'consent-error' : undefined"
          />
          <i18n-t keypath="legal.consent" tag="span">
            <template #privacy>
              <RouterLink :to="{ name: 'privacy' }" target="_blank">{{
                t('legal.privacyPolicy')
              }}</RouterLink>
            </template>
          </i18n-t>
        </label>
        <p v-if="errors.consent" id="consent-error" class="auth-form__error">
          {{ t(errors.consent) }}
        </p>
      </div>
      <p v-if="errorMessage" class="auth-form__error" role="alert">{{ errorMessage }}</p>
      <UiButton type="submit" size="lg" block :loading="signUp.isPending.value">
        {{ t('auth.createAccount') }}
      </UiButton>
    </form>

    <template #footer>
      <span>{{ t('auth.haveAccount') }}</span>
      <RouterLink :to="{ name: 'login', query: redirectQuery }">{{ t('auth.signIn') }}</RouterLink>
    </template>
  </AuthShell>
</template>

<style scoped lang="scss">
.consent {
  display: flex;
  flex-direction: column;
  gap: $space-1;

  &__label {
    display: flex;
    align-items: flex-start;
    gap: $space-3;
    font-size: $font-sm;
    line-height: 1.5;
  }

  &__box {
    @include focus-visible;

    flex: none;
    width: 22px;
    height: 22px;
    margin-top: 1px;
    accent-color: var(--color-primary);
  }

  a {
    font-weight: 600;
  }
}
</style>
