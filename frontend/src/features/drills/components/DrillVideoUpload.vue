<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/components/BaseButton.vue'
import type { Drill } from '../logic'
import {
  formatBytes,
  UploadAbortedError,
  validateVideoFile,
  VIDEO_MAX_BYTES,
  type VideoFileProblem,
} from '../video'
import { useRemoveDrillVideo, useUploadDrillVideo } from '../composables/useDrills'

/** Coach control: upload, replace or remove the drill video. */
const props = defineProps<{ drill: Pick<Drill, 'id' | 'team_id' | 'video_path'> }>()

const { t, locale } = useI18n()
const inputId = useId()
const upload = useUploadDrillVideo()
const remove = useRemoveDrillVideo()
const problem = ref<VideoFileProblem | null>(null)
const fileName = ref('')
const confirmRemove = ref(false)

const percent = computed(() => Math.round(upload.progress.value * 100))
const failed = computed(
  () => upload.isError.value && !(upload.error.value instanceof UploadAbortedError),
)
const cancelled = computed(() => upload.error.value instanceof UploadAbortedError)
const maxSize = computed(() => formatBytes(VIDEO_MAX_BYTES, locale.value))

function onFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // allow choosing the same file again
  if (!file) return
  problem.value = validateVideoFile(file)
  fileName.value = `${file.name} (${formatBytes(file.size, locale.value)})`
  confirmRemove.value = false
  if (problem.value) return
  upload.mutate({ drill: props.drill, file })
}

function onRemove() {
  if (!confirmRemove.value) {
    confirmRemove.value = true
    return
  }
  remove.mutate(props.drill)
  confirmRemove.value = false
}
</script>

<template>
  <div class="upload">
    <template v-if="upload.isPending.value">
      <p class="upload__file">{{ fileName }}</p>
      <div
        class="upload__bar"
        role="progressbar"
        :aria-valuenow="percent"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-label="t('drills.upload.progress')"
      >
        <span class="upload__fill" :style="{ width: `${percent}%` }" />
      </div>
      <p class="upload__muted" aria-live="polite">
        {{ t('drills.upload.uploading', { n: percent }) }}
      </p>
      <BaseButton variant="secondary" block @click="upload.cancel()">{{
        t('common.cancel')
      }}</BaseButton>
    </template>

    <template v-else>
      <label :for="inputId" class="upload__pick">
        <span aria-hidden="true">⬆</span>
        {{ drill.video_path ? t('drills.upload.replace') : t('drills.upload.choose') }}
      </label>
      <input
        :id="inputId"
        class="upload__input"
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        @change="onFile"
      />
      <p class="upload__muted">{{ t('drills.upload.hint', { max: maxSize }) }}</p>

      <p v-if="problem" class="upload__error" role="alert">
        {{ t(`drills.upload.problems.${problem}`, { max: maxSize }) }}
      </p>
      <p v-else-if="failed" class="upload__error" role="alert">{{ t('drills.upload.failed') }}</p>
      <p v-else-if="cancelled" class="upload__muted" role="status">
        {{ t('drills.upload.cancelled') }}
      </p>
      <p v-else-if="upload.isSuccess.value" class="upload__success" role="status">
        ✓ {{ t('drills.upload.done') }}
      </p>

      <BaseButton
        v-if="drill.video_path"
        :variant="confirmRemove ? 'danger' : 'ghost'"
        block
        :loading="remove.isPending.value"
        @click="onRemove"
      >
        {{ confirmRemove ? t('drills.upload.removeConfirm') : t('drills.upload.remove') }}
      </BaseButton>
      <p v-if="remove.isError.value" class="upload__error" role="alert">
        {{ t('squad.errors.unknown') }}
      </p>
    </template>
  </div>
</template>

<style scoped lang="scss">
.upload {
  display: flex;
  flex-direction: column;
  gap: $space-2;

  &__pick {
    @include touch-target;

    display: flex;
    align-items: center;
    justify-content: center;
    gap: $space-2;
    padding: $space-2 $space-4;
    border: 2px dashed var(--color-primary);
    border-radius: $radius-md;
    color: var(--color-primary-hover);
    font-weight: 700;
    cursor: pointer;

    &:has(+ .upload__input:focus-visible) {
      @include focus-ring;
    }
  }

  &__input {
    @include visually-hidden;
  }

  &__file {
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  &__bar {
    height: 12px;
    overflow: hidden;
    border-radius: $radius-full;
    background: var(--color-surface-muted);
  }

  &__fill {
    display: block;
    height: 100%;
    background: var(--color-primary);
    transition: width 0.2s ease;
  }

  &__muted {
    font-size: $font-sm;
    color: var(--color-text-muted);
  }

  &__error {
    color: var(--color-danger);
  }

  &__success {
    color: var(--color-success);
    font-weight: 600;
  }
}
</style>
