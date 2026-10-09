<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { imprint, privacyPolicy } from '../content'

const props = defineProps<{ document: 'privacy' | 'imprint' }>()

const { t, locale } = useI18n()
const router = useRouter()
const doc = computed(() => (props.document === 'privacy' ? privacyPolicy : imprint))

/** Splits text so [placeholders] can be highlighted. */
function parts(text: string) {
  return text.split(/(\[[^\]]+\])/g).filter(Boolean)
}

function back() {
  if (window.history.state?.back) router.back()
  else void router.push('/')
}
</script>

<template>
  <main class="legal" :lang="'de'">
    <button type="button" class="legal__back" @click="back">‹ {{ t('common.back') }}</button>
    <h1>{{ doc.title }}</h1>
    <p v-if="locale !== 'de'" class="legal__note" :lang="locale">{{ t('legal.germanOnly') }}</p>
    <p class="legal__template" role="note">{{ t('legal.template') }}</p>
    <p class="legal__updated">
      Stand:
      <template v-for="(part, i) in parts(doc.updated)" :key="i">
        <mark v-if="part.startsWith('[')">{{ part }}</mark
        ><template v-else>{{ part }}</template>
      </template>
    </p>

    <section v-for="section in doc.sections" :key="section.heading" class="legal__section">
      <h2>{{ section.heading }}</h2>
      <p v-for="(paragraph, i) in section.paragraphs" :key="i">
        <template v-for="(part, j) in parts(paragraph)" :key="j">
          <mark v-if="part.startsWith('[')">{{ part }}</mark
          ><template v-else>{{ part }}</template>
        </template>
      </p>
    </section>
  </main>
</template>

<style scoped lang="scss">
.legal {
  @include safe-area-padding(top, $space-4);
  @include safe-area-padding(bottom, $space-6);

  display: flex;
  flex-direction: column;
  gap: $space-3;
  max-width: 720px;
  margin: 0 auto;
  padding-inline: $space-4;
  line-height: 1.6;

  &__back {
    @include focus-visible;

    align-self: flex-start;
    min-height: $touch-target;
    border: 0;
    background: transparent;
    color: var(--color-primary);
    font-weight: 600;
  }

  &__note,
  &__updated {
    font-size: $font-sm;
    color: var(--color-text-muted);
  }

  &__template {
    padding: $space-3;
    border: 2px dashed var(--color-warning);
    border-radius: $radius-md;
    font-size: $font-sm;
  }

  &__section {
    display: flex;
    flex-direction: column;
    gap: $space-2;

    h2 {
      margin-top: $space-3;
      font-size: $font-lg;
    }
  }

  mark {
    padding: 0 2px;
    border-radius: 3px;
    background: color-mix(in srgb, var(--color-warning) 30%, transparent);
    color: inherit;
  }
}
</style>
