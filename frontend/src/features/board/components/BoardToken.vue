<script setup lang="ts">
import { computed } from 'vue'
import type { BoardObject } from '../schema'

/**
 * One board object drawn at the origin (SVG units are meters). Used on the field and, scaled
 * down, in the equipment palette. `r` is the base size of people and equipment.
 */
const props = defineProps<{ object: BoardObject; r: number }>()

const o = computed(() => props.object)
const color = computed(() => o.value.color ?? '#3b82f6')
const rotation = computed(() => (o.value.rotation ? `rotate(${o.value.rotation})` : undefined))
const ladderRungs = computed(() => Array.from({ length: 7 }, (_, i) => -props.r * 3 + i * props.r))
</script>

<template>
  <g :transform="rotation">
    <!-- People -->
    <template v-if="o.type === 'player'">
      <circle :r="r * 1.1" :fill="color" class="token__body" />
      <text v-if="o.label" class="token__label" :font-size="r * 1.1" dy="0.35em">
        {{ o.label }}
      </text>
    </template>
    <template v-else-if="o.type === 'goalkeeper'">
      <rect
        :x="-r * 1.05"
        :y="-r * 1.05"
        :width="r * 2.1"
        :height="r * 2.1"
        :rx="r * 0.45"
        :fill="color"
        class="token__body"
      />
      <text v-if="o.label" class="token__label" :font-size="r * 1.05" dy="0.35em">
        {{ o.label }}
      </text>
    </template>
    <template v-else-if="o.type === 'coach'">
      <path
        :d="`M 0 ${-r * 1.25} L ${r * 1.25} 0 L 0 ${r * 1.25} L ${-r * 1.25} 0 Z`"
        class="token__coach"
      />
    </template>
    <circle v-else-if="o.type === 'ball'" :r="r * 0.55" class="token__ball" />

    <!-- Equipment -->
    <path
      v-else-if="o.type === 'cone'"
      :d="`M 0 ${-r * 0.8} L ${r * 0.7} ${r * 0.6} L ${-r * 0.7} ${r * 0.6} Z`"
      :fill="color"
      class="token__equipment"
    />
    <template v-else-if="o.type === 'disc'">
      <circle :r="r * 0.55" :fill="color" class="token__equipment" />
      <circle :r="r * 0.2" class="token__hole" />
    </template>
    <template v-else-if="o.type === 'pole'">
      <circle :r="r * 0.4" :fill="color" class="token__pole" />
      <circle :r="r * 0.12" class="token__hole" />
    </template>
    <rect
      v-else-if="o.type === 'dummy'"
      :x="-r * 1.1"
      :y="-r * 0.35"
      :width="r * 2.2"
      :height="r * 0.7"
      :rx="r * 0.3"
      class="token__dummy"
    />
    <template v-else-if="o.type === 'minigoal'">
      <rect :x="-r * 1.3" :y="-r * 0.7" :width="r * 2.6" :height="r * 0.7" class="token__net" />
      <path
        :d="`M ${-r * 1.3} 0 L ${-r * 1.3} ${-r * 0.7} L ${r * 1.3} ${-r * 0.7} L ${r * 1.3} 0`"
        class="token__frame"
      />
    </template>
    <template v-else-if="o.type === 'goal'">
      <rect :x="-r * 2.2" :y="-r * 0.5" :width="r * 4.4" :height="r" class="token__net" />
      <path
        :d="`M ${-r * 2.2} ${r * 0.5} L ${-r * 2.2} ${-r * 0.5} L ${r * 2.2} ${-r * 0.5} L ${r * 2.2} ${r * 0.5}`"
        class="token__frame"
      />
    </template>
    <template v-else-if="o.type === 'ladder'">
      <rect :x="-r * 0.7" :y="-r * 3" :width="r * 1.4" :height="r * 6" class="token__ladder" />
      <line
        v-for="y in ladderRungs"
        :key="y"
        :x1="-r * 0.7"
        :x2="r * 0.7"
        :y1="y"
        :y2="y"
        class="token__ladder"
      />
    </template>
    <circle
      v-else-if="o.type === 'ring'"
      :r="r * 0.85"
      :stroke="color"
      :stroke-width="r * 0.22"
      fill="none"
    />

    <!-- Zones and markings -->
    <template v-else-if="o.type === 'zone'">
      <ellipse
        v-if="o.shape === 'circle'"
        :rx="(o.w ?? 10) / 2"
        :ry="(o.h ?? 10) / 2"
        :fill="color"
        :stroke="color"
        class="token__zone"
      />
      <rect
        v-else
        :x="-(o.w ?? 10) / 2"
        :y="-(o.h ?? 10) / 2"
        :width="o.w ?? 10"
        :height="o.h ?? 10"
        :fill="color"
        :stroke="color"
        class="token__zone"
      />
    </template>
    <text v-else-if="o.type === 'text'" class="token__text" :font-size="r * 1.05" dy="0.35em">
      {{ o.text }}
    </text>

    <!-- Name below people (not rotated with the object) -->
    <text
      v-if="o.name"
      class="token__name"
      :font-size="r * 0.75"
      :y="r * 2"
      :transform="o.rotation ? `rotate(${-o.rotation})` : undefined"
    >
      {{ o.name }}
    </text>
  </g>
</template>

<style scoped lang="scss">
.token {
  &__body {
    stroke: rgb(0 0 0 / 45%);
    stroke-width: 0.3;
  }

  &__label,
  &__text,
  &__name {
    fill: #fff;
    font-weight: 800;
    text-anchor: middle;
    paint-order: stroke;
    stroke: rgb(0 0 0 / 55%);
    stroke-width: 0.25;
    pointer-events: none;
  }

  &__name {
    font-weight: 700;
  }

  &__text {
    stroke-width: 0.45;
  }

  &__coach {
    fill: #111827;
    stroke: #fff;
    stroke-width: 0.35;
  }

  &__ball {
    fill: #fff;
    stroke: #111;
    stroke-width: 0.25;
  }

  &__equipment {
    stroke: rgb(0 0 0 / 40%);
    stroke-width: 0.2;
  }

  &__hole {
    fill: rgb(0 0 0 / 30%);
  }

  &__pole {
    stroke: #111;
    stroke-width: 0.25;
  }

  &__dummy {
    fill: #1e3a8a;
    stroke: #fff;
    stroke-width: 0.25;
  }

  &__net {
    fill: rgb(255 255 255 / 25%);
  }

  &__frame {
    fill: none;
    stroke: #fff;
    stroke-width: 0.4;
  }

  &__ladder {
    fill: none;
    stroke: #facc15;
    stroke-width: 0.25;
  }

  &__zone {
    fill-opacity: 0.2;
    stroke-width: 0.35;
    stroke-dasharray: 1 0.6;
  }
}
</style>
