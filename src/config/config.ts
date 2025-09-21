import { Root } from '@/imports/Root'
import { ConfigType } from './types'
import fs from 'node:fs'
import { existsSync, karinPathBase, logger, mkdirSync, requireFileSync } from 'node-karin'
import path from 'path'

class Cfg {
  /** 默认配置 */
  defaultConfig: ConfigType
  /** 配置文件路径 */
  CfgPath: string
  constructor () {
    this.defaultConfig = {
      sign_api_addr: '',
      list: []
    }
    this.CfgPath = path.join(karinPathBase, Root.pluginName.replace(/\//g, '-'), 'config', 'config.json')
    this.init()
  }

  init (): void {
    if (!existsSync(this.CfgPath)) {
      mkdirSync(path.dirname(this.CfgPath))
      fs.writeFileSync(this.CfgPath, JSON.stringify(this.defaultConfig, null, 2), 'utf8')
    }
  }

  /** 读取配置文件 */
  get getConfig (): ConfigType {
    try {
      const cfg = requireFileSync(this.CfgPath, { force: true }) as ConfigType
      return { ...this.defaultConfig, ...cfg }
    } catch (err) {
      logger.error('[ICQQ Adapter] 读取配置文件失败，已加载默认配置', err)
      return this.defaultConfig
    }
  }
}

export const Config = new Cfg()
