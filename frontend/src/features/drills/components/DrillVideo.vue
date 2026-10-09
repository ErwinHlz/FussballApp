<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useDrillVideoUrl } from '../composables/useDrills'

/**
 * Plays an uploaded drill video (private bucket, signed URL).
 * Coach-recorded training clips have no caption track.
 */
const props = defineProps<{ path: string; title: string }>()

const { t } = useI18n()
const url = useDrillVideoUrl(() => props.path)
</script>

<template>
  <div class="drill-video">
    <p v-if="url.isPending.value" class="drill-video__muted">{{ t('common.loading') }}</p>
    <p v-else-if="url.isError.value" class="drill-video__error" role="alert">
      {{ t('drills.upload.loadFailed') }}
    </p>
    <video
      v-else
      class="drill-video__player"
      :src="url.data.value"
      :aria-label="title"
      controls
      playsinline
      preload="metadata"
    />
  </div>
</template>

<style scoped lang="scss">
.drill-video {
  &__player {
    display: block;
    width: 100%;
    max-height: 70dvh;
    border-radius: $radius-lg;
    background: #000;
  }

  &__muted {
    color: var(--color-text-muted);
  }

  &__error {
    color: var(--color-danger);
  }
}
</style>
