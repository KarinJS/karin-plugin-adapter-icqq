import { fileURLToPath } from 'node:url'
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/icqq.ts',
    'src/app.ts',
    'src/web.config.ts',
    'src/apps/*.ts'
  ],
  format: 'esm',
  platform: 'node',
  target: 'node18',
  outDir: './dist',
  clean: true,
  dts: false,
  sourcemap: false,
  minify: false,
  treeshake: true,
  outExtensions: () => ({
    js: '.js',
    dts: '.d.ts'
  }),
  alias: {
    '@': fileURLToPath(new URL('./src', import.meta.url))
  },
  deps: {
    neverBundle: [
      'icqq',
      'node-karin',
      /^node-karin\//,
      /^node:/
    ]
  }
})
