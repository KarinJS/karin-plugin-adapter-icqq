import { createRequire } from 'node:module'

let version: string | undefined

/**
 * 获取当前安装的 icqq 版本
 * @returns icqq 版本号
 */
export function getIcqqVersion (): string {
  if (version) return version

  const require = createRequire(import.meta.url)

  try {
    version = require('@icqqjs/icqq/package.json').version as string
  } catch {
    try {
      version = require('icqq/package.json').version as string
    } catch {
      version = 'unknown'
    }
  }

  return version
}
