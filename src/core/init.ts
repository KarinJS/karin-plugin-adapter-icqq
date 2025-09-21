import { AdapterICQQ } from './index'
import { createRequire } from 'module'
import { karinPathBase } from 'node-karin'
import { Config } from '@/config'
import { Root } from '@/imports'

export function main () {
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
  Config.getConfig.list.forEach(v => {
    if (!v.cfg.sign_api_addr) v.cfg.sign_api_addr = Config.getConfig.sign_api_addr || ''
    v.cfg.data_dir = `${karinPathBase}/${Root.pluginName.replace(/\//g, '-')}/data/${v.qq}`
    Object.assign(v.cfg, tmp)
    new AdapterICQQ(v, pack.version as string).init(v)
  })
}

main()
