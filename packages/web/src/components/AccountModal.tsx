import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Alert,
  Button,
  Input,
  InputGroup,
  ListBox,
  Modal,
  Select,
  Spinner,
  cn,
  toast
} from '@heroui/react'
import {
  AlertTriangle,
  ChevronDown,
  Eye,
  EyeOff,
  KeyRound,
  SlidersHorizontal,
  Sparkles
} from 'lucide-react'
import { createAccount, updateAccount } from '../api'
import { logLevelOptions, platformOptions } from '../constants'
import type { Account, AccountInput, LogLevel, Platform } from '../types'
import { OptionSwitch } from './OptionSwitch'
import { SensitiveInput } from './SensitiveInput'

interface AccountModalProps {
  open: boolean
  account: Account | null
  onOpenChange: (open: boolean) => void
  onSaved: (message: string) => void
}

interface FormState {
  qq: string
  password: string
  clearPassword: boolean
  enable: boolean
  platform: Platform
  ver: string
  ignoreSelf: boolean
  cacheGroupMember: boolean
  signApiAddr: string
  logLevel: LogLevel
  ffmpegPath: string
  ffprobePath: string
}

const emptyForm: FormState = {
  qq: '',
  password: '',
  clearPassword: false,
  enable: true,
  platform: 1,
  ver: '',
  ignoreSelf: true,
  cacheGroupMember: false,
  signApiAddr: '',
  logLevel: 'warn',
  ffmpegPath: '',
  ffprobePath: ''
}

function accountToForm (account: Account): FormState {
  return {
    qq: String(account.qq),
    password: '',
    clearPassword: false,
    enable: account.enable,
    platform: account.cfg.platform,
    ver: account.cfg.ver,
    ignoreSelf: account.cfg.ignore_self,
    cacheGroupMember: account.cfg.cache_group_member,
    signApiAddr: account.cfg.sign_api_addr,
    logLevel: account.cfg.log_level,
    ffmpegPath: account.cfg.ffmpeg_path || '',
    ffprobePath: account.cfg.ffprobe_path || ''
  }
}

