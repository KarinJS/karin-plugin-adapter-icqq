import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Chip,
  EmptyState,
  InputGroup,
  Skeleton,
  Spinner,
  Toast,
  cn,
  toast
} from '@heroui/react'
import {
  AlertTriangle,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Users
} from 'lucide-react'
import { deleteAccount, offlineAccount, onlineAccount, saveGlobalConfig } from './api'
import { AccountModal } from './components/AccountModal'
import { AccountRow } from './components/AccountRow'
import { AuthGate } from './components/AuthGate'
import { ConfirmDelete } from './components/ConfirmDelete'
import { GlobalConfigCard } from './components/GlobalConfigCard'
import { VerificationModal } from './components/VerificationModal'
import { filterOptions } from './constants'
import { useAccounts } from './hooks/useAccounts'
import { useKarinTheme } from './hooks/useTheme'
import type { Account, AccountStatus } from './types'

type Filter = typeof filterOptions[number]['value']

const statusOnline = (status: AccountStatus): boolean => status === 'online' || status === 'starting'

export default function App () {
  const { payload, loading, refreshing, error, authRequired, reload } = useAccounts()
  useKarinTheme()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [modal, setModal] = useState<{ open: boolean; account: Account | null }>({ open: false, account: null })
  const [deleting, setDeleting] = useState<Account | null>(null)
  const [busyQq, setBusyQq] = useState<number | null>(null)
  const [verifyQq, setVerifyQq] = useState<number | null>(null)

  const accounts = useMemo(() => {
    if (!payload) return []
    const keyword = query.trim()
    return payload.list.filter(account => {
      const online = statusOnline(account.runtime.status)
      if (filter === 'online' && !online) return false
      if (filter === 'offline' && online) return false
      if (keyword && !String(account.qq).includes(keyword)) return false
      return true
    })
  }, [payload, query, filter])

  const summary = payload?.summary
  const icqqVersion = payload?.icqqVersion && payload.icqqVersion !== 'unknown'
    ? payload.icqqVersion.replace(/^v/, '')
    : null
  const filteredHint = accounts.length !== payload?.list.length ? ` · 当前显示 ${accounts.length} 个` : ''
  const verifyAccount = payload?.list.find(item => item.qq === verifyQq) ?? null

  useEffect(() => {
    if (verifyQq && !verifyAccount?.verification) setVerifyQq(null)
  }, [verifyQq, verifyAccount?.verification])

  useEffect(() => {
    if (!verifyQq || verifyAccount?.runtime.status !== 'online') return
    toast.success(`账号 ${verifyAccount.qq} 已登录`)
    setVerifyQq(null)
  }, [verifyQq, verifyAccount?.runtime.status, verifyAccount?.qq])

  const closeVerification = (): void => {
    setVerifyQq(null)
  }

  const saveConfig = async (signApiAddr: string, captchaApi: string): Promise<void> => {
    try {
      const result = await saveGlobalConfig(signApiAddr, captchaApi)
      toast.success(result.message || '全局配置已保存')
      await reload({ silent: true })
    } catch (err) {
      toast.danger(err instanceof Error ? err.message : '保存全局配置失败')
    }
  }

  const handleRuntime = async (account: Account, action: 'online' | 'offline'): Promise<void> => {
    setBusyQq(account.qq)
    try {
      if (action === 'online') {
        await onlineAccount(account.qq)
        toast.success(`账号 ${account.qq} 正在登录`)
      } else {
        await offlineAccount(account.qq)
        toast.success(`账号 ${account.qq} 已下线`)
      }
      await reload({ silent: true })
    } catch (err) {
      toast.danger(err instanceof Error ? err.message : '操作失败')
    } finally {
      setBusyQq(null)
    }
  }

  const handleDelete = async (account: Account): Promise<void> => {
    await deleteAccount(account.qq)
    toast.success(`账号 ${account.qq} 已删除`)
    setDeleting(null)
    await reload({ silent: true })
  }

  return (
    <div className="relative min-h-screen">
      <div className="aurora" aria-hidden="true" />
      <Toast.Provider placement="top end" />

      <main className="mx-auto w-full max-w-[1120px] px-4 pb-10 sm:px-6">
        <div className="flex flex-col gap-4 py-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">账号管理</h1>
            <p className="mt-1 text-sm text-muted">管理 ICQQ 账号、登录状态与签名服务器。</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Chip size="sm" variant="soft" color="default" className="border border-separator">
              共 {summary ? summary.total : '—'} 个账号
            </Chip>
            <Chip size="sm" variant="soft" color="success" className="border border-separator">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              {summary ? summary.online : '—'} 在线
            </Chip>
            <Chip size="sm" variant="soft" color="default" className="border border-separator">
              icqq {icqqVersion ?? '—'}
            </Chip>
            <Button
              size="sm"
              variant="ghost"
              isDisabled={refreshing}
              onPress={() => { void reload() }}
            >
              {refreshing ? <Spinner size="sm" color="current" /> : <RefreshCw className="size-4" />}
              刷新
            </Button>
          </div>
        </div>

        {error && (
          <Alert status="danger" className="mb-4">
            <Alert.Indicator>
              <AlertTriangle className="size-4" />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>加载失败</Alert.Title>
              <Alert.Description>{error}</Alert.Description>
            </Alert.Content>
            <Button size="sm" variant="danger-soft" onPress={() => { void reload() }}>
              重试
            </Button>
          </Alert>
        )}

        <div className="grid gap-4">
          <GlobalConfigCard
            signApiAddr={payload?.signApiAddr ?? ''}
            captchaApi={payload?.captchaApi ?? ''}
            onSave={saveConfig}
          />

          <Card className="gap-0 border border-separator bg-surface/70 p-0 shadow-none backdrop-blur-xl">
            <Card.Header className="flex flex-col gap-4 border-b border-separator p-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-separator bg-surface-secondary text-muted">
                  <Users className="size-5" />
                </span>
                <div>
                  <Card.Title className="text-sm font-semibold">账号列表</Card.Title>
                  <Card.Description className="mt-0.5 text-xs">
                    {payload
                      ? `共 ${summary?.total ?? 0} 个账号 · ${summary?.enabled ?? 0} 个启用${filteredHint}`
                      : '正在读取账号配置…'}
                  </Card.Description>
                </div>
              </div>

              <div className="flex w-full flex-wrap items-center gap-2 xl:w-auto">
                <InputGroup className="min-w-[150px] flex-1 xl:w-52 xl:flex-none">
                  <InputGroup.Prefix>
                    <Search className="size-4 text-muted" />
                  </InputGroup.Prefix>
                  <InputGroup.Input
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    placeholder="搜索 QQ 号"
                    aria-label="搜索 QQ 号"
                    type="search"
                    className="min-w-0"
                  />
                </InputGroup>

                <div className="flex items-center gap-1 rounded-xl border border-separator bg-surface/70 p-1">
                  {filterOptions.map(option => (
                    <Button
                      key={option.value}
                      size="sm"
                      variant={filter === option.value ? 'secondary' : 'ghost'}
                      className={cn('min-w-0 px-3', filter === option.value && 'shadow-none')}
                      onPress={() => setFilter(option.value)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>

                <Button
                  variant="primary"
                  onPress={() => setModal({ open: true, account: null })}
                  className="max-sm:flex-1"
                >
                  <Plus className="size-4" />
                  新增账号
                </Button>
              </div>
            </Card.Header>

            <Card.Content className="p-0">
              {loading && !payload && <SkeletonRows />}

              {payload && accounts.length > 0 && (
                <div className="divide-y divide-separator">
                  {accounts.map(account => (
                    <AccountRow
                      key={account.qq}
                      account={account}
                      busy={busyQq === account.qq}
                      onEdit={target => setModal({ open: true, account: target })}
                      onDelete={setDeleting}
                      onOnline={target => { void handleRuntime(target, 'online') }}
                      onOffline={target => { void handleRuntime(target, 'offline') }}
                      onVerify={target => setVerifyQq(target.qq)}
                    />
                  ))}
                </div>
              )}

              {payload && accounts.length === 0 && (
                <EmptyState className="m-4 min-h-[220px] rounded-xl border border-dashed border-separator bg-surface-secondary/40 p-8 text-center">
                  <span className="mx-auto mb-3 grid size-12 place-items-center rounded-xl border border-separator bg-accent/5 text-accent">
                    <Settings2 className="size-6" />
                  </span>
                  <h3 className="text-sm font-semibold">
                    {payload.list.length === 0 ? '还没有账号' : '没有匹配的账号'}
                  </h3>
                  <p className="mt-1 text-xs text-muted">
                    {payload.list.length === 0 ? '添加第一个 ICQQ 账号，开始接管消息吧。' : '换一个关键词，或者切换筛选条件试试。'}
                  </p>
                  {payload.list.length === 0 && (
                    <Button
                      variant="primary"
                      className="mt-4"
                      onPress={() => setModal({ open: true, account: null })}
                    >
                      <Plus className="size-4" />
                      新增账号
                    </Button>
                  )}
                </EmptyState>
              )}

              {!loading && !payload && !error && (
                <div className="p-8 text-center text-sm text-muted">暂无数据</div>
              )}
            </Card.Content>
          </Card>
        </div>

        <footer className="mt-6 flex items-center gap-2 border-t border-separator pt-4 text-[11px] text-muted">
          <i className="size-1.5 shrink-0 rounded-full bg-success" />
          配置文件
          <code className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-muted">{payload?.configPath ?? '—'}</code>
        </footer>
      </main>

      <AuthGate open={authRequired} />

      <AccountModal
        open={modal.open}
        account={modal.account}
        onOpenChange={open => setModal(current => ({ ...current, open }))}
        onSaved={() => { void reload({ silent: true }) }}
      />

      <ConfirmDelete
        account={deleting}
        open={Boolean(deleting)}
        onOpenChange={open => { if (!open) setDeleting(null) }}
        onConfirm={handleDelete}
      />

      <VerificationModal
        account={verifyAccount}
        open={Boolean(verifyQq && verifyAccount?.verification)}
        onOpenChange={open => { if (!open) closeVerification() }}
        onRefresh={async () => { await reload({ silent: true }) }}
      />
    </div>
  )
}

function SkeletonRows () {
  return (
    <div className="divide-y divide-separator">
      {[0, 1, 2].map(item => (
        <div key={item} className="flex items-center gap-3 px-4 py-4 md:px-5">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-32 rounded-md" />
            <Skeleton className="h-3 w-48 rounded-md" />
          </div>
          <Skeleton className="hidden h-8 w-40 rounded-lg md:block" />
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
      ))}
    </div>
  )
}
