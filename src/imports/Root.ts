import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

/** 当前文件的绝对路径 */
const filePath = path.resolve(fileURLToPath(import.meta.url).replace(/\\/g, '/'), '../../..')
const pkg = JSON.parse(fs.readFileSync(path.join(filePath, 'package.json'), 'utf-8'))

export const Root: {
  /** 插件名字 */
  pluginName: string
  /** 插件版本号 */
  pluginVersion: string
  /** 插件路径 */
  pluginPath: string
} = {
  pluginName: pkg.name,
  pluginVersion: pkg.version,
  pluginPath: filePath
}
