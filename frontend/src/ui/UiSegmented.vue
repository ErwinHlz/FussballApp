<script setup lang="ts" generic="T extends string">
import { nextTick, ref, useId } from 'vue'

/**
 * Segmented control. As "tabs" it switches views of one page; as "radio" it is a choice
 * (settings, filters). Both: arrow keys move between options, only the selected option is in
 * the tab order. Give a tab a panelId when it controls a tabpanel on the page.
 */
const props = withDefaults(
  defineProps<{
    label: string
    options: { value: T; label: string; panelId?: string }[]
    as?: 'tabs' | 'radio'
  }>(),
  { as: 'tabs' },
)
const model = defineModel<T>({ required: true })

const id = useId()
const buttons = ref<HTMLButtonElement[]>([])

async function select(index: number) {
  const option = props.options[index]
  if (!option) return
  model.value = option.value
  await nextTick()
  buttons.value[index]?.focus()
}

function onKeydown(event: KeyboardEvent, index: number) {
  const last = props.options.length - 1
  const target =
    event.key === 'ArrowRight'
      ? index === last
        ? 0
        : index + 1
      : event.key === 'ArrowLeft'
        ? index === 0
          ? last
          : index - 1
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? last
            : null
  if (target === null) return
  event.preventDefault()
  void select(target)
}

/** Id of the tab for an option, so its panel can be labelled by it. */
function tabId(value: T) {
  return `${id}-${value}`
}
defineExpose({ tabId })
</script>

<template>
  <div class="ui-segmented" :role="as === 'radio' ? 'radiogroup' : 'tablist'" :aria-label="label">
    <button
      v-for="(option, index) in options"
      :id="tabId(option.value)"
      :key="option.value"
      ref="buttons"
      type="button"
      :role="as === 'radio' ? 'radio' : 'tab'"
      class="ui-segmented__option"
      :aria-selected="as === 'radio' ? undefined : model === option.value"
      :aria-checked="as === 'radio' ? model === option.value : undefined"
      :aria-controls="option.panelId"
      :tabindex="model === option.value ? 0 : -1"
      @click="select(index)"
      @keydown="onKeydown($event, index)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped lang="scss">
.ui-segmented {
  display: grid;
  // Options share the width, but a longer label ("Automatisch") keeps its room.
  grid-auto-columns: minmax(max-content, 1fr);
  grid-auto-flow: column;
  gap: 4px;
  padding: 4px;
  border-radius: $radius-full;
  background: var(--color-surface-muted);

  &__option {
    @include focus-visible;

    min-height: $touch-target;
    padding: 0 $space-2;
    border: 0;
    border-radius: $radius-full;
    background: transparent;
    color: var(--color-text);
    font-weight: 600;
    font-size: $font-sm;
    white-space: nowrap;
    transition: background-color var(--duration-fast) var(--ease-out);

    &[aria-selected='true'],
    &[aria-checked='true'] {
      background: var(--color-text);
      color: var(--color-bg);
      font-weight: 800;
    }
  }
}
</style>
