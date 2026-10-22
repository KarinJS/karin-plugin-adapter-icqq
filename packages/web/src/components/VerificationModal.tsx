import { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Input,
  Modal,
  Spinner,
  toast
} from '@heroui/react'
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Send,
  ShieldCheck,
  Smartphone
} from 'lucide-react'
import { renewVerification, sendVerificationSms, submitVerificationSms } from '../api'
import type { Account, Verification } from '../types'

interface VerificationModalProps {
  account: Account | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRefresh: () => Promise<void>
}

const titles = {
  slider: '完成滑动验证',
  auth: '完成安全验证',
  device: '完成短信验证'
} as const

const descriptions = {
  slider: '请在下方页面完成滑动验证，结果会自动回传到登录流程。',
  auth: 'QQ 要求完成一次人工安全验证，请在下方页面完成。',
  device: 'QQ 要求完成一次登录保护验证，请使用下方短信验证码完成。'
} as const

function isActive (verification: Verification | undefined): boolean {
  return Boolean(verification && ['creating', 'pending', 'submitting'].includes(verification.status))
}

export function VerificationModal ({ account, open, onOpenChange, onRefresh }: VerificationModalProps) {
  const verification = account?.verification
  const [smsCode, setSmsCode] = useState('')
  const [busy, setBusy] = useState<'renew' | 'send' | 'submit' | null>(null)
  const [frameLoading, setFrameLoading] = useState(true)

  useEffect(() => {
    setSmsCode('')
    setFrameLoading(true)
  }, [verification?.id])

  const renew = async (): Promise<void> => {
    if (!account) return
    setBusy('renew')
    try {
      await renewVerification(account.qq)
      toast.success('已重新发起验证')
      await onRefresh()
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : '重新发起验证失败')
    } finally {
      setBusy(null)
    }
  }

  const sendSms = async (): Promise<void> => {
    if (!account) return
    setBusy('send')
    try {
      await sendVerificationSms(account.qq)
      toast.success('短信验证码已发送')
      await onRefresh()
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : '发送短信验证码失败')
    } finally {
      setBusy(null)
    }
  }

  const submitSms = async (): Promise<void> => {
    if (!account) return
    if (!/^\d{6}$/.test(smsCode.trim())) {
      toast.danger('请输入 6 位短信验证码')
      return
    }
    setBusy('submit')
    try {
      await submitVerificationSms(account.qq, smsCode.trim())
      toast.success('短信验证码已提交')
      setSmsCode('')
      await onRefresh()
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : '提交短信验证码失败')
    } finally {
      setBusy(null)
    }
  }

  const title = verification
    ? verification.type === 'device' && !verification.canSms
      ? '完成登录保护验证'
      : titles[verification.type]
    : '登录验证'
  const description = verification
    ? verification.type === 'device' && !verification.canSms
      ? 'QQ 要求完成一次登录保护验证，请打开官方验证页面完成。'
      : descriptions[verification.type]
    : '当前没有进行中的登录验证。'
  const active = isActive(verification)
  const finished = verification?.status === 'solved' || verification?.status === 'approved'
  const canRetry = Boolean(verification?.canRetry)
  const showSms = Boolean(
    verification &&
    verification.canSms &&
    ['creating', 'pending', 'error', 'expired', 'cancelled'].includes(verification.status)
  )
  const showFrame = Boolean(
    verification &&
    verification.url &&
    verification.status === 'pending' &&
    verification.type !== 'device'
  )
  const showOfficialUrl = Boolean(
    verification &&
    verification.officialUrl &&
    (verification.type === 'device' || (!verification.url && verification.status !== 'creating'))
  )

  return (
    <Modal isOpen={open} onOpenChange={onOpenChange}>
      <Modal.Backdrop>
        <Modal.Container size="lg" scroll="inside">
          <Modal.Dialog className="w-[min(920px,calc(100vw-2rem))] max-w-none">
            <Modal.Header className="flex items-start justify-between gap-4 border-b border-separator p-5">
              <div className="flex min-w-0 gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-accent/20 bg-accent/10 text-accent">
                  <ShieldCheck className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold tracking-[0.18em] text-accent">LOGIN VERIFICATION</p>
                  <Modal.Heading className="mt-1 text-lg font-bold">{title}</Modal.Heading>
                  <p className="mt-1 text-xs leading-relaxed text-muted">
                    {account ? `账号 ${account.qq} · ${description}` : description}
                  </p>
                </div>
              </div>
              <Modal.CloseTrigger aria-label="关闭验证窗口" />
            </Modal.Header>

            <Modal.Body className="space-y-4 p-5">
              {!verification && (
                <div className="py-10 text-center text-sm text-muted">当前没有待处理的验证。</div>
              )}

              {verification?.type === 'device' && (
                <div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
                  <div className="flex items-center gap-2 text-xs font-medium">
                    <ShieldCheck className="size-4 text-accent" />
                    登录保护验证
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted">
                    QQ 检测到本次登录需要登录保护验证，请使用短信验证码完成；如果没有可用的密保手机，可以打开官方验证页面处理。
                  </p>
                </div>
              )}

              {verification?.status === 'creating' && (
                <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-separator">
                  <Spinner size="lg" />
                  <p className="text-sm text-muted">正在创建验证会话…</p>
                </div>
              )}

              {showFrame && (
                <div className="relative overflow-hidden rounded-xl border border-separator bg-surface-secondary">
                  {frameLoading && (
                    <div className="absolute inset-0 z-10 grid place-items-center bg-surface/80 backdrop-blur-sm">
                      <div className="flex flex-col items-center gap-2">
                        <Spinner />
                        <span className="text-xs text-muted">正在加载验证页面…</span>
                      </div>
                    </div>
                  )}
                  <iframe
                    src={verification!.url!}
                    title={`${title} · ${account?.qq ?? ''}`}
                    className="h-[min(560px,65vh)] w-full border-0"
                    allow="clipboard-read; clipboard-write"
                    referrerPolicy="no-referrer"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals"
                    onLoad={() => setFrameLoading(false)}
                  />
                </div>
              )}

              {verification?.url && active && (
                <div className="flex justify-end">
                  <a
                    href={verification.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline"
                  >
                    <ExternalLink className="size-3.5" />
                    在新窗口打开验证页面
                  </a>
                </div>
              )}

              {showOfficialUrl && (
                <div className="flex justify-end">
                  <a
                    href={verification!.officialUrl!}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline"
                  >
                    <ExternalLink className="size-3.5" />
                    打开官方验证页面
                  </a>
                </div>
              )}

              {verification?.type !== 'device' && verification?.status === 'pending' && !verification.url && (
                <Alert status="warning">
                  <Alert.Indicator><AlertTriangle className="size-4" /></Alert.Indicator>
                  <Alert.Content>
                    <Alert.Title>验证页面不可用</Alert.Title>
                    <Alert.Description>{verification.message}</Alert.Description>
                  </Alert.Content>
                  {canRetry && (
                    <Button size="sm" variant="secondary" isDisabled={busy !== null} onPress={renew}>
                      重新发起
                    </Button>
                  )}
                </Alert>
              )}

              {verification?.type === 'device' && !verification.canSms && (
                <Alert status="warning">
                  <Alert.Indicator><AlertTriangle className="size-4" /></Alert.Indicator>
                  <Alert.Content>
                    <Alert.Title>需要人工验证</Alert.Title>
                    <Alert.Description>{verification.message}</Alert.Description>
                  </Alert.Content>
                </Alert>
              )}

              {verification?.status === 'submitting' && (
                <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-separator">
                  <Spinner size="lg" />
                  <p className="text-sm text-muted">{verification.message}</p>
                </div>
              )}

              {finished && (
                <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-xl border border-success/20 bg-success/5 px-6 text-center">
                  <CheckCircle2 className="size-10 text-success" />
                  <div>
                    <p className="text-sm font-semibold">验证结果已提交</p>
                    <p className="mt-1 text-xs text-muted">
                      {verification?.message || '正在等待 QQ 返回登录结果，请稍候…'}
                    </p>
                  </div>
                </div>
              )}

              {verification && ['error', 'expired', 'cancelled'].includes(verification.status) && (
                <Alert status="danger">
                  <Alert.Indicator><AlertTriangle className="size-4" /></Alert.Indicator>
                  <Alert.Content>
                    <Alert.Title>验证未完成</Alert.Title>
                    <Alert.Description>{verification.message}</Alert.Description>
                  </Alert.Content>
                  {canRetry && (
                    <Button size="sm" variant="danger-soft" isDisabled={busy !== null} onPress={renew}>
                      <RefreshCw className="size-3.5" />
                      重新发起
                    </Button>
                  )}
                </Alert>
              )}

              {showSms && (
                <div className="rounded-xl border border-separator p-4">
                  <div className="flex items-center gap-2 text-xs font-medium">
                    <Smartphone className="size-4 text-accent" />
                    {verification?.type === 'device' ? '短信验证' : '手动短信验证'}
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted">
                    {verification?.type === 'device'
                      ? (verification.phone
                          ? `验证码将发送至密保手机 ${verification.phone}，收到后在此输入。`
                          : '请发送并输入短信验证码完成验证。')
                      : (verification?.phone
                          ? `可向密保手机 ${verification.phone} 发送验证码，也可以直接在上方页面完成验证。`
                          : '如果上方页面无法完成，可以在此发送并提交短信验证码。')}
                  </p>
                  {verification?.type === 'device' && verification.message.includes('验证码已发送') && (
                    <p className="mt-1 text-[11px] leading-relaxed text-muted">{verification.message}</p>
                  )}
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <Button
                      size="sm"
                      variant={verification?.type === 'device' ? 'primary' : 'secondary'}
                      isDisabled={busy !== null}
                      onPress={sendSms}
                    >
                      {busy === 'send' ? <Spinner size="sm" color="current" /> : <Send className="size-3.5" />}
                      发送验证码
                    </Button>
                    <div className="flex min-w-0 flex-1 gap-2">
                      <Input
                        value={smsCode}
                        onChange={event => setSmsCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="6 位短信验证码"
                        inputMode="numeric"
                        maxLength={6}
                        aria-label="短信验证码"
                        className="min-w-0"
                      />
                      <Button
                        size="sm"
                        variant="primary"
                        isDisabled={busy !== null || smsCode.length !== 6}
                        onPress={submitSms}
                      >
                        {busy === 'submit' ? <Spinner size="sm" color="current" /> : null}
                        提交
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {active && (
                <p className="text-[11px] leading-relaxed text-muted">
                  {verification?.type === 'device'
                    ? verification.canSms
                      ? '验证码提交后会自动继续登录，请不要重复提交；如果改用官方页面完成验证，需要重新上线账号。'
                      : '在官方验证页面完成验证后，请重新上线账号以继续登录。'
                    : '完成验证后结果会自动回传，请不要重复提交；如果页面长时间无响应，可以重新发起验证。'}
                </p>
              )}
            </Modal.Body>

            <Modal.Footer className="flex justify-end gap-2 border-t border-separator p-4">
              <Button variant="ghost" onPress={() => onOpenChange(false)}>
                关闭
              </Button>
              {canRetry && (
                <Button
                  variant="primary"
                  isDisabled={busy !== null}
                  onPress={renew}
                >
                  {busy === 'renew' ? <Spinner size="sm" color="current" /> : <RefreshCw className="size-4" />}
                  {verification?.type === 'device' ? '重新验证' : '重新发起验证'}
                </Button>
              )}
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}
