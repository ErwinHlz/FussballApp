<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import UiIcon from '@/ui/UiIcon.vue'
import { useSnackbar } from '@/ui/useSnackbar'
import { extractPalette } from '@/lib/color'
import { clubLogoUrl } from '@/lib/clubTheme'
import { loadImage, samplePixels } from '@/lib/image'
import { useActiveTeam } from '@/features/teams/composables/useActiveTeam'
import { useProfile, useUpdateProfile } from '../composables/useProfile'

/**
 * Accent color of this account. Standard is the club's color (from the logo); the other logo
 * colors, a few suggestions, the app's green or any own color are one tap away and saved
 * right away. NULL = club color, 'default' = the app's green.
 */
const { t } = useI18n()
const snackbar = useSnackbar()
const profile = useProfile()
const update = useUpdateProfile()
const { activeTeam } = useActiveTeam()

const RONDO_GREEN = '#3f6212'
const SUGGESTIONS = ['#1d4ed8', '#b91c1c', '#c2410c', '#6d28d9', '#0f766e', '#be185d']

const current = computed(() => profile.data.value?.accent_color ?? null)
const clubColor = computed(() => activeTeam.value?.club_accent_color ?? null)

// More colors of the club's logo as suggestions.
const logoColors = ref<string[]>([])
watch(
  () => activeTeam.value?.club_logo_path ?? null,
  async (path) => {
    logoColors.value = []
    if (!path) return
    try {
      logoColors.value = extractPalette(samplePixels(await loadImage(clubLogoUrl(path))))
    } catch {
      logoColors.value = []
    }
  },
  { immediate: true },
)
const others = computed(() =>
  [...new Set([...logoColors.value, ...SUGGESTIONS])].filter(
    (c) => c !== clubColor.value?.toLowerCase(),
  ),
)
const isCustom = computed(
  () =>
    !!current.value &&
    current.value !== 'default' &&
    !others.value.includes(current.value) &&
    current.value !== clubColor.value,
)

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
    <button
      type="button"
      class="accent__club"
      :aria-pressed="current === null"
      @click="choose(null)"
    >
      <span
        class="accent__dot"
        :style="{ background: clubColor ?? RONDO_GREEN }"
        aria-hidden="true"
      />
      <span class="accent__club-text">
        <span class="accent__club-title">{{ t('profile.accent.club') }}</span>
        <span class="accent__club-hint">
          {{ clubColor ? t('profile.accent.clubHint') : t('profile.accent.clubNone') }}
        </span>
      </span>
      <UiIcon v-if="current === null" name="check" :size="20" />
    </button>

    <div class="accent__swatches">
      <button
        type="button"
        class="accent__swatch"
        :style="{ background: RONDO_GREEN }"
        :aria-pressed="current === 'default'"
        :aria-label="t('profile.accent.rondo')"
        @click="choose('default')"
      />
      <button
        v-for="color in others"
        :key="color"
        type="button"
        class="accent__swatch"
        :style="{ background: color }"
        :aria-pressed="current === color"
        :aria-label="
          logoColors.includes(color)
            ? t('profile.accent.logoColor', { color })
            : t('profile.accent.color', { color })
        "
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

  &__club {
    @include focus-visible;

    display: flex;
    align-items: center;
    gap: $space-3;
    min-height: 56px;
    padding: $space-2 $space-3;
    border: 2px solid var(--color-border);
    border-radius: $radius-lg;
    background: transparent;
    color: var(--color-text);
    text-align: left;

    &[aria-pressed='true'] {
      border-color: var(--color-text);
    }
  }

  &__dot {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    border-radius: 50%;
  }

  &__club-text {
    display: flex;
    flex: 1;
    flex-direction: column;
  }

  &__club-title {
    font-weight: 800;
  }

  &__club-hint,
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
