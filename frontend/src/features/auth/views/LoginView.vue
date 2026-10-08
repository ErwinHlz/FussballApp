<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import BaseButton from '@/components/BaseButton.vue'
import BaseCard from '@/components/BaseCard.vue'
import BaseInput from '@/components/BaseInput.vue'
import { loginSchema } from '../schemas'
import { safeRedirect } from '../redirect'
import { useSendMagicLink } from '../composables/useAuth'

const { t } = useI18n()
const route = useRoute()
const sendMagicLink = useSendMagicLink()

const { defineField, errors, handleSubmit } = useForm({
  validationSchema: toTypedSchema(loginSchema),
})
const [email] = defineField('email')

const sentTo = ref<string | null>(null)
const mailboxUrl = import.meta.env.DEV ? 'http://127.0.0.1:54324' : null

const onSubmit = handleSubmit(async (values) => {
  await sendMagicLink.mutateAsync({
    email: values.email,
    redirectPath: safeRedirect(route.query.redirect),
  })
  sentTo.value = values.email
})

function useOtherEmail() {
  sentTo.value = null
  sendMagicLink.reset()
}
</script>

<template>
  <main class="login">
    <div class="login__brand">
      <span class="login__logo" aria-hidden="true">⚽</span>
      <h1 class="login__title">{{ t('app.name') }}</h1>
      <p class="login__tagline">{{ t('auth.tagline') }}</p>
    </div>

    <BaseCard class="login__card">
      <div v-if="sentTo" class="login__sent" role="status">
        <h2>{{ t('auth.checkInbox') }}</h2>
        <p>{{ t('auth.linkSentTo', { email: sentTo }) }}</p>
        <p v-if="mailboxUrl" class="login__dev-hint">
          {{ t('auth.devMailbox') }}
          <a :href="mailboxUrl" target="_blank" rel="noopener">{{ mailboxUrl }}</a>
        </p>
        <BaseButton variant="secondary" block @click="useOtherEmail">
          {{ t('auth.useOtherEmail') }}
        </BaseButton>
      </div>

      <form v-else class="login__form" novalidate @submit="onSubmit">
        <h2>{{ t('auth.signIn') }}</h2>
        <p class="login__hint">{{ t('auth.magicLinkHint') }}</p>
        <BaseInput
          v-model="email"
          :label="t('auth.email')"
          type="email"
          autocomplete="email"
          placeholder="name@example.com"
          required
          :error="errors.email ? t(errors.email) : undefined"
        />
        <p v-if="sendMagicLink.isError.value" class="login__error" role="alert">
          {{ t('auth.sendFailed') }}
        </p>
        <BaseButton type="submit" size="lg" block :loading="sendMagicLink.isPending.value">
          {{ t('auth.sendLink') }}
        </BaseButton>
      </form>
    </BaseCard>
  </main>
</template>

<style scoped lang="scss">
.login {
  @include safe-area-padding(top, $space-7);
  @include safe-area-padding(bottom, $space-5);

  display: flex;
  flex-direction: column;
  gap: $space-5;
  max-width: 420px;
  margin: 0 auto;
  padding-inline: $space-4;

  &__brand {
    text-align: center;
  }

  &__logo {
    font-size: 3rem;
  }

  &__title {
    font-size: $font-2xl;
  }

  &__tagline,
  &__hint {
    color: var(--color-text-muted);
  }

  &__form,
  &__sent {
    display: flex;
    flex-direction: column;
    gap: $space-4;
  }

  &__error {
    color: var(--color-danger);
  }

  &__dev-hint {
    padding: $space-3;
    border-radius: $radius-md;
    background: var(--color-surface-muted);
    font-size: $font-sm;
    overflow-wrap: anywhere;
  }
}
</style>
