<script setup lang="ts">
import { computed } from 'vue'
import UiIcon from '@/ui/UiIcon.vue'
import BoardScene from '@/features/board/components/BoardScene.vue'
import { positionsAt } from '@/features/board/interpolate'
import { parseAnimation } from '@/features/board/schema'
import type { Drill } from '../logic'

/**
 * Preview of a drill: the first frame of its animation on a mini pitch, a play sign for a
 * video, otherwise a chalk drawing. Decorative: the title next to it names the drill. Video
 * thumbnails are not loaded from YouTube on purpose (no third-party request without consent).
 */
const props = withDefaults(
  defineProps<{
    drill: Pick<Drill, 'animation' | 'video_url' | 'video_path'>
    size?: 'tile' | 'small'
  }>(),
  { size: 'tile' },
)

const animation = computed(() => parseAnimation(props.drill.animation))
const positions = computed(() => (animation.value ? positionsAt(animation.value, 0) : {}))
const hasVideo = computed(() => !!props.drill.video_url || !!props.drill.video_path)
</script>

<template>
  <span class="drill-thumb" :class="`drill-thumb--${size}`" aria-hidden="true">
    <BoardScene
      v-if="animation"
      class="drill-thumb__scene"
      :field="animation.field"
      :objects="animation.objects"
      :positions="positions"
      :annotations="animation.annotations"
      title=""
    />
    <span v-else class="drill-thumb__empty">
      <svg viewBox="0 0 100 64" class="drill-thumb__chalk">
        <rect x="4" y="4" width="92" height="56" rx="3" />
        <path d="M50 4v56" />
        <circle cx="50" cy="32" r="11" />
      </svg>
      <UiIcon :name="hasVideo ? 'play' : 'cone'" :size="size === 'small' ? 20 : 30" />
    </span>
    <span v-if="hasVideo && animation" class="drill-thumb__badge">
      <UiIcon name="play" :size="14" />
    </span>
  </span>
</template>

<style scoped lang="scss">
.drill-thumb {
  position: relative;
  display: block;
  overflow: hidden;
  border-radius: $radius-lg;
  background: var(--color-pitch);
  aspect-ratio: 16 / 10;

  &--small {
    width: 64px;
    flex-shrink: 0;
    border-radius: $radius-md;
  }

  &__scene {
    width: 100%;
    height: 100%;
    pointer-events: none;

    :deep(svg) {
      width: 100%;
      height: 100%;
    }
  }

  &__empty {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    color: rgb(255 255 255 / 85%);
  }

  &__chalk {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    fill: none;
    stroke: rgb(255 255 255 / 30%);
    stroke-width: 1.5;
    stroke-dasharray: 4 3;
  }

  &__badge {
    position: absolute;
    right: 6px;
    bottom: 6px;
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: rgb(0 0 0 / 55%);
    color: #ffffff;
  }
}
</style>
