import type { AccountStatus, Platform } from './types'

/** 平台名称 */
export const platformLabels: Record<Platform, string> = {
  1: '安卓手机',
  2: '安卓平板',
  3: '安卓手表',
  4: 'MacOS',
  5: 'iPad',
  6: 'TIM'
}

/** 状态展示信息 */
export const statusMeta: Record<AccountStatus, {
  label: string
  color: 'success' | 'warning' | 'danger' | 'default'
  dot: string
}> = {
  online: { label: '在线', color: 'success', dot: 'bg-emerald-400' },
  starting: { label: '连接中', color: 'warning', dot: 'bg-amber-400' },
  error: { label: '异常', color: 'danger', dot: 'bg-rose-400' },
  offline: { label: '离线', color: 'default', dot: 'bg-slate-400' },
  disabled: { label: '已停用', color: 'default', dot: 'bg-slate-500' }
}

/** 行内相对时间 */
export function relativeTime (timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '未知'

  const diff = Math.max(0, Date.now() - timestamp)
  const seconds = Math.floor(diff / 1000)
  if (seconds < 10) return '刚刚'
  if (seconds < 60) return `${seconds} 秒前`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} 天前`
  return new Date(timestamp).toLocaleDateString('zh-CN')
}
