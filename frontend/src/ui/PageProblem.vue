<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, type RouteLocationRaw } from 'vue-router'
import { useI18n } from 'vue-i18n'
import UiButton from './UiButton.vue'
import UiEmptyState from './UiEmptyState.vue'
import type { UiIconName } from './UiIcon.vue'

/**
 * A page that cannot show its content (failed to load, deleted, no access): keeps the page
 * heading for orientation and screen readers, explains what happened and offers a way back.
 */
const props = withDefaults(
  defineProps<{
    title: string
    text?: string
    /** Where the button leads, usually the overview of this kind of page. */
    to: RouteLocationRaw
    action: string
    icon?: UiIconName
  }>(),
  { text: undefined, icon: 'alert' },
)

const { t } = useI18n()
const route = useRoute()
const heading = computed(() => (route.meta.title ? t(route.meta.title) : props.title))
</script>

<template>
  <section class="page-problem">
    <h1>{{ heading }}</h1>
    <div role="alert">
      <UiEmptyState :icon="icon" :title="title" :text="text">
        <UiButton variant="secondary" :to="to">{{ action }}</UiButton>
      </UiEmptyState>
    </div>
  </section>
</template>

<style scoped lang="scss">
.page-problem {
  display: flex;
  flex-direction: column;
  gap: $space-4;
}
</style>
