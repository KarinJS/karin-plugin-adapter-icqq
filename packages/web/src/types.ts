export type AccountStatus = 'online' | 'offline' | 'starting' | 'error' | 'disabled'

export type VerificationType = 'slider' | 'auth' | 'device'

export type VerificationStatus =
  | 'creating'
  | 'pending'
  | 'submitting'
  | 'solved'
  | 'approved'
  | 'cancelled'
  | 'expired'
  | 'error'

export interface Verification {
  id: string
  type: VerificationType
  status: VerificationStatus
  url: string | null
  officialUrl: string | null
  phone: string | null
  message: string
  createdAt: number
  expiresAt: number | null
  canRetry: boolean
  canSms: boolean
}

export type Platform = 1 | 2 | 3 | 4 | 5 | 6

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'mark' | 'off'

export interface AccountCfg {
  platform: Platform
  ver: string
  ignore_self: boolean
  sign_api_addr: string
  cache_group_member: boolean
  log_level: LogLevel
  data_dir?: string
  ffmpeg_path?: string
  ffprobe_path?: string
}

export interface AccountRuntime {
  status: AccountStatus
  message: string
  updatedAt: number
  startedAt?: number
}

export interface Account {
  qq: number
  enable: boolean
  hasPassword: boolean
  cfg: AccountCfg
  runtime: AccountRuntime
  verification?: Verification
}

export interface AccountsPayload {
  signApiAddr: string
  captchaApi: string
  list: Account[]
  icqqVersion: string
  configPath: string
  summary: {
    total: number
    enabled: number
    online: number
  }
}

export interface AccountInput {
  qq: number
  password?: string
  clearPassword?: boolean
  enable: boolean
  platform: Platform
  ver: string
  ignoreSelf: boolean
  signApiAddr: string
  cacheGroupMember: boolean
  logLevel: LogLevel
  ffmpegPath: string
  ffprobePath: string
}

export interface MutationResult extends AccountsPayload {
  account?: Account
  qq?: number
}

export interface RuntimeMutationResult {
  qq?: number
  status: AccountStatus
  message?: string
  updatedAt?: number
}
