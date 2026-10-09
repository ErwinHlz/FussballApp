<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/components/BaseButton.vue'
import {
  disablePush,
  enablePush,
  getPushState,
  isIosWithoutInstall,
  sendTestPush,
  type PushState,
} from '@/lib/push'

const { t, locale } = useI18n()
const state = ref<PushState | null>(null)
const busy = ref(false)
const error = ref(false)
const testSent = ref(false)
const iosHint = isIosWithoutInstall()

onMounted(async () => {
  state.value = await getPushState()
})

async function run(action: () => Promise<PushState | void>) {
  busy.value = true
  error.value = false
  testSent.value = false
  try {
    const next = await action()
    if (next) state.value = next
  } catch {
    error.value = true
  } finally {
    busy.value = false
  }
}

const enable = () => run(() => enablePush(locale.value))
const disable = () => run(disablePush)
const test = () =>
  run(async () => {
    await sendTestPush()
    testSent.value = true
  })
</script>

<template>
  <div class="notifications">
    <p class="notifications__text">{{ t('push.intro') }}</p>

    <p v-if="state === null" class="notifications__muted">{{ t('common.loading') }}</p>
    <p v-else-if="state === 'unsupported'" class="notifications__muted">
      {{ iosHint ? t('push.ios') : t('push.unsupported') }}
    </p>
    <p v-else-if="state === 'unconfigured'" class="notifications__muted">
      {{ t('push.unconfigured') }}
    </p>
    <p v-else-if="state === 'denied'" class="notifications__muted" role="alert">
      {{ t('push.denied') }}
    </p>

    <template v-else>
      <p class="notifications__status" role="status">
        <span aria-hidden="true">{{ state === 'on' ? '🔔' : '🔕' }}</span>
        {{ state === 'on' ? t('push.on') : t('push.off') }}
      </p>
      <BaseButton v-if="state === 'off'" block :loading="busy" @click="enable">
        {{ t('push.enable') }}
      </BaseButton>
      <div v-else class="notifications__actions">
        <BaseButton variant="secondary" :loading="busy" @click="test">{{
          t('push.test')
        }}</BaseButton>
        <BaseButton variant="ghost" :disabled="busy" @click="disable">{{
          t('push.disable')
        }}</BaseButton>
      </div>
      <p v-if="testSent" class="notifications__done" role="status">✓ {{ t('push.testSent') }}</p>
    </template>

    <p v-if="error" class="notifications__error" role="alert">{{ t('push.failed') }}</p>
  </div>
</template>

<style scoped lang="scss">
.notifications {
  display: flex;
  flex-direction: column;
  gap: $space-2;

  &__text,
  &__muted {
    font-size: $font-sm;
    color: var(--color-text-muted);
  }

  &__status {
    font-weight: 700;
  }

  &__actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: $space-2;
  }

  &__done {
    color: var(--color-success);
    font-weight: 600;
  }

  &__error {
    color: var(--color-danger);
  }
}
</style>
