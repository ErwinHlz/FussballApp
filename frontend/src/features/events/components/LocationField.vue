<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import UiIcon from '@/ui/UiIcon.vue'
import UiInput from '@/ui/UiInput.vue'
import { mapsUrl } from '@/lib/maps'

/**
 * Place of an event (address or pitch name) with earlier places as suggestions and a link that
 * shows the entered place in the map app, to check it before saving.
 */
defineProps<{ label: string; suggestions?: string[]; error?: string; placeholder?: string }>()
const model = defineModel<string>({ default: '' })

const { t } = useI18n()
const url = computed(() => (model.value.trim() ? mapsUrl(model.value) : null))
</script>

<template>
  <div class="location-field">
    <UiInput
      v-model="model"
      :label="label"
      :placeholder="placeholder ?? t('events.form.locationPlaceholder')"
      :suggestions="suggestions"
      :error="error"
      autocomplete="off"
    />
    <a v-if="url" :href="url" target="_blank" rel="noopener" class="location-field__map">
      <UiIcon name="pin" :size="16" />
      {{ t('events.openMap') }}
      <span class="visually-hidden">: {{ model }}</span>
    </a>
  </div>
</template>

<style scoped lang="scss">
.location-field {
  display: flex;
  flex-direction: column;
  gap: $space-1;

  &__map {
    @include focus-visible;

    display: inline-flex;
    align-self: flex-start;
    align-items: center;
    gap: $space-1;
    min-height: $touch-target;
    color: var(--color-text);
    font-size: $font-sm;
    font-weight: 700;
    text-decoration: underline;
    text-decoration-color: var(--color-primary);
    text-decoration-thickness: 2px;
    text-underline-offset: 4px;
  }
}
</style>
