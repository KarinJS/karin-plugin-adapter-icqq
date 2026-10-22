import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/main.tsx'],
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  outDir: '../core/web/assets',
  outputOptions: {
    entryFileNames: 'app.js',
    chunkFileNames: 'chunks/[name]-[hash].js'
  },
  define: {
    'process.env.NODE_ENV': '"production"'
  },
  deps: {
    alwaysBundle: [/.*/],
    onlyBundle: false
  },
  clean: false,
  dts: false,
  sourcemap: false,
  minify: true,
  treeshake: true,
  hash: false
})
