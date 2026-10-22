import { getIcqqVersion } from '@/core/version'
import {
  Config,
  DEFAULT_CAPTCHA_API,
  LOG_LEVELS,
  PLATFORMS,
  normalizeCaptchaApi,
  validateCaptchaApi,
  type AccountCfg,
  type CfgType,
  type LogLevel,
  type Platform
} from '@/config'
import { getAccountRuntime, startAccount, stopAccount, type AccountRuntimeInfo } from '@/core/runtime'
import { getVerification, type VerificationView } from '@/core/verification'

/** 账号卡片运行状态 */
export interface AccountRuntimeView extends Omit<AccountRuntimeInfo, 'status'> {
  status: AccountRuntimeInfo['status'] | 'disabled'
}

/** 账号卡片返回数据 */
export interface AccountView {
  qq: number
  enable: boolean
  hasPassword: boolean
  cfg: AccountCfg
  runtime: AccountRuntimeView
  verification?: VerificationView
}

/** 账号列表返回数据 */
export interface AccountsPayload {
  signApiAddr: string
  captchaApi: string
  list: AccountView[]
  icqqVersion: string
  configPath: string
  summary: {
    total: number
    enabled: number
    online: number
  }
}

const isObject = (value: unknown): value is Record<string, any> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const readString = (value: unknown): string | undefined => {
  return typeof value === 'string' ? value : undefined
}

const readBoolean = (value: unknown): boolean | undefined => {
  return typeof value === 'boolean' ? value : undefined
}

const isPlatform = (value: unknown): value is Platform => {
  return typeof value === 'number' && (PLATFORMS as readonly number[]).includes(value)
}

const isLogLevel = (value: unknown): value is LogLevel => {
  return typeof value === 'string' && (LOG_LEVELS as readonly string[]).includes(value)
}

/** 校验 QQ 号 */
export function parseQQ (value: unknown): number | null {
  const qq = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^\d+$/.test(value.trim())
      ? Number(value.trim())
      : NaN

  if (!Number.isSafeInteger(qq) || qq <= 0) return null
  return qq
}

/** 校验签名服务器地址 */
function validateSignApi (value: string): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return '签名服务器地址仅支持 http:// 或 https://'
    }
    return null
  } catch {
    return '签名服务器地址格式不正确'
  }
}

function validateOptionalPath (value: string, label: string): string | null {
  if (!value) return null
  if (value.length > 512) return `${label}过长`
  return null
}

/** 将账号配置转换为前端安全数据（不返回密码） */
export function toAccountView (account: CfgType): AccountView {
  const enabled = account.enable !== false
  const runtime: AccountRuntimeView = enabled
    ? getAccountRuntime(account.qq)
    : {
        status: 'disabled',
        message: '已停用',
        updatedAt: Date.now()
      }
  const verification = enabled ? getVerification(account.qq) : undefined

  return {
    qq: account.qq,
    enable: enabled,
    hasPassword: Boolean(account.password),
    cfg: { ...account.cfg },
    runtime,
    ...(verification ? { verification } : {})
  }
}

/** 读取账号列表 */
export function getAccountsPayload (): AccountsPayload {
  const config = Config.getConfig
  const list = config.list.map(toAccountView)
  const enabled = list.filter(item => item.enable)

  return {
    signApiAddr: config.sign_api_addr,
    captchaApi: config.captcha_api || DEFAULT_CAPTCHA_API,
    list,
    icqqVersion: getIcqqVersion(),
    configPath: Config.CfgPath,
    summary: {
      total: list.length,
      enabled: enabled.length,
      online: enabled.filter(item => item.runtime.status === 'online').length
    }
  }
}

/** 更新全局配置（签名服务器、过码服务地址） */
export function updateGlobalConfig (body: unknown): { message: string } | { error: string } {
  if (!isObject(body)) return { error: '请求参数错误' }

  const signValue = readString(body.signApiAddr) ?? readString(body.sign_api_addr)
  const captchaValue = readString(body.captchaApi) ?? readString(body.captcha_api)
  if (signValue === undefined && captchaValue === undefined) {
    return { error: '缺少配置参数' }
  }

  const config = Config.getConfig

  if (signValue !== undefined) {
    const signApiAddr = signValue.trim()
    const invalid = validateSignApi(signApiAddr)
    if (invalid) return { error: invalid }
    config.sign_api_addr = signApiAddr
  }

  if (captchaValue !== undefined) {
    const invalid = validateCaptchaApi(captchaValue.trim())
    if (invalid) return { error: invalid }
    config.captcha_api = normalizeCaptchaApi(captchaValue)
  }

  Config.save(config)
  return { message: '全局配置已保存' }
}

