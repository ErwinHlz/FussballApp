<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import UiButton from '@/ui/UiButton.vue'
import { extractPalette } from '@/lib/color'
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
const fileError = ref<string | null>(null)
const saved = ref(false)

const currentLogoUrl = computed(() =>
  props.club.logo_path ? clubLogoUrl(props.club.logo_path) : null,
)
const previewUrl = computed(
  () => newLogoUrl.value ?? (removeLogo.value ? null : currentLogoUrl.value),
)
const dirty = computed(() => !!newLogo.value || removeLogo.value)
/**
 * The club's color is the strongest color of the logo. It is the default accent for all
 * members; everyone can pick an own one in the profile.
 */
const color = computed(() => {
  if (newLogo.value) return palette.value[0] ?? null
  if (removeLogo.value) return null
  return props.club.accent_color
})

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
        <UiButton variant="secondary" block @click="fileInput?.click()">
          {{ previewUrl ? t('branding.replace') : t('branding.upload') }}
        </UiButton>
        <UiButton v-if="previewUrl" variant="ghost" block @click="onRemove">
          {{ t('branding.remove') }}
        </UiButton>
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

    <p class="branding__club-color">
      <span class="branding__dot" :style="{ background: color ?? '#3f6212' }" aria-hidden="true" />
      {{ color ? t('branding.clubColor', { color }) : t('branding.clubColorNone') }}
    </p>
    <p class="branding__hint">{{ t('branding.colorHint') }}</p>

    <p v-if="save.isError.value" class="branding__error" role="alert">
      {{ t('branding.errors.save') }}
    </p>
    <p v-if="saved" class="branding__saved" role="status">✓ {{ t('branding.saved') }}</p>
    <UiButton block :disabled="!dirty" :loading="save.isPending.value" @click="onSave">
      {{ t('common.save') }}
    </UiButton>
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

  &__club-color {
    display: flex;
    align-items: center;
    gap: $space-2;
    font-weight: 700;
  }

  &__dot {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    border-radius: 50%;
  }

  &__file {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
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
