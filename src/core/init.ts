import { AdapterICQQ } from './index'
import { createRequire } from 'module'
import { common, config } from 'node-karin'
import { basename, ConfigType } from '@plugin'

const yamlPath = `./config/plugin/${basename}/config.yaml`

async function main () {
  if (!common.exists(yamlPath)) return
  const data = common.readYaml(yamlPath) as ConfigType

  if (!Array.isArray(data.list)) return

  const tmp = {
    log_level: 'warn',
    ffmpeg_path: config.Config.ffmpeg_path,
    ffprobe_path: config.Config.ffprobe_path,
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
    v.cfg.data_dir = `./data/${basename}/${v.qq}`
    Object.assign(v.cfg, tmp)
    new AdapterICQQ(v, pack.name as string, pack.version as string).init(v)
  })
}

main()