/** 创建账号 */
export function createAccount (body: unknown): { account: CfgType } | { error: string } {
  if (!isObject(body)) return { error: '请求参数错误' }

  const qq = parseQQ(body.qq)
  if (!qq) return { error: '请输入有效的 QQ 号' }
  if (qq < 10000 || qq > 999999999999) return { error: 'QQ 号长度应为 5-12 位' }

  const config = Config.getConfig
  if (config.list.some(item => item.qq === qq)) {
    return { error: `账号 ${qq} 已存在` }
  }

  const platform = isPlatform(body.platform) ? body.platform : 1
  const logLevel = isLogLevel(body.logLevel) ? body.logLevel : 'warn'
  const password = readString(body.password) ?? ''
  if (password.length > 256) return { error: '密码过长' }

  const signApiAddr = (readString(body.signApiAddr) ?? '').trim()
  const signError = validateSignApi(signApiAddr)
  if (signError) return { error: signError }

  const ver = (readString(body.ver) ?? '').trim()
  if (ver.length > 32) return { error: '协议版本过长' }

  const ffmpegPath = (readString(body.ffmpegPath) ?? '').trim()
  const ffprobePath = (readString(body.ffprobePath) ?? '').trim()
  const pathError = validateOptionalPath(ffmpegPath, 'ffmpeg 路径') || validateOptionalPath(ffprobePath, 'ffprobe 路径')
  if (pathError) return { error: pathError }

  const cfg: AccountCfg = {
    platform,
    ver,
    ignore_self: readBoolean(body.ignoreSelf) !== false,
    sign_api_addr: signApiAddr,
    cache_group_member: readBoolean(body.cacheGroupMember) === true,
    log_level: logLevel
  }
  if (ffmpegPath) cfg.ffmpeg_path = ffmpegPath
  if (ffprobePath) cfg.ffprobe_path = ffprobePath

  const account: CfgType = {
    enable: readBoolean(body.enable) !== false,
    qq,
    password,
    cfg
  }

  config.list.push(account)
  Config.save(config)

  return { account }
}

/** 更新账号 */
export function updateAccount (body: unknown): { account: CfgType } | { error: string } {
  if (!isObject(body)) return { error: '请求参数错误' }

  const qq = parseQQ(body.qq)
  if (!qq) return { error: '缺少要更新的 QQ 号' }

  const config = Config.getConfig
  const index = config.list.findIndex(item => item.qq === qq)
  if (index === -1) return { error: `账号 ${qq} 不存在` }

  const existing = config.list[index]
  const platform = isPlatform(body.platform) ? body.platform : existing.cfg.platform
  const logLevel = isLogLevel(body.logLevel) ? body.logLevel : existing.cfg.log_level
  const signApiAddr = readString(body.signApiAddr) === undefined
    ? existing.cfg.sign_api_addr
    : readString(body.signApiAddr)!.trim()
  const signError = validateSignApi(signApiAddr)
  if (signError) return { error: signError }

  const ver = readString(body.ver) === undefined ? existing.cfg.ver : readString(body.ver)!.trim()
  if (ver.length > 32) return { error: '协议版本过长' }

  let password = existing.password
  if (body.clearPassword === true) {
    password = ''
  } else {
    const nextPassword = readString(body.password)
    if (nextPassword !== undefined && nextPassword !== '') {
      if (nextPassword.length > 256) return { error: '密码过长' }
      password = nextPassword
    }
  }

  const ffmpegPath = readString(body.ffmpegPath) === undefined
    ? existing.cfg.ffmpeg_path || ''
    : readString(body.ffmpegPath)!.trim()
  const ffprobePath = readString(body.ffprobePath) === undefined
    ? existing.cfg.ffprobe_path || ''
    : readString(body.ffprobePath)!.trim()
  const pathError = validateOptionalPath(ffmpegPath, 'ffmpeg 路径') || validateOptionalPath(ffprobePath, 'ffprobe 路径')
  if (pathError) return { error: pathError }

  const cfg: AccountCfg = {
    ...existing.cfg,
    platform,
    ver,
    ignore_self: readBoolean(body.ignoreSelf) ?? existing.cfg.ignore_self,
    sign_api_addr: signApiAddr,
    cache_group_member: readBoolean(body.cacheGroupMember) ?? existing.cfg.cache_group_member,
    log_level: logLevel
  }

  delete cfg.ffmpeg_path
  delete cfg.ffprobe_path
  if (ffmpegPath) cfg.ffmpeg_path = ffmpegPath
  if (ffprobePath) cfg.ffprobe_path = ffprobePath

  const account: CfgType = {
    enable: readBoolean(body.enable) ?? (existing.enable !== false),
    qq,
    password,
    cfg
  }

  config.list[index] = account
  Config.save(config)

  return { account }
}

/** 删除账号 */
export function deleteAccount (body: unknown): { account: CfgType } | { error: string } {
  if (!isObject(body)) return { error: '请求参数错误' }

  const qq = parseQQ(body.qq)
  if (!qq) return { error: '缺少要删除的 QQ 号' }

  const config = Config.getConfig
  const index = config.list.findIndex(item => item.qq === qq)
  if (index === -1) return { error: `账号 ${qq} 不存在` }

  const [account] = config.list.splice(index, 1)
  Config.save(config)
  return { account }
}

/** 根据 QQ 查找账号 */
export function findAccount (body: unknown): CfgType | null {
  if (!isObject(body)) return null
  const qq = parseQQ(body.qq)
  if (!qq) return null
  return Config.getConfig.list.find(item => item.qq === qq) || null
}

/** 让账号配置在运行时生效 */
export async function applyAccount (account: CfgType, reason = '配置变更'): Promise<void> {
  await stopAccount(account.qq, reason)
  if (account.enable === false) return

  const config = Config.getConfig
  startAccount(account, getIcqqVersion(), config.sign_api_addr)
}
