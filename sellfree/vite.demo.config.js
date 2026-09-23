// Builds the shareable demo: the real client wired to an in-browser stand-in for the server.
// `npm run build:demo` then inlines it into a single page (scripts/bundle-demo.js).
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

const src = path.resolve(import.meta.dirname, 'src')

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: /^@\/lib\/api$/, replacement: path.join(src, 'demo/api.js') },
      { find: '@', replacement: src },
    ],
  },
  build: {
    outDir: 'dist-demo',
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: Infinity,
    rollupOptions: {
      input: path.join(src, 'demo/main.jsx'),
      output: { inlineDynamicImports: true, entryFileNames: 'demo.js', assetFileNames: 'demo[extname]' },
    },
  },
})
