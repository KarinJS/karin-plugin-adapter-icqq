import { AdapterICQQ } from './index'
import { createRequire } from 'module'
import { basePath, existsSync, mkdirSync, requireFileSync } from 'node-karin'
import { ConfigType, dirPath } from '@plugin'
import fs from 'fs'
import path from 'path'

// 初始化配置文件
export const pkg = () => requireFileSync(`${dirPath}/package.json`)
const pluginName = pkg().name.replace(/\//g, '-')
const cfgPath = `${basePath}/${pluginName}/config/config.json`
const config = {
  sign_api_addr: 'sign地址',
  list: []
}
if (!existsSync(cfgPath)) {
  mkdirSync(path.dirname(cfgPath))
  fs.writeFileSync(cfgPath, JSON.stringify(config, null, 2), 'utf8')
}

async function main () {
  const data = requireFileSync(cfgPath) as ConfigType

  if (!Array.isArray(data.list)) return

  const tmp = {
    log_level: 'warn',
    ffmpeg_path: process.env.FFMPEG_PATH,
    ffprobe_path: process.env.FFPROBE_PATH,
  }

  const require = createRequire(import.meta.url)

  let pack
  try {
    pack = require('@icqqjs/icqq/package.json')
  } catch {
    pack = require('icqq/package.json')
  }

  data.list.forEach(v => {
    if (!v.cfg.sign_api_addr) v.cfg.sign_api_addr = data.sign_api_addr || ''
    v.cfg.data_dir = `${basePath}/${pluginName}/${v.qq}`
    Object.assign(v.cfg, tmp)
    new AdapterICQQ(v, pack.version as string).init(v)
  })
}

main()
