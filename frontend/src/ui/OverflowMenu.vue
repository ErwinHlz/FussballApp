<script setup lang="ts" generic="K extends string">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BottomSheet from './BottomSheet.vue'
import UiIcon, { type UiIconName } from './UiIcon.vue'
import UiIconButton from './UiIconButton.vue'

export type OverflowItem<Key extends string = string> = {
  key: Key
  label: string
  icon?: UiIconName
  danger?: boolean
  disabled?: boolean
}

/** "⋯" button that opens the secondary actions of a screen or row as a sheet. */
const props = defineProps<{ items: OverflowItem<K>[]; title?: string; label?: string }>()
const emit = defineEmits<{ select: [K] }>()

const { t } = useI18n()
const open = ref(false)
let picked: K | null = null

function choose(key: K) {
  picked = key
  open.value = false
}

// Report the choice after the sheet closed, so a follow-up sheet or dialog gets the focus.
function onClosed() {
  if (picked !== null) emit('select', picked)
  picked = null
}
</script>

<template>
  <UiIconButton
    icon="more"
    :label="props.label ?? t('ui.more')"
    variant="ghost"
    aria-haspopup="dialog"
    @click="open = true"
  />
  <BottomSheet v-model:open="open" :title="title ?? t('ui.more')" @closed="onClosed">
    <ul class="overflow-menu" role="list">
      <li v-for="item in items" :key="item.key">
        <button
          type="button"
          class="overflow-menu__item"
          :class="{ 'overflow-menu__item--danger': item.danger }"
          :disabled="item.disabled"
          @click="choose(item.key)"
        >
          <UiIcon v-if="item.icon" :name="item.icon" :size="22" />
          {{ item.label }}
        </button>
      </li>
    </ul>
  </BottomSheet>
</template>

<style scoped lang="scss">
.overflow-menu {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;

  &__item {
    @include focus-visible;

    display: flex;
    align-items: center;
    gap: $space-3;
    width: 100%;
    min-height: 56px;
    padding: 0 $space-4;
    border: 0;
    border-radius: $radius-lg;
    background: var(--color-surface);
    color: var(--color-text);
    font-weight: 700;
    text-align: left;

    &--danger {
      color: var(--color-danger);
    }

    &:disabled {
      opacity: 0.5;
    }
  }
}
</style>
