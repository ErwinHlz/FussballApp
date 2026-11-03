import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

// The proxy below only exists on the dev server, so the development values are the right ones.
const devEnv = loadEnv('development', fileURLToPath(new URL('.', import.meta.url)))

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: '@use "@/styles/tokens" as *;\n@use "@/styles/mixins" as *;\n',
      },
    },
  },
  server: {
    // Reachable from phones in the same network (http://<PC-IP>:5173) …
    host: '0.0.0.0',
    port: 5173,
    // … and through an HTTPS tunnel (`npm run tunnel`).
    allowedHosts: ['.trycloudflare.com'],
    // The local Supabase through the dev server, so the phone needs only this one address
    // (src/lib/supabase.ts). `ws` carries realtime.
    proxy: {
      '/supabase': {
        target: devEnv.VITE_SUPABASE_URL || 'http://127.0.0.1:54321',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/supabase/, ''),
      },
    },
  },
})
