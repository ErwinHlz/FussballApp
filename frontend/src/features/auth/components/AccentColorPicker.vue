<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import UiIcon from '@/ui/UiIcon.vue'
import { useSnackbar } from '@/ui/useSnackbar'
import { useProfile, useUpdateProfile } from '../composables/useProfile'

/**
 * Accent color of this account: the app's green (standard), a few suggestions or any own
 * color, saved right away. NULL (or the older 'default') = the app's green.
 */
const { t } = useI18n()
const snackbar = useSnackbar()
const profile = useProfile()
const update = useUpdateProfile()

const RONDO_GREEN = '#3f6212'
const SUGGESTIONS = ['#1d4ed8', '#b91c1c', '#c2410c', '#6d28d9', '#0f766e', '#be185d']

const stored = computed(() => profile.data.value?.accent_color ?? null)
const current = computed(() => (stored.value === 'default' ? null : stored.value))
const isCustom = computed(() => !!current.value && !SUGGESTIONS.includes(current.value))

async function choose(value: string | null) {
  if (value === current.value) return
  try {
    await update.mutateAsync({ accent_color: value })
    snackbar.show({ text: t('profile.accent.saved') })
  } catch {
    snackbar.show({ text: t('profile.saveFailed'), tone: 'error' })
  }
}

let customTimer: ReturnType<typeof setTimeout> | undefined
/** The color dialog reports every move; save once the choice settles. */
function onCustom(value: string) {
  clearTimeout(customTimer)
  customTimer = setTimeout(() => void choose(value.toLowerCase()), 400)
}
</script>

<template>
  <div class="accent" role="group" :aria-label="t('profile.accent.label')">
    <div class="accent__swatches">
      <button
        type="button"
        class="accent__swatch"
        :style="{ background: RONDO_GREEN }"
        :aria-pressed="current === null"
        :aria-label="t('profile.accent.rondo')"
        @click="choose(null)"
      />
      <button
        v-for="color in SUGGESTIONS"
        :key="color"
        type="button"
        class="accent__swatch"
        :style="{ background: color }"
        :aria-pressed="current === color"
        :aria-label="t('profile.accent.color', { color })"
        @click="choose(color)"
      />
      <label
        class="accent__swatch accent__swatch--custom"
        :class="{ 'accent__swatch--on': isCustom }"
        :style="isCustom ? { background: current! } : undefined"
      >
        <span class="visually-hidden">{{ t('profile.accent.custom') }}</span>
        <UiIcon v-if="!isCustom" name="plus" :size="20" />
        <input
          type="color"
          :value="isCustom ? current! : '#1d4ed8'"
          @input="onCustom(($event.target as HTMLInputElement).value)"
        />
      </label>
    </div>
    <p class="accent__hint">{{ t('profile.accent.hint') }}</p>
  </div>
</template>

<style scoped lang="scss">
.accent {
  display: flex;
  flex-direction: column;
  gap: $space-3;

  &__hint {
    color: var(--color-text-muted);
    font-size: $font-sm;
  }

  &__swatches {
    display: flex;
    flex-wrap: wrap;
    gap: $space-2;
  }

  &__swatch {
    @include focus-visible;

    position: relative;
    display: grid;
    place-items: center;
    width: $touch-target;
    height: $touch-target;
    border: 3px solid transparent;
    border-radius: 50%;
    box-shadow: inset 0 0 0 2px var(--color-surface);
    cursor: pointer;

    &[aria-pressed='true'],
    &--on {
      border-color: var(--color-text);
    }

    &--custom {
      border: 2px dashed var(--color-text-muted);
      color: var(--color-text-muted);
      box-shadow: none;

      &:focus-within {
        @include focus-ring;
      }

      input {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        opacity: 0;
        cursor: pointer;
      }
    }

    &--on {
      border-style: solid;
    }
  }
}
</style>
