<script setup lang="ts">
import { defineAsyncComponent, watch, watchEffect } from 'vue'
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

// Debug account switcher: development builds only (removed from production builds). Hidden in
// browser tests unless a test turns it on.
const DevAccountSwitcher =
  import.meta.env.DEV && (!navigator.webdriver || readDevFlag())
    ? defineAsyncComponent(() => import('@/dev/DevAccountSwitcher.vue'))
    : null
function readDevFlag() {
  try {
    return localStorage.getItem('rondo.devTools') === 'on'
  } catch {
    return false
  }
}

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
  <component :is="DevAccountSwitcher" v-if="DevAccountSwitcher" />
</template>
