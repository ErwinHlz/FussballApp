<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { parseYouTubeId, youTubeEmbedUrl } from '../logic'

const props = defineProps<{ url: string; title: string }>()

const { t } = useI18n()
// Two-click solution: nothing is loaded from YouTube until the user asks for it.
const loaded = ref(false)
const videoId = computed(() => parseYouTubeId(props.url))
</script>

<template>
  <div v-if="videoId" class="youtube">
    <iframe
      v-if="loaded"
      class="youtube__frame"
      :src="`${youTubeEmbedUrl(videoId)}&autoplay=1`"
      :title="title"
      allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
      allowfullscreen
      referrerpolicy="strict-origin-when-cross-origin"
    />
    <button v-else type="button" class="youtube__placeholder" @click="loaded = true">
      <span class="youtube__play" aria-hidden="true">▶</span>
      <span class="youtube__label">{{ t('drills.video.load') }}</span>
      <span class="youtube__note">{{ t('drills.video.privacy') }}</span>
    </button>
  </div>
  <p v-else class="youtube__invalid">{{ t('drills.video.invalid') }}</p>
</template>

<style scoped lang="scss">
.youtube {
  overflow: hidden;
  aspect-ratio: 16 / 9;
  border-radius: $radius-lg;
  background: #0f172a;

  &__frame {
    width: 100%;
    height: 100%;
    border: 0;
  }

  &__placeholder {
    @include focus-visible;

    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: $space-2;
    width: 100%;
    height: 100%;
    padding: $space-4;
    border: 0;
    background: linear-gradient(135deg, #0f172a, #1e3a5f);
    color: #fff;
    text-align: center;
  }

  &__play {
    display: grid;
    place-items: center;
    width: 64px;
    height: 64px;
    border-radius: $radius-full;
    background: #dc2626;
    font-size: $font-xl;
  }

  &__label {
    font-weight: 700;
  }

  &__note {
    max-width: 36ch;
    font-size: $font-xs;
    opacity: 0.8;
  }

  &__invalid {
    font-size: $font-sm;
    color: var(--color-text-muted);
  }
}
</style>