function isValidUrl (value: string): boolean {
  if (!value) return true
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/** 字段校验失败时的强调样式，确保输入框整体变红 */
const invalidFieldStyle = {
  borderColor: 'var(--danger)',
  boxShadow: '0 0 0 2px color-mix(in srgb, var(--danger) 25%, transparent)'
}

export function AccountModal ({ open, account, onOpenChange, onSaved }: AccountModalProps) {
  const [form, setForm] = useState<FormState>(emptyForm)
  const [showPassword, setShowPassword] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ qq?: string, password?: string }>({})

  const editingQq = account?.qq ?? null

  useEffect(() => {
    if (!open) return
    const next = account ? accountToForm(account) : emptyForm
    setForm(next)
    setShowPassword(false)
    setAdvancedOpen(Boolean(next.signApiAddr || next.ffmpegPath || next.ffprobePath))
    setSubmitting(false)
    setError(null)
    setFieldErrors({})
  }, [open, editingQq])

  const patch = (value: Partial<FormState>): void => {
    setForm(current => ({ ...current, ...value }))
  }

  const clearFieldError = (key: 'qq' | 'password'): void => {
    setFieldErrors(current => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  /** 未填写密码时使用扫码登录；icqq 只有 MacOS / 安卓手表协议支持扫码 */
  const qrMode = !form.password && (account ? (!account.hasPassword || form.clearPassword) : true)
  const qrPlatform = form.platform === 3 || form.platform === 4

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    setError(null)
    setFieldErrors({})

    const editing = Boolean(account)
    const qqText = form.qq.trim()
    const errors: { qq?: string, password?: string } = {}

    if (!editing) {
      if (!qqText) errors.qq = '请输入 QQ 号'
      else if (!/^[1-9]\d{4,11}$/.test(qqText)) errors.qq = '请输入 5-12 位有效 QQ 号'
    }
    if (form.password.length > 256) {
      errors.password = '密码长度不能超过 256 个字符'
    } else if (qrMode && !qrPlatform) {
      errors.password = '当前设备不支持扫码登录，请使用密码登录'
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    if (form.ver.trim().length > 32) {
      setError('协议版本不能超过 32 个字符')
      return
    }
    if (!isValidUrl(form.signApiAddr.trim())) {
      setError('账号级签名服务器地址格式不正确')
      return
    }
    if (form.ffmpegPath.trim().length > 512 || form.ffprobePath.trim().length > 512) {
      setError('ffmpeg / ffprobe 路径过长')
      return
    }

    const input: AccountInput = {
      qq: account ? account.qq : Number(qqText),
      password: form.password,
      clearPassword: form.clearPassword,
      enable: form.enable,
      platform: form.platform,
      ver: form.ver.trim(),
      ignoreSelf: form.ignoreSelf,
      signApiAddr: form.signApiAddr.trim(),
      cacheGroupMember: form.cacheGroupMember,
      logLevel: form.logLevel,
      ffmpegPath: form.ffmpegPath.trim(),
      ffprobePath: form.ffprobePath.trim()
    }

    setSubmitting(true)
    try {
      if (account) {
        await updateAccount(input)
        toast.success(`账号 ${account.qq} 配置已更新`)
        onSaved(`账号 ${account.qq} 配置已更新`)
      } else {
        await createAccount(input)
        toast.success(`账号 ${input.qq} 已创建，正在登录`)
        onSaved(`账号 ${input.qq} 已创建，正在登录`)
      }
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : '保存账号失败'
      setError(message)
      toast.danger(message)
    } finally {
      setSubmitting(false)
    }
  }

  const title = account ? '编辑账号' : '新增账号'
  const description = account
    ? '更新账号配置并重新登录，留空的密码会保持不变。'
    : '填写 QQ 号和登录方式，保存后会立即尝试登录。'

  return (
    <Modal isOpen={open} onOpenChange={onOpenChange}>
      <Modal.Backdrop>
        <Modal.Container size="lg" scroll="inside">
          <Modal.Dialog>
            <form className="flex min-h-0 flex-col" onSubmit={submit}>
              <Modal.Header className="flex items-start justify-between gap-4 border-b border-separator p-6">
                <div className="flex min-w-0 gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-accent/20 bg-accent/10 text-accent">
                    <Sparkles className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold tracking-[0.18em] text-accent">
                      {account ? 'EDIT ACCOUNT' : 'NEW ACCOUNT'}
                    </p>
                    <Modal.Heading className="mt-1 text-xl font-bold tracking-tight">{title}</Modal.Heading>
                    <p className="mt-1 text-xs leading-relaxed text-muted">{description}</p>
                  </div>
                </div>
                <Modal.CloseTrigger aria-label="关闭" />
              </Modal.Header>

              <Modal.Body className="p-6">
                {error && (
                  <Alert status="danger" className="mb-4">
                    <Alert.Indicator>
                      <AlertTriangle className="size-4" />
                    </Alert.Indicator>
                    <Alert.Content>
                      <Alert.Title>保存失败</Alert.Title>
                      <Alert.Description>{error}</Alert.Description>
                    </Alert.Content>
                  </Alert>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium">
                      QQ 号 <span className="text-accent">*</span>
                    </span>
                    <Input
                      value={form.qq}
                      onChange={event => {
                        patch({ qq: event.target.value })
                        clearFieldError('qq')
                      }}
                      placeholder="例如 114514"
                      inputMode="numeric"
                      maxLength={12}
                      disabled={Boolean(account)}
                      aria-label="QQ 号"
                      autoComplete="off"
                      data-invalid={Boolean(fieldErrors.qq)}
                      aria-invalid={Boolean(fieldErrors.qq)}
                      style={fieldErrors.qq ? invalidFieldStyle : undefined}
                    />
                    <span className={cn('text-[11px] leading-relaxed', fieldErrors.qq ? 'text-danger' : 'text-muted')}>
                      {fieldErrors.qq || (account ? 'QQ 号是账号唯一标识，不可修改' : '账号创建后不可修改 QQ 号')}
                    </span>
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium">
                      密码 <span className="font-normal text-muted">可选</span>
                    </span>
                    <InputGroup
                      className="min-w-0"
                      data-invalid={Boolean(fieldErrors.password)}
                      aria-invalid={Boolean(fieldErrors.password)}
                      style={fieldErrors.password ? invalidFieldStyle : undefined}
                    >
                      <InputGroup.Prefix>
                        <KeyRound className="size-4 text-muted" />
                      </InputGroup.Prefix>
                      <InputGroup.Input
                        type={showPassword ? 'text' : 'password'}
                        value={form.password}
                        onChange={event => {
                          patch({ password: event.target.value })
                          clearFieldError('password')
                        }}
                        placeholder={account?.hasPassword ? '留空则保留现有密码' : '留空则使用扫码登录'}
                        autoComplete="new-password"
                        maxLength={256}
                        aria-label="密码"
                        className="min-w-0"
                        disabled={form.clearPassword}
                      />
                      <InputGroup.Suffix>
                        <Button
                          isIconOnly
                          size="sm"
                          type="button"
                          variant="ghost"
                          aria-label={showPassword ? '隐藏密码' : '显示密码'}
                          onPress={() => setShowPassword(value => !value)}
                        >
                          {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </Button>
                      </InputGroup.Suffix>
                    </InputGroup>
                    <span className={cn('text-[11px] leading-relaxed', fieldErrors.password ? 'text-danger' : 'text-muted')}>
                      {fieldErrors.password || (account?.hasPassword && !form.clearPassword
                        ? '已保存密码；留空则继续使用原密码'
                        : qrMode
                          ? '未填写密码，保存后将使用扫码登录（仅支持 MacOS / 安卓手表协议）'
                          : '密码仅保存在 Karin 的插件配置文件中')}
                    </span>
                  </label>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium">登录平台</span>
                    <Select
                      selectedKey={String(form.platform)}
                      onSelectionChange={key => {
                        patch({ platform: Number(key) as Platform })
                        clearFieldError('password')
                      }}
                      aria-label="登录平台"
                    >
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator>
                          <ChevronDown className="size-4" />
                        </Select.Indicator>
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          {platformOptions.map(option => (
                            <ListBox.Item key={option.value} id={String(option.value)} textValue={option.label}>
                              {option.label}
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                    <span className="text-[11px] leading-relaxed text-muted">
                      {qrMode
                        ? '扫码登录仅支持 MacOS / 安卓手表协议，其他协议无法获取二维码'
                        : '不同协议的可用能力不同，按需选择'}
                    </span>
                  </div>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium">
                      协议版本 <span className="font-normal text-muted">可选</span>
                    </span>
                    <Input
                      value={form.ver}
                      onChange={event => patch({ ver: event.target.value })}
                      placeholder="留空使用最新版本"
                      maxLength={32}
                      aria-label="协议版本"
                      autoComplete="off"
                    />
                  </label>
                </div>

                <div className="mt-4 flex flex-col gap-1.5">
                  <span className="text-xs font-medium">日志等级</span>
                  <Select
                    selectedKey={form.logLevel}
                    onSelectionChange={key => patch({ logLevel: String(key) as LogLevel })}
                    aria-label="日志等级"
                  >
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator>
                        <ChevronDown className="size-4" />
                      </Select.Indicator>
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {logLevelOptions.map(option => (
                          <ListBox.Item key={option.value} id={option.value} textValue={option.label}>
                            {option.label}
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>

                <div className="mt-5 divide-y divide-separator overflow-hidden rounded-xl border border-separator">
                  <OptionSwitch
                    isSelected={form.enable}
                    onChange={value => patch({ enable: value })}
                    title="启用账号"
                    description="停用后不会参与启动和自动登录"
                  />
                  <OptionSwitch
                    isSelected={form.ignoreSelf}
                    onChange={value => patch({ ignoreSelf: value })}
                    title="过滤自己的消息"
                    description="忽略群聊和频道中由该账号发出的消息"
                  />
                  <OptionSwitch
                    isSelected={form.cacheGroupMember}
                    onChange={value => patch({ cacheGroupMember: value })}
                    title="缓存群成员"
                    description="群多时会额外占用约 100MB 以上内存"
                  />
                  {account?.hasPassword && (
                    <OptionSwitch
                      isSelected={form.clearPassword}
                      onChange={value => {
                        patch(value ? { clearPassword: true, password: '' } : { clearPassword: false })
                        clearFieldError('password')
                      }}
                      title="清除已保存密码"
                      description="勾选后下次登录改用扫码方式"
                    />
                  )}
                </div>

                <details
                  open={advancedOpen}
                  onToggle={event => setAdvancedOpen(event.currentTarget.open)}
                  className="group mt-4 rounded-xl border border-separator"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl bg-surface-secondary px-4 py-3 text-xs font-medium">
                    <span className="flex items-center gap-2">
                      <SlidersHorizontal className="size-4 text-muted" />
                      高级设置
                    </span>
                    <ChevronDown className="size-4 text-muted transition group-open:rotate-180" />
                  </summary>
                  <div className="grid gap-4 border-t border-separator p-4">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium">
                        账号级签名服务器 <span className="font-normal text-muted">可选</span>
                      </span>
                      <SensitiveInput
                        key={`sign-${open}-${editingQq ?? 'new'}`}
                        value={form.signApiAddr}
                        onChange={value => patch({ signApiAddr: value })}
                        ariaLabel="账号级签名服务器地址，默认隐藏"
                        placeholder="留空则跟随全局签名服务器"
                      />
                      <span className="text-[11px] text-muted">默认隐藏，点击眼睛图标显示完整地址。</span>
                    </label>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium">ffmpeg 路径</span>
                        <Input
                          value={form.ffmpegPath}
                          onChange={event => patch({ ffmpegPath: event.target.value })}
                          placeholder="默认读取 FFMPEG_PATH"
                          maxLength={512}
                          spellCheck={false}
                          aria-label="ffmpeg 路径"
                        />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium">ffprobe 路径</span>
                        <Input
                          value={form.ffprobePath}
                          onChange={event => patch({ ffprobePath: event.target.value })}
                          placeholder="默认读取 FFPROBE_PATH"
                          maxLength={512}
                          spellCheck={false}
                          aria-label="ffprobe 路径"
                        />
                      </label>
                    </div>
                  </div>
                </details>
              </Modal.Body>

              <Modal.Footer className="flex justify-end gap-2 border-t border-separator p-4">
                <Button type="button" variant="ghost" onPress={() => onOpenChange(false)}>
                  取消
                </Button>
                <Button type="submit" variant="primary" isDisabled={submitting}>
                  {submitting ? <Spinner size="sm" color="current" /> : null}
                  {account ? '保存并重新登录' : '保存并登录'}
                </Button>
              </Modal.Footer>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}
