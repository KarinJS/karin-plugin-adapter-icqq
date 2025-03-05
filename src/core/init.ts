import { AdapterICQQ } from './index'
import { createRequire } from 'module'
import { common } from 'node-karin'
import { basename, ConfigType } from '@plugin'
import fs from 'fs'
import path from 'path'
import YAML from 'node-karin/yaml'

// 初始化配置文件
const yamlPath = './@karinjs/@karinjs-adapter-icqq/config.yaml'
const config = {
  sign_api_addr: 'sign地址',
  list: []
}
if (!fs.existsSync(yamlPath)) {
  fs.mkdirSync(path.dirname(yamlPath), { recursive: true })
  fs.writeFileSync(yamlPath, YAML.stringify(config), 'utf8')
}

async function main () {
  if (!common.exists(yamlPath)) return
  const data = common.readYaml(yamlPath) as ConfigType

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
    v.cfg.data_dir = `./data/${basename}/${v.qq}`
    Object.assign(v.cfg, tmp)
    new AdapterICQQ(v, pack.version as string).init(v)
  })
}

main()
