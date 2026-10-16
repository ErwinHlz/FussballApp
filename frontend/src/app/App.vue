<script setup lang="ts">
import { watch, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useLocaleStore } from '@/stores/locale'
import { useThemeStore } from '@/stores/theme'

const { locale, t } = useI18n()
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
// Applies the light/dark choice of this device (also on login and public pages).
useThemeStore()
useLocaleStore()

watchEffect(() => {
  document.documentElement.lang = locale.value
})

// Page title per route, e.g. "Kader · Rondo" (screen readers announce it, tabs show it).
watchEffect(() => {
  const key = route.meta.title
  document.title = key ? `${t(key)} · ${t('app.name')}` : t('app.name')
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
