import { getBot, karinPathBase, logger, unregisterBot } from 'node-karin'
import { Root } from '@/common/Root'
import type { CfgType, Platform } from '@/config'
import { AdapterICQQ } from './index'
import { clearVerification } from './verification'

/** 账号运行状态 */
export type AccountStatus = 'online' | 'offline' | 'starting' | 'error'

/** 账号运行状态快照 */
export interface AccountRuntimeInfo {
  /** 当前状态 */
  status: AccountStatus
  /** 状态说明 */
  message: string
  /** 状态更新时间 */
  updatedAt: number
  /** 本次启动时间 */
  startedAt?: number
}

interface RuntimeRecord {
  adapter: AdapterICQQ
  info: AccountRuntimeInfo
}

const runtimes = new Map<number, RuntimeRecord>()

/**
 * 支持扫码登录的协议平台。
 * icqq 中只有设备类型不为 -1 的协议可以拉取二维码：
 * 安卓手机 / 平板 / iPad / TIM 的 `device_type` 均为 -1，扫码会直接报
 * 「当前协议版本不支持扫码登入」。这里只保留安卓手表与 MacOS。
 */
const QR_PLATFORMS: Platform[] = [3, 4]

/** 协议不支持扫码时的提示 */
const QR_UNSUPPORTED_MESSAGE = '当前协议不支持扫码登录，请填写密码或切换到 MacOS / 安卓手表协议'

/** 给账号配置补齐运行时字段 */
export function prepareAccountConfig (account: CfgType, globalSignApi = ''): CfgType {
  return {
    ...account,
    enable: account.enable !== false,
    password: account.password || '',
    cfg: {
      ...account.cfg,
      platform: account.cfg.platform,
      sign_api_addr: account.cfg.sign_api_addr || globalSignApi,
      log_level: account.cfg.log_level || 'warn',
      ffmpeg_path: account.cfg.ffmpeg_path || process.env.FFMPEG_PATH,
      ffprobe_path: account.cfg.ffprobe_path || process.env.FFPROBE_PATH,
      data_dir: account.cfg.data_dir || `${karinPathBase}/${Root.pluginName.replace(/\//g, '-')}/data/${account.qq}`
    }
  }
}

const update = (qq: number, patch: Partial<AccountRuntimeInfo>): AccountRuntimeInfo => {
  const record = runtimes.get(qq)
  const fallback: AccountRuntimeInfo = {
    status: 'offline',
    message: '未加载',
    updatedAt: Date.now()
  }

  const info: AccountRuntimeInfo = {
    ...(record?.info || fallback),
    ...patch,
    updatedAt: Date.now()
  }

  if (record) record.info = info
  return info
}

/**
 * 启动一个账号，已启动的账号会被忽略
 * @param account 账号配置
 * @param version icqq 版本
 * @param globalSignApi 全局签名服务器
 */
export function startAccount (account: CfgType, version: string, globalSignApi = ''): AccountRuntimeInfo {
  const qq = Number(account.qq)
  const current = runtimes.get(qq)
  if (current) return current.info

  clearVerification(qq, true)
  const config = prepareAccountConfig(account, globalSignApi)
  const adapter = new AdapterICQQ(config, version)
  const unsupportedQr = !config.password && !QR_PLATFORMS.includes(config.cfg.platform)
  const info: AccountRuntimeInfo = unsupportedQr
    ? { status: 'error', message: QR_UNSUPPORTED_MESSAGE, updatedAt: Date.now() }
    : { status: 'starting', message: '正在登录', updatedAt: Date.now(), startedAt: Date.now() }

  runtimes.set(qq, { adapter, info })

  if (unsupportedQr) {
    logger.warn(`[ICQQ Adapter] 账号 ${qq} 未配置密码，${QR_UNSUPPORTED_MESSAGE}`)
    return info
  }

  /** 只允许当前运行时实例更新状态，避免旧实例在重启后覆盖新状态 */
  const updateSelf = (patch: Partial<AccountRuntimeInfo>): void => {
    if (runtimes.get(qq)?.adapter !== adapter) return
    update(qq, patch)
  }

  adapter.super.on('system.online', () => {
    updateSelf({ status: 'online', message: '在线' })
  })

  adapter.super.on('system.offline', event => {
    updateSelf({
      status: 'offline',
      message: typeof event?.message === 'string' && event.message ? event.message : '已离线'
    })
  })

  adapter.super.on('system.login.error', event => {
    updateSelf({
      status: 'error',
      message: event?.message || `登录错误 (${event?.code ?? 'unknown'})`
    })
  })

  void adapter.init(config).catch(error => {
    logger.error(`[ICQQ Adapter] 账号 ${qq} 登录流程异常`, error)
    updateSelf({
      status: 'error',
      message: error instanceof Error ? error.message : '登录流程异常'
    })
  })

  return info
}

/**
 * 停止一个账号
 * @param qq QQ号
 * @param reason 停止原因
 */
export async function stopAccount (qq: number, reason = '手动下线'): Promise<boolean> {
  const record = runtimes.get(qq)
  const bot = record?.adapter || getBot(String(qq)) as unknown as AdapterICQQ | undefined
  runtimes.delete(qq)
  clearVerification(qq, true)

  if (!bot) return false

  logger.info(`[ICQQ Adapter] 正在停止账号 ${qq}: ${reason}`)

  try {
    await Promise.race([
      Promise.resolve(bot.super?.logout?.()),
      new Promise(resolve => setTimeout(resolve, 1500))
    ])
  } catch (error) {
    logger.debug(`[ICQQ Adapter] 账号 ${qq} 下线时出现异常`, error)
  }

  try {
    const registered = getBot(String(qq)) as unknown as AdapterICQQ | null
    if (registered && registered === bot) {
      unregisterBot('index', registered.adapter.index)
    }
  } catch (error) {
    logger.debug(`[ICQQ Adapter] 账号 ${qq} 注销 bot 时出现异常`, error)
  }

  return true
}

/**
 * 获取账号运行状态
 * @param qq QQ号
 */
export function getAccountRuntime (qq: number): AccountRuntimeInfo {
  const record = runtimes.get(qq)
  if (record) {
    return { ...record.info }
  }

  if (getBot(String(qq))) {
    return {
      status: 'online',
      message: '在线',
      updatedAt: Date.now()
    }
  }

  return {
    status: 'offline',
    message: '未加载',
    updatedAt: Date.now()
  }
}
