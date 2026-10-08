<script setup lang="ts">
import { watch, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const { locale } = useI18n()
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

watchEffect(() => {
  document.documentElement.lang = locale.value
})

// Session ended elsewhere (other tab, expired refresh token): leave protected pages.
watch(
  () => auth.isAuthenticated,
  (isAuthenticated) => {
    if (auth.ready && !isAuthenticated && route.meta.requiresAuth) {
      void router.replace({ name: 'login', query: { redirect: route.fullPath } })
    }
  },
)
</script>

<template>
  <RouterView />
</template>
