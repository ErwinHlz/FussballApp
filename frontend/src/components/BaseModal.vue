<script setup lang="ts">
import { nextTick, ref, useId, watch } from 'vue'
import { onKeyStroke } from '@vueuse/core'
import { useI18n } from 'vue-i18n'

defineProps<{
  title: string
}>()

const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const titleId = useId()
const dialogRef = ref<HTMLElement | null>(null)
let lastFocused: HTMLElement | null = null

function close() {
  open.value = false
}

onKeyStroke('Escape', () => {
  if (open.value) close()
})

watch(open, async (isOpen) => {
  if (isOpen) {
    lastFocused = document.activeElement as HTMLElement | null
    await nextTick()
    dialogRef.value?.focus()
  } else {
    lastFocused?.focus()
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="base-modal">
      <div v-if="open" class="base-modal" @click.self="close">
        <div
          ref="dialogRef"
          class="base-modal__dialog"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          tabindex="-1"
        >
          <header class="base-modal__header">
            <h2 :id="titleId" class="base-modal__title">{{ title }}</h2>
            <button
              type="button"
              class="base-modal__close"
              :aria-label="t('common.close')"
              @click="close"
            >
              <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
              </svg>
            </button>
          </header>
          <div class="base-modal__body">
            <slot />
          </div>
          <footer v-if="$slots.footer" class="base-modal__footer">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
.base-modal {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgb(0 0 0 / 45%);

  @include from($bp-sm) {
    align-items: center;
    padding: $space-4;
  }

  &__dialog {
    @include safe-area-padding(bottom);

    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 520px;
    max-height: 90dvh;
    background: var(--color-surface);
    border-radius: $radius-lg $radius-lg 0 0;
    box-shadow: var(--shadow-lg);

    &:focus {
      outline: none;
    }

    @include from($bp-sm) {
      border-radius: $radius-lg;
    }
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $space-3;
    padding: $space-3 $space-3 $space-3 $space-4;
    border-bottom: 1px solid var(--color-border);
  }

  &__title {
    @include truncate;

    font-size: $font-lg;
  }

  &__close {
    @include touch-target;
    @include focus-visible;

    display: grid;
    place-items: center;
    border: 0;
    border-radius: $radius-md;
    background: transparent;
    color: var(--color-text-muted);
  }

  &__body {
    padding: $space-4;
    overflow-y: auto;
  }

  &__footer {
    display: flex;
    gap: $space-2;
    justify-content: flex-end;
    padding: $space-3 $space-4;
    border-top: 1px solid var(--color-border);
  }
}

.base-modal-enter-active,
.base-modal-leave-active {
  transition: opacity 0.2s ease;
}

.base-modal-enter-from,
.base-modal-leave-to {
  opacity: 0;
}
</style>
