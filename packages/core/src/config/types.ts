/** 支持的协议平台 */
export const PLATFORMS = [1, 2, 3, 4, 5, 6] as const

/** 协议平台 */
export type Platform = typeof PLATFORMS[number]

/** 日志等级 */
export const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'mark', 'off'] as const

/** 日志等级 */
export type LogLevel = typeof LOG_LEVELS[number]

/** 单个账号的 icqq 配置 */
export interface AccountCfg {
  /**
   * 协议类型
   * - 1: 安卓手机
   * - 2: 安卓平板
   * - 3: 安卓手表
   * - 4: MacOS
   * - 5: iPad
   * - 6: Tim
   */
  platform: Platform
  /** 协议版本 不填默认最新 */
  ver: string
  /** 群聊和频道中过滤自己的消息 */
  ignore_self: boolean
  /** 签名服务器地址 不设置将使用默认地址 */
  sign_api_addr: string
  /** 是否缓存群员列表，群多的时候(500~1000)会多占据约100MB + 内存 */
  cache_group_member: boolean
  log_level: LogLevel
  /** 数据存储文件夹，需要可写权限，默认主模块下的data文件夹 */
  data_dir?: string
  /** ffmpeg 可执行文件路径 */
  ffmpeg_path?: string
  /** ffprobe 可执行文件路径 */
  ffprobe_path?: string
}

/** 单个账号配置 */
export interface CfgType {
  /** 是否启用该账号 */
  enable?: boolean
  /** QQ号 */
  qq: number
  /** 密码，为空则扫码登录 */
  password: string
  /** icqq 配置 */
  cfg: AccountCfg
}

/** 插件配置 */
export interface ConfigType {
  /** 通用签名服务器地址 */
  sign_api_addr: string
  /** 人工过码服务地址（兼容 icqq.qwqo.cn API 的服务） */
  captcha_api: string
  /** bot配置列表 */
  list: CfgType[]
}
