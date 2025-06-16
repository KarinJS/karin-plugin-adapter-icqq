import { builtinModules } from 'node:module'
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/**.ts', 'src/apps/**.ts'], // 入口文件
  format: ['esm'], // 输出格式
  target: 'node18', // 目标环境
  platform: 'node',
  splitting: true, // 是否拆分文件
  sourcemap: false, // 是否生成 sourcemap
  clean: true, // 是否清理输出目录
  dts: true, // 是否生成 .d.ts 文件
  outDir: 'dist', // 输出目录
  treeshake: true, // 树摇优化
  minify: false, // 压缩代码
  shims: false,
  removeNodeProtocol: false,
  skipNodeModulesBundle: false,
  external: [
    'icqq',
    'node-karin',
    ...builtinModules,
    ...builtinModules.map((node) => `node:${node}`),
  ]
})
