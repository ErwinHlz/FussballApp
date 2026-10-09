import '@/styles/main.scss'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { VueQueryPlugin } from '@tanstack/vue-query'
import App from '@/app/App.vue'
import { router } from '@/app/router'
import { i18n } from '@/lib/i18n'
import { queryClient } from '@/lib/queryClient'
import { reportError } from '@/lib/errors'

const app = createApp(App)

// Expected backend errors are shown in the views; only real bugs get reported.
app.config.errorHandler = (error, _instance, info) => reportError(error, info)

app.use(createPinia()).use(router).use(i18n).use(VueQueryPlugin, { queryClient }).mount('#app')
