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
        find: /^@hydra-tv\/hydra-gfx-runtime\/(.*)$/,
        replacement: path.join(root, 'packages/gfx-runtime/src/$1'),
      },
      {
        find: '@hydra-tv/hydra-gfx-runtime',
        replacement: path.join(root, 'packages/gfx-runtime/src/index.ts'),
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
