<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRafFn } from '@vueuse/core'
import { advance, easeInOut, linear, positionsAt, resolveKeyframes } from '../interpolate'
import type { Animation } from '../schema'
import BoardScene from './BoardScene.vue'

const props = defineProps<{ animation: Animation; title: string }>()

const { t } = useI18n()
const time = ref(0)
const speed = ref(1)
const loop = ref(true)
const smooth = ref(true)

const resolved = computed(() => resolveKeyframes(props.animation))
const positions = computed(() =>
  positionsAt(props.animation, time.value, smooth.value ? easeInOut : linear, resolved.value),
)

// Playback clock. Starts paused (no autoplay; respects reduced-motion preferences).
const {
  pause,
  resume,
  isActive: playing,
} = useRafFn(
  ({ delta }) => {
    const next = advance(time.value, delta, speed.value, props.animation.durationMs, loop.value)
    time.value = next.time
    if (next.ended) pause()
  },
  { immediate: false },
)

watch(
  () => props.animation,
  () => {
    pause()
    time.value = 0
  },
)

function toggle() {
  if (playing.value) return pause()
  if (time.value >= props.animation.durationMs) time.value = 0
  resume()
}

function restart() {
  time.value = 0
}

const seconds = (ms: number) => (ms / 1000).toFixed(1)
const speeds = [0.5, 1, 2]
</script>

<template>
  <div class="player">
    <BoardScene
      :field="animation.field"
      :objects="animation.objects"
      :positions="positions"
      :annotations="animation.annotations"
      :title="title"
    />

    <div class="player__controls">
      <button
        type="button"
        class="player__play"
        :aria-label="playing ? t('board.player.pause') : t('board.player.play')"
        @click="toggle"
      >
        <span aria-hidden="true">{{ playing ? '❚❚' : '▶' }}</span>
      </button>
      <button
        type="button"
        class="player__button"
        :aria-label="t('board.player.restart')"
        @click="restart"
      >
        <span aria-hidden="true">⟲</span>
      </button>

      <input
        v-model.number="time"
        class="player__scrub"
        type="range"
        min="0"
        :max="animation.durationMs"
        step="10"
        :aria-label="t('board.player.position')"
        :aria-valuetext="
          t('board.player.secondsOf', { s: seconds(time), total: seconds(animation.durationMs) })
        "
        @input="pause()"
      />
      <span class="player__time" aria-hidden="true">{{ seconds(time) }} s</span>
    </div>

    <div class="player__options">
      <div class="player__speeds" role="group" :aria-label="t('board.player.speed')">
        <button
          v-for="s in speeds"
          :key="s"
          type="button"
          class="player__chip"
          :class="{ 'player__chip--on': speed === s }"
          :aria-pressed="speed === s"
          @click="speed = s"
        >
          {{ s }}×
        </button>
      </div>
      <button
        type="button"
        class="player__chip"
        :class="{ 'player__chip--on': loop }"
        :aria-pressed="loop"
        @click="loop = !loop"
      >
        ↻ {{ t('board.player.loop') }}
      </button>
      <button
        type="button"
        class="player__chip"
        :class="{ 'player__chip--on': smooth }"
        :aria-pressed="smooth"
        @click="smooth = !smooth"
      >
        {{ t('board.player.smooth') }}
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.player {
  display: flex;
  flex-direction: column;
  gap: $space-2;

  &__controls {
    display: flex;
    align-items: center;
    gap: $space-2;
  }

  &__play,
  &__button {
    @include touch-target;
    @include focus-visible;

    display: grid;
    flex-shrink: 0;
    place-items: center;
    border: 2px solid var(--color-border);
    border-radius: $radius-full;
    background: var(--color-surface);
    font-weight: 800;
  }

  &__play {
    width: 52px;
    height: 52px;
    border-color: var(--color-primary);
    background: var(--color-primary);
    color: var(--color-primary-contrast);
    font-size: $font-lg;
  }

  &__scrub {
    flex: 1;
    min-width: 0;
    min-height: $touch-target;
    accent-color: var(--color-primary);
  }

  &__time {
    width: 4.5ch;
    font-size: $font-sm;
    font-variant-numeric: tabular-nums;
    color: var(--color-text-muted);
  }

  &__options,
  &__speeds {
    display: flex;
    flex-wrap: wrap;
    gap: $space-1;
  }

  &__chip {
    @include touch-target;
    @include focus-visible;

    padding: 0 $space-3;
    border: 2px solid var(--color-border);
    border-radius: $radius-full;
    background: var(--color-surface);
    font-size: $font-sm;
    font-weight: 700;

    &--on {
      border-color: var(--color-primary);
      color: var(--color-primary-hover);
      background: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface));
    }
  }
}
</style>
