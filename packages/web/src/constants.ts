import type { LogLevel, Platform } from './types'

export const platformOptions: Array<{ value: Platform; label: string }> = [
  { value: 1, label: '安卓手机' },
  { value: 2, label: '安卓平板' },
  { value: 3, label: '安卓手表' },
  { value: 4, label: 'MacOS' },
  { value: 5, label: 'iPad' },
  { value: 6, label: 'TIM' }
]

export const logLevelOptions: Array<{ value: LogLevel; label: string }> = [
  { value: 'trace', label: 'trace' },
  { value: 'debug', label: 'debug' },
  { value: 'info', label: 'info' },
  { value: 'warn', label: 'warn' },
  { value: 'error', label: 'error' },
  { value: 'fatal', label: 'fatal' },
  { value: 'mark', label: 'mark' },
  { value: 'off', label: 'off' }
]

export const filterOptions = [
  { value: 'all', label: '全部' },
  { value: 'online', label: '在线' },
  { value: 'offline', label: '离线' }
] as const
