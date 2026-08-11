import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const root = path.dirname(fileURLToPath(import.meta.url))

const config = defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      '@gurleen-ui/core': path.join(root, 'ui/packages/core/dist/index.js'),
      '@gurleen-ui/broadcast': path.join(root, 'ui/packages/broadcast/dist/index.js'),
      '@gurleen-ui/tokens': path.join(root, 'ui/packages/tokens/src/index.css'),
    },
  },
  server: {
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  plugins: [devtools(), tanstackStart(), viteReact(), tailwindcss()],
})

export default config
