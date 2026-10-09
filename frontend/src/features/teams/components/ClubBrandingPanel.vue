<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/components/BaseButton.vue'
import { accentTheme, extractPalette } from '@/lib/color'
import { clubLogoUrl } from '@/lib/clubTheme'
import { downscale, loadImage, samplePixels } from '@/lib/image'
import type { Club } from '../api'
import { useSaveClubBranding } from '../composables/useTeams'

const props = defineProps<{ club: Club }>()

const { t } = useI18n()
const save = useSaveClubBranding()

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp']
const MAX_INPUT_BYTES = 10 * 1024 * 1024

const fileInput = ref<HTMLInputElement | null>(null)
const newLogo = ref<Blob | null>(null)
const newLogoUrl = ref<string | null>(null)
const removeLogo = ref(false)
const palette = ref<string[]>([])
const color = ref<string | null>(props.club.accent_color)
const fileError = ref<string | null>(null)
const saved = ref(false)

const currentLogoUrl = computed(() =>
  props.club.logo_path ? clubLogoUrl(props.club.logo_path) : null,
)
const previewUrl = computed(
  () => newLogoUrl.value ?? (removeLogo.value ? null : currentLogoUrl.value),
)
const dirty = computed(
  () => !!newLogo.value || removeLogo.value || color.value !== props.club.accent_color,
)
/** Shows how buttons and links will look (adjusted for readability). */
const theme = computed(() => (color.value ? accentTheme(color.value) : null))
const previewStyle = computed(() =>
  theme.value
    ? {
        '--preview-bg': theme.value.light.primary,
        '--preview-text': theme.value.light.contrast,
        '--preview-bg-dark': theme.value.dark.primary,
        '--preview-text-dark': theme.value.dark.contrast,
      }
    : undefined,
)

// Palette of the saved logo, so the color can be changed without uploading again.
watch(
  currentLogoUrl,
  async (url) => {
    if (!url || newLogo.value) return
    try {
      palette.value = extractPalette(samplePixels(await loadImage(url)))
    } catch {
      palette.value = []
    }
  },
  { immediate: true },
)

function setNewLogoUrl(url: string | null) {
  if (newLogoUrl.value) URL.revokeObjectURL(newLogoUrl.value)
  newLogoUrl.value = url
}
onBeforeUnmount(() => setNewLogoUrl(null))

async function onFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  ;(event.target as HTMLInputElement).value = ''
  if (!file) return
  fileError.value = null
  saved.value = false
  if (!ACCEPTED.includes(file.type)) {
    fileError.value = t('branding.errors.type')
    return
  }
  if (file.size > MAX_INPUT_BYTES) {
    fileError.value = t('branding.errors.size')
    return
  }
  const source = URL.createObjectURL(file)
  try {
    const img = await loadImage(source)
    const blob = await downscale(img)
    newLogo.value = blob
    removeLogo.value = false
    setNewLogoUrl(URL.createObjectURL(blob))
    palette.value = extractPalette(samplePixels(img))
    color.value = palette.value[0] ?? null
  } catch {
    fileError.value = t('branding.errors.read')
  } finally {
    URL.revokeObjectURL(source)
  }
}

function onRemove() {
  newLogo.value = null
  setNewLogoUrl(null)
  removeLogo.value = true
  palette.value = []
  saved.value = false
}

function pick(value: string | null) {
  color.value = value
  saved.value = false
}

async function onSave() {
  saved.value = false
  await save.mutateAsync({
    clubId: props.club.id,
    currentLogoPath: props.club.logo_path,
    newLogo: newLogo.value,
    removeLogo: removeLogo.value,
    accentColor: color.value,
  })
  newLogo.value = null
  setNewLogoUrl(null)
  removeLogo.value = false
  saved.value = true
}
</script>

