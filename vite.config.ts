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
    alias: [
      {
        find: /^@hydra\/gfx-runtime\/(.*)$/,
        replacement: path.join(root, 'packages/gfx-runtime/src/$1'),
      },
      {
        find: '@hydra/gfx-runtime',
        replacement: path.join(root, 'packages/gfx-runtime/src/index.ts'),
      },
      {
        find: '@gurleen-ui/core',
        replacement: path.join(root, 'ui/packages/core/dist/index.js'),
      },
      {
        find: '@gurleen-ui/broadcast',
        replacement: path.join(root, 'ui/packages/broadcast/dist/index.js'),
      },
      {
        find: '@gurleen-ui/tokens',
        replacement: path.join(root, 'ui/packages/tokens/src/index.css'),
      },
    ],
  },
  server: {
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  plugins: [devtools(), tanstackStart(), viteReact(), tailwindcss()],
})

export default config
