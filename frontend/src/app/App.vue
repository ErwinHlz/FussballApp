<script setup lang="ts">
import { watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'

const { locale } = useI18n()

watchEffect(() => {
  document.documentElement.lang = locale.value
})
</script>

<template>
  <RouterView />
</template>
