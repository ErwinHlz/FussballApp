<script setup lang="ts">
import { onUnmounted, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import UiIcon from './UiIcon.vue'
import { useSnackbar } from './useSnackbar'

const { t } = useI18n()
const { current, dismiss, runAction } = useSnackbar()

// Floating buttons (FAB, "back to top") move up while a message is shown, so it never
// covers them.
watchEffect(() => {
  document.documentElement.style.setProperty('--snackbar-offset', current.value ? '64px' : '0px')
})
onUnmounted(() => document.documentElement.style.removeProperty('--snackbar-offset'))
</script>

<template>
  <!--
    The live region exists before any message, so screen readers announce new ones. No
    role="status": pages keep their own status messages unambiguous.
  -->
  <div class="snackbar-host" aria-live="polite" aria-atomic="true">
    <Transition name="snackbar">
      <div
        v-if="current"
        :key="current.id"
        class="snackbar"
        :class="{ 'snackbar--error': current.tone === 'error' }"
      >
        <UiIcon v-if="current.tone === 'error'" name="alert" :size="20" />
        <span class="snackbar__text">{{ current.text }}</span>
        <button v-if="current.action" type="button" class="snackbar__action" @click="runAction">
          <UiIcon name="undo" :size="18" />
          {{ current.action.label }}
        </button>
        <button
          type="button"
          class="snackbar__close"
          :aria-label="t('common.close')"
          @click="dismiss()"
        >
          <UiIcon name="x" :size="18" />
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped lang="scss">
.snackbar-host {
  position: fixed;
  inset-inline: $space-4;
  bottom: calc(var(--nav-offset, 0px) + #{$space-3} + env(safe-area-inset-bottom, 0px));
  z-index: 90;
  display: flex;
  justify-content: center;
  pointer-events: none;
}

.snackbar {
  display: flex;
  align-items: center;
  gap: $space-2;
  width: 100%;
  max-width: 520px;
  min-height: 52px;
  padding: $space-1 $space-1 $space-1 $space-4;
  border-radius: $radius-lg;
  background: var(--color-text);
  color: var(--color-bg);
  box-shadow: var(--shadow-float);
  font-weight: 600;
  pointer-events: auto;

  &--error {
    background: var(--color-danger);
    color: var(--color-danger-contrast);
  }

  &__text {
    flex: 1;
  }

  &__action,
  &__close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: $space-1;
    min-width: $touch-target;
    min-height: $touch-target;
    padding: 0 $space-3;
    border: 0;
    border-radius: $radius-md;
    background: transparent;
    color: inherit;
    font-weight: 800;

    &:focus-visible {
      outline: 3px solid currentColor;
      outline-offset: -3px;
    }
  }

  &__action {
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  &__close {
    padding: 0;
  }
}

.snackbar-enter-active,
.snackbar-leave-active {
  transition:
    opacity var(--duration-medium) var(--ease-out),
    transform var(--duration-medium) var(--ease-out);
}

.snackbar-enter-from,
.snackbar-leave-to {
  opacity: 0;
  transform: translateY(12px);
}
</style>
