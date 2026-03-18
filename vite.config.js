import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { readFileSync } from 'node:fs'

const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))
const appVersion = packageJson.version || '0.0.0'

// https://vite.dev/config/
export default defineConfig({
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
  },
  plugins: [vue()],
  server: {
    proxy: {
      '/api/chat': {
        target: 'http://127.0.0.1:8082',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://127.0.0.1:8081',
        changeOrigin: true,
      },
    },
  },
})
