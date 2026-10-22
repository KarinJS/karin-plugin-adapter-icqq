import fs from 'node:fs'
import path from 'node:path'
import { existsSync, karinPathBase, logger, requireFileSync } from 'node-karin'
import { Root } from '@/common/Root'
import {
  LOG_LEVELS,
  PLATFORMS,
  type AccountCfg,
  type CfgType,
  type ConfigType,
  type LogLevel,
  type Platform
} from './types'

/** 账号配置默认值 */
export const defaultAccountCfg: AccountCfg = {
  platform: 1,
  ver: '',
  ignore_self: true,
  sign_api_addr: '',
  cache_group_member: false,
  log_level: 'warn'
}

/** 默认人工过码服务地址 */
export const DEFAULT_CAPTCHA_API = 'https://icqq.qwqo.cn'

/** 创建一个全新的默认配置 */
export function createDefaultConfig (): ConfigType {
  return {
    sign_api_addr: '',
    captcha_api: DEFAULT_CAPTCHA_API,
    list: []
  }
}

const isObject = (value: unknown): value is Record<string, any> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const asString = (value: unknown, fallback = ''): string => {
  return typeof value === 'string' ? value : value === undefined || value === null ? fallback : String(value)
}

/**
 * 规范化人工过码服务地址。
 * 只接受 http(s) 域名根地址，兼容 icqq.qwqo.cn 的服务实现，不支持子路径。
 */
export function normalizeCaptchaApi (value: unknown): string {
  const raw = asString(value).trim()
  if (!raw) return DEFAULT_CAPTCHA_API

  try {
    const url = new URL(raw)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return DEFAULT_CAPTCHA_API
    if (url.username || url.password) return DEFAULT_CAPTCHA_API
    if (url.pathname !== '/' || url.search || url.hash) return DEFAULT_CAPTCHA_API
    return url.origin
  } catch {
    return DEFAULT_CAPTCHA_API
  }
}

/** 校验人工过码服务地址，返回错误信息 */
export function validateCaptchaApi (value: string): string | null {
  if (!value) return null

  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return '过码服务地址仅支持 http:// 或 https://'
    }
    if (url.username || url.password) {
      return '过码服务地址不能包含用户名或密码'
    }
    if (url.pathname !== '/' || url.search || url.hash) {
      return '过码服务地址必须是不含子路径的域名根地址'
    }
    return null
  } catch {
    return '过码服务地址格式不正确'
  }
}

const asBoolean = (value: unknown, fallback: boolean): boolean => {
  return typeof value === 'boolean' ? value : fallback
}

const isPlatform = (value: unknown): value is Platform => {
  return typeof value === 'number' && (PLATFORMS as readonly number[]).includes(value)
}

const isLogLevel = (value: unknown): value is LogLevel => {
  return typeof value === 'string' && (LOG_LEVELS as readonly string[]).includes(value)
}

/** 规范化单个账号配置，无效账号返回 null */
export function normalizeAccount (input: unknown): CfgType | null {
  if (!isObject(input)) return null

  const qq = Number(input.qq)
  if (!Number.isSafeInteger(qq) || qq <= 0) return null

  const cfg = isObject(input.cfg) ? input.cfg : {}
  const platform = isPlatform(cfg.platform) ? cfg.platform : defaultAccountCfg.platform
  const logLevel = isLogLevel(cfg.log_level) ? cfg.log_level : defaultAccountCfg.log_level

  return {
    enable: input.enable !== false,
    qq,
    password: asString(input.password),
    cfg: {
      platform,
      ver: asString(cfg.ver).trim(),
      ignore_self: asBoolean(cfg.ignore_self, defaultAccountCfg.ignore_self),
      sign_api_addr: asString(cfg.sign_api_addr).trim(),
      cache_group_member: asBoolean(cfg.cache_group_member, defaultAccountCfg.cache_group_member),
      log_level: logLevel,
      ...(asString(cfg.data_dir).trim() ? { data_dir: asString(cfg.data_dir).trim() } : {}),
      ...(asString(cfg.ffmpeg_path).trim() ? { ffmpeg_path: asString(cfg.ffmpeg_path).trim() } : {}),
      ...(asString(cfg.ffprobe_path).trim() ? { ffprobe_path: asString(cfg.ffprobe_path).trim() } : {})
    }
  }
}

/** 规范化插件配置，自动过滤无效账号并去重 */
export function normalizeConfig (input: unknown): ConfigType {
  if (!isObject(input)) return createDefaultConfig()

  const list: CfgType[] = []
  const seen = new Set<number>()

  if (Array.isArray(input.list)) {
    for (const item of input.list) {
      const account = normalizeAccount(item)
      if (!account || seen.has(account.qq)) continue
      seen.add(account.qq)
      list.push(account)
    }
  }

  return {
    sign_api_addr: asString(input.sign_api_addr).trim(),
    captcha_api: normalizeCaptchaApi(input.captcha_api),
    list
  }
}

class Cfg {
  /** 默认配置 */
  defaultConfig: ConfigType
  /** 配置文件路径 */
  CfgPath: string

  constructor () {
    this.defaultConfig = createDefaultConfig()
    this.CfgPath = path.join(karinPathBase, Root.pluginName.replace(/\//g, '-'), 'config', 'config.json')
    this.init()
  }

  /** 初始化配置文件 */
  init (): void {
    if (!existsSync(this.CfgPath)) {
      fs.mkdirSync(path.dirname(this.CfgPath), { recursive: true })
      fs.writeFileSync(this.CfgPath, JSON.stringify(this.defaultConfig, null, 2), 'utf8')
    }
  }

  /** 读取配置文件 */
  get getConfig (): ConfigType {
    try {
      const cfg = requireFileSync(this.CfgPath, { force: true })
      return normalizeConfig(cfg)
    } catch (err) {
      logger.error('[ICQQ Adapter] 读取配置文件失败，已加载默认配置', err)
      return createDefaultConfig()
    }
  }

  /** 保存配置文件 */
  save (config: ConfigType): ConfigType {
    const normalized = normalizeConfig(config)
    fs.mkdirSync(path.dirname(this.CfgPath), { recursive: true })
    fs.writeFileSync(this.CfgPath, JSON.stringify(normalized, null, 2), 'utf8')
    return normalized
  }
}

export const Config = new Cfg()
