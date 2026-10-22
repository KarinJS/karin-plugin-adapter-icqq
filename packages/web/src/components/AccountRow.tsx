import { Avatar, Button, Chip, cn } from '@heroui/react'
import { Pencil, Play, Power, ShieldCheck, Trash2 } from 'lucide-react'
import { platformLabels, relativeTime, statusMeta } from '../format'
import type { Account } from '../types'

interface AccountRowProps {
  account: Account
  busy: boolean
  onEdit: (account: Account) => void
  onDelete: (account: Account) => void
  onOnline: (account: Account) => void
  onOffline: (account: Account) => void
  onVerify: (account: Account) => void
}

const chipColors = {
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  default: 'default'
} as const

function Meta ({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wider text-muted">{label}</dt>
      <dd className={cn('mt-0.5 truncate text-xs text-foreground/90', mono && 'font-mono')} title={value}>
        {value}
      </dd>
    </div>
  )
}

export function AccountRow ({ account, busy, onEdit, onDelete, onOnline, onOffline, onVerify }: AccountRowProps) {
  const status = statusMeta[account.runtime.status] || statusMeta.offline
  const verification = account.verification
  const verificationActive = Boolean(verification && ['creating', 'pending', 'submitting', 'error', 'expired', 'cancelled'].includes(verification.status))
  const canVerify = Boolean(verification && ['creating', 'pending', 'error', 'expired', 'cancelled'].includes(verification.status))
  const displayStatus = verificationActive
    ? { label: verification?.status === 'submitting' ? '验证中' : '待验证', color: 'warning' as const, dot: 'bg-amber-400' }
    : status
  const platform = platformLabels[account.cfg.platform] || `平台 ${account.cfg.platform}`
  const canStart = account.enable && !canVerify && account.runtime.status !== 'online' && account.runtime.status !== 'starting'
  const canStop = account.runtime.status === 'online' || account.runtime.status === 'starting'
  const avatar = `https://q1.qlogo.cn/g?b=qq&s=100&nk=${account.qq}`
  const note = verification && ['creating', 'pending', 'submitting', 'error', 'expired', 'cancelled'].includes(verification.status)
    ? verification.message
    : account.runtime.message || status.label

  return (
    <div
      className={cn(
        'group flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-surface-secondary/50 md:flex-row md:items-center md:gap-5 md:px-5',
        !account.enable && 'opacity-80'
      )}
    >
      <div className="flex min-w-0 items-center gap-3 md:w-[34%] md:shrink-0">
        <div className="relative shrink-0">
          <Avatar size="md" variant="soft" color={chipColors[displayStatus.color]}>
            <Avatar.Image
              src={avatar}
              alt={`${account.qq} 的头像`}
              loading="lazy"
              referrerPolicy="no-referrer"
            />
            <Avatar.Fallback>{String(account.qq).slice(0, 1)}</Avatar.Fallback>
          </Avatar>
          <span className={cn('absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-surface', displayStatus.dot)} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-sm font-semibold tracking-tight">{account.qq}</span>
            <Chip size="sm" variant="soft" color={chipColors[displayStatus.color]} className="h-5 border border-separator px-1.5 text-[10px]">
              {displayStatus.label}
            </Chip>
            <Chip size="sm" variant="soft" color="default" className="h-5 border border-separator px-1.5 text-[10px]">
              {platform}
            </Chip>
          </div>
          <p className="mt-1 truncate text-[11px] text-muted" title={note}>
            {note} · {relativeTime(account.runtime.updatedAt)}
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 md:flex md:flex-1 md:items-center md:gap-6">
        <Meta label="协议版本" value={account.cfg.ver || '自动'} />
        <Meta label="日志等级" value={account.cfg.log_level} />
        <Meta label="登录方式" value={account.hasPassword ? '已保存密码' : '扫码登录'} />
        <Meta label="签名服务器" value={account.cfg.sign_api_addr ? '独立签名' : '跟随全局'} />
      </dl>

      <div className="flex items-center gap-1.5 md:shrink-0">
        {canVerify && (
          <Button
            size="sm"
            variant="primary"
            isDisabled={busy}
            onPress={() => onVerify(account)}
          >
            <ShieldCheck className="size-3.5" />
            验证
          </Button>
        )}
        <Button
          size="sm"
          variant="tertiary"
          isDisabled={busy}
          onPress={() => onEdit(account)}
        >
          <Pencil className="size-3.5" />
          编辑
        </Button>
        {canStart && (
          <Button
            size="sm"
            variant="primary"
            isDisabled={busy}
            onPress={() => onOnline(account)}
          >
            <Play className="size-3.5" />
            上线
          </Button>
        )}
        {canStop && (
          <Button
            size="sm"
            variant="secondary"
            isDisabled={busy}
            onPress={() => onOffline(account)}
          >
            <Power className="size-3.5" />
            下线
          </Button>
        )}
        <Button
          isIconOnly
          size="sm"
          variant="danger-soft"
          className="ml-auto md:ml-0"
          aria-label={`删除账号 ${account.qq}`}
          isDisabled={busy}
          onPress={() => onDelete(account)}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}