<template>
  <div class="branding">
    <div class="branding__logo-row">
      <div class="branding__logo">
        <img v-if="previewUrl" :src="previewUrl" :alt="t('branding.logoAlt')" />
        <span v-else class="branding__placeholder" aria-hidden="true">⚽</span>
      </div>
      <div class="branding__logo-actions">
        <BaseButton variant="secondary" block @click="fileInput?.click()">
          {{ previewUrl ? t('branding.replace') : t('branding.upload') }}
        </BaseButton>
        <BaseButton v-if="previewUrl" variant="ghost" block @click="onRemove">
          {{ t('branding.remove') }}
        </BaseButton>
      </div>
      <input
        ref="fileInput"
        class="branding__file"
        type="file"
        :accept="ACCEPTED.join(',')"
        :aria-label="t('branding.upload')"
        @change="onFile"
      />
    </div>
    <p class="branding__hint">{{ t('branding.hint') }}</p>
    <p v-if="fileError" class="branding__error" role="alert">{{ fileError }}</p>

    <fieldset class="branding__colors">
      <legend class="branding__legend">{{ t('branding.color') }}</legend>
      <p v-if="previewUrl && !palette.length" class="branding__hint">
        {{ t('branding.noColors') }}
      </p>
      <div class="branding__swatches">
        <button
          v-for="value in palette"
          :key="value"
          type="button"
          class="branding__swatch"
          :style="{ background: value }"
          :aria-pressed="color === value"
          :aria-label="t('branding.logoColor', { color: value })"
          @click="pick(value)"
        />
        <label class="branding__swatch branding__swatch--custom" :title="t('branding.custom')">
          <input
            type="color"
            :value="color ?? '#15803d'"
            :aria-label="t('branding.custom')"
            @input="pick(($event.target as HTMLInputElement).value)"
          />
        </label>
        <button
          type="button"
          class="branding__default"
          :aria-pressed="color === null"
          @click="pick(null)"
        >
          {{ t('branding.default') }}
        </button>
      </div>
    </fieldset>

    <div class="branding__preview" :style="previewStyle" aria-hidden="true">
      <span class="branding__preview-button">{{ t('branding.previewButton') }}</span>
      <span class="branding__preview-link">{{ t('branding.previewLink') }}</span>
    </div>
    <p
      v-if="color && theme && (theme.light.primary !== color || theme.dark.primary !== color)"
      class="branding__hint"
    >
      {{ t('branding.adjusted') }}
    </p>

    <p v-if="save.isError.value" class="branding__error" role="alert">
      {{ t('branding.errors.save') }}
    </p>
    <p v-if="saved" class="branding__saved" role="status">✓ {{ t('branding.saved') }}</p>
    <BaseButton block :disabled="!dirty" :loading="save.isPending.value" @click="onSave">
      {{ t('common.save') }}
    </BaseButton>
  </div>
</template>

<style scoped lang="scss">
.branding {
  display: flex;
  flex-direction: column;
  gap: $space-3;

  &__logo-row {
    display: flex;
    align-items: center;
    gap: $space-4;
  }

  &__logo {
    flex: none;
    display: grid;
    place-items: center;
    width: 96px;
    height: 96px;
    border: 1px solid var(--color-border);
    border-radius: $radius-lg;
    background: var(--color-surface-muted);

    img {
      width: 84px;
      height: 84px;
      object-fit: contain;
    }
  }

  &__placeholder {
    font-size: 2.5rem;
    opacity: 0.5;
  }

  &__logo-actions {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: $space-1;
  }

  &__file {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  }

  &__colors {
    display: flex;
    flex-direction: column;
    gap: $space-2;
    border: 0;
    padding: 0;
    margin: 0;
  }

  &__legend {
    font-weight: 600;
    margin-bottom: $space-2;
  }

  &__swatches {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: $space-2;
  }

  &__swatch {
    @include focus-visible;

    position: relative;
    width: $touch-target;
    height: $touch-target;
    border: 2px solid var(--color-border);
    border-radius: 50%;
    cursor: pointer;

    &[aria-pressed='true'] {
      outline: 3px solid var(--color-text);
      outline-offset: 2px;
    }

    &--custom {
      overflow: hidden;
      background: conic-gradient(red, yellow, lime, cyan, blue, magenta, red);

      input {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        opacity: 0;
        cursor: pointer;
      }

      &:focus-within {
        outline: 3px solid var(--color-focus);
        outline-offset: 2px;
      }
    }
  }

  &__default {
    @include focus-visible;

    min-height: $touch-target;
    padding-inline: $space-3;
    border: 1px solid var(--color-border);
    border-radius: $radius-full;
    background: var(--color-surface);
    color: var(--color-text);
    font-weight: 600;

    &[aria-pressed='true'] {
      border-color: var(--color-text);
      border-width: 2px;
    }
  }

  &__preview {
    // Inline style provides --preview-*; defaults are the app's own green.
    --bg: var(--preview-bg, #15803d);
    --text: var(--preview-text, #fff);

    @media (prefers-color-scheme: dark) {
      --bg: var(--preview-bg-dark, #3ccf72);
      --text: var(--preview-text-dark, #08160d);
    }

    display: flex;
    align-items: center;
    gap: $space-4;
    padding: $space-3;
    border-radius: $radius-md;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
  }

  &__preview-button {
    padding: $space-2 $space-4;
    border-radius: $radius-md;
    background: var(--bg);
    color: var(--text);
    font-weight: 700;
  }

  &__preview-link {
    color: var(--bg);
    font-weight: 700;
    text-decoration: underline;
  }

  &__hint {
    font-size: $font-sm;
    color: var(--color-text-muted);
  }

  &__error {
    color: var(--color-danger);
  }

  &__saved {
    color: var(--color-success);
    font-weight: 600;
  }
}
</style>
