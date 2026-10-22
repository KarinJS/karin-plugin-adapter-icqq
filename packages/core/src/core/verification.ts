import { randomUUID } from 'node:crypto'
import axios from 'node-karin/axios'
import { logger } from 'node-karin'
import { Config, DEFAULT_CAPTCHA_API } from '@/config'
import type { AdapterICQQ } from './index'

/** 验证服务创建密钥（站点未启用时可留空） */
const CAPTCHA_API_KEY = process.env.ICQQ_CAPTCHA_API_KEY || ''

/** 验证类型 */
export type VerificationType = 'slider' | 'auth' | 'device'

/** 验证状态 */
export type VerificationStatus =
  | 'creating'
  | 'pending'
  | 'submitting'
  | 'solved'
  | 'approved'
  | 'cancelled'
  | 'expired'
  | 'error'

/** 返回给前端的验证状态（不包含结果令牌等敏感信息） */
export interface VerificationView {
  id: string
  type: VerificationType
  status: VerificationStatus
  /** 过码服务提供的验证页面，可嵌入弹窗 */
  url: string | null
  /** 本次登录返回的官方验证链接，过码服务不可用时由用户自行打开 */
  officialUrl: string | null
  phone: string | null
  message: string
  createdAt: number
  expiresAt: number | null
  canRetry: boolean
  canSms: boolean
}

interface VerificationChallenge {
  type: VerificationType
  url: string
  deviceInfo?: Record<string, string>
  phone?: string
}

interface VerificationSession {
  qq: number
  bot: AdapterICQQ
  challenge: VerificationChallenge
  view: VerificationView
  intervalMs: number
  resultUrl?: string
  resultToken?: string
  kind?: 'ticket' | 'approval'
  timer?: ReturnType<typeof setTimeout>
  cleanupTimer?: ReturnType<typeof setTimeout>
  pollFailures: number
  disposed: boolean
}

interface CaptchaCreateResponse {
  id: string
  kind: 'ticket' | 'approval'
  status: string
  created_at: string
  expires_at: string
  result: unknown
  result_token: string
  poll_interval_ms: number
  verification_url: string
  result_url: string
}

interface CaptchaResultResponse {
  id: string
  kind: 'ticket' | 'approval'
  status: 'pending' | 'solved' | 'approved' | 'cancelled' | 'expired'
  result?: {
    ticket?: string
    randstr?: string
    nt_ticket?: string
    approved?: boolean
  } | null
}

const sessions = new Map<number, VerificationSession>()
const MAX_POLL_FAILURES = 5
const RESULT_RETENTION_MS = 60_000

const typeLabels: Record<VerificationType, string> = {
  slider: '滑动验证',
  auth: '登录安全验证',
  device: '短信验证'
}

/**
 * 过码服务支持的验证类型。
 * 服务端只接受 `ti.qq.com/safe/tools/captcha/sms-verify-login` 与
 * `accounts.qq.com/login/attack` 两类链接，登录保护（短信验证）的
 * `accounts.qq.com/safe/verify` 链接会被直接拒绝。
 * @see https://icqq.qwqo.cn/docs.md
 */
const CAPTCHA_TYPES: VerificationType[] = ['slider', 'auth']

function useCaptchaService (type: VerificationType): boolean {
  return CAPTCHA_TYPES.includes(type)
}

/** 会话创建完成前的提示文案 */
function initialMessage (type: VerificationType, canSms: boolean): string {
  if (type !== 'device') return '正在创建验证会话'
  return canSms
    ? 'QQ 要求完成登录保护验证，请使用下方短信验证完成'
    : 'QQ 要求完成登录保护验证，请打开官方验证页面完成'
}

function normalizeUrl (base: string, url: string): string {
  if (/^https?:\/\//i.test(url)) return url
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`
}

/** 读取当前配置中的过码服务地址 */
function captchaBase (): string {
  return Config.getConfig.captcha_api || DEFAULT_CAPTCHA_API
}

const canRetryStatus: VerificationStatus[] = ['pending', 'error', 'expired', 'cancelled']

function toView (session: VerificationSession): VerificationView {
  /** 短信验证没有过码会话可重建，只在明确失败时允许重试 */
  const retryable = session.view.type !== 'device' && canRetryStatus.includes(session.view.status)
  return {
    ...session.view,
    canRetry: session.view.canRetry || retryable
  }
}

function errorMessage (error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: { message?: string } } | undefined
    return data?.error?.message || error.message || '验证服务请求失败'
  }
  return error instanceof Error ? error.message : '验证服务请求失败'
}

/** 获取账号当前的验证状态 */
export function getVerification (qq: number): VerificationView | undefined {
  const session = sessions.get(qq)
  return session ? toView(session) : undefined
}

function stopTimers (session: VerificationSession): void {
  if (session.timer) clearTimeout(session.timer)
  if (session.cleanupTimer) clearTimeout(session.cleanupTimer)
  session.timer = undefined
  session.cleanupTimer = undefined
}

async function cancelRemoteSession (session: VerificationSession): Promise<void> {
  if (!session.resultUrl || !session.resultToken) return
  try {
    await axios.delete(session.resultUrl, {
      headers: { Authorization: `Bearer ${session.resultToken}` },
      timeout: 8000
    })
  } catch {
    // 会话可能已经完成或过期，无需中断登录流程
  }
}

/** 清理账号的验证状态，可选择取消远端会话 */
export function clearVerification (qq: number, cancelRemote = false): void {
  const session = sessions.get(qq)
  if (!session) return
  sessions.delete(qq)
  session.disposed = true
  stopTimers(session)
  if (cancelRemote) void cancelRemoteSession(session)
}

function schedule (session: VerificationSession, delayMs: number): void {
  if (session.disposed || sessions.get(session.qq) !== session) return
  session.timer = setTimeout(() => {
    session.timer = undefined
    void pollSession(session)
  }, Math.max(250, delayMs))
}

function scheduleCleanup (session: VerificationSession): void {
  if (session.cleanupTimer) clearTimeout(session.cleanupTimer)
  session.cleanupTimer = setTimeout(() => {
    if (sessions.get(session.qq) === session) sessions.delete(session.qq)
  }, RESULT_RETENTION_MS)
}

async function createSession (session: VerificationSession): Promise<void> {
  const body: Record<string, unknown> = {
    verify_url: session.challenge.url,
    expires_in: 600
  }
  if (session.challenge.deviceInfo) body.device_info = session.challenge.deviceInfo
  const base = captchaBase()

  try {
    const response = await axios.post<CaptchaCreateResponse>(
      `${base}/api/v1/captchas`,
      body,
      {
        timeout: 15_000,
        headers: {
          'Content-Type': 'application/json',
          ...(CAPTCHA_API_KEY ? { Authorization: `Bearer ${CAPTCHA_API_KEY}` } : {})
        }
      }
    )
    if (session.disposed || sessions.get(session.qq) !== session) {
      return
    }

    const data = response.data
    session.view.id = data.id
    session.view.status = 'pending'
    session.view.url = normalizeUrl(base, data.verification_url)
    session.view.expiresAt = Number.isFinite(Date.parse(data.expires_at)) ? Date.parse(data.expires_at) : Date.now() + 600_000
    session.view.message = session.challenge.type === 'auth'
      ? '请在弹窗中完成安全验证'
      : '请在弹窗中完成滑动验证'
    session.resultUrl = normalizeUrl(base, data.result_url)
    session.resultToken = data.result_token
    session.kind = data.kind
    session.intervalMs = Math.max(500, Number(data.poll_interval_ms) || 1000)
    logger.info(`[ICQQ Adapter] 账号 ${session.qq} 已创建${typeLabels[session.challenge.type]}会话`)
    schedule(session, session.intervalMs)
  } catch (error) {
    if (session.disposed || sessions.get(session.qq) !== session) return
    const message = errorMessage(error)
    session.view.status = 'error'
    session.view.message = /不支持此验证链接/.test(message)
      ? '过码服务不支持该验证链接，请打开官方验证页面完成验证'
      : message
    session.view.canRetry = true
    logger.error(`[ICQQ Adapter] 账号 ${session.qq} 创建验证会话失败: ${message}`)
  }
}

async function applySolved (session: VerificationSession, result: CaptchaResultResponse['result']): Promise<void> {
  if (session.disposed || sessions.get(session.qq) !== session) return
  const ticket = String(
    result?.nt_ticket ||
    [result?.ticket, result?.randstr].filter(Boolean).join(',')
  ).trim()

  if (!ticket) {
    session.view.status = 'error'
    session.view.message = '验证服务没有返回有效 ticket'
    session.view.canRetry = true
    return
  }

  session.view.status = 'submitting'
  session.view.message = '正在提交验证结果'

  try {
    await session.bot.super.submitSlider(ticket)
    session.view.status = 'solved'
    session.view.message = '验证已提交，正在等待登录结果'
    logger.info(`[ICQQ Adapter] 账号 ${session.qq} 已提交滑动验证`)
    scheduleCleanup(session)
  } catch (error) {
    session.view.status = 'error'
    session.view.message = errorMessage(error)
    session.view.canRetry = true
    logger.error(`[ICQQ Adapter] 账号 ${session.qq} 提交滑动验证失败`, error)
  }
}

async function applyApproved (session: VerificationSession): Promise<void> {
  if (session.disposed || sessions.get(session.qq) !== session) return
  session.view.status = 'approved'
  session.view.message = '验证已完成，正在重试登录'
  scheduleCleanup(session)

  try {
    await new Promise(resolve => setTimeout(resolve, 600))
    await session.bot.super.login()
    logger.info(`[ICQQ Adapter] 账号 ${session.qq} 已完成人工验证，已触发重新登录`)
  } catch (error) {
    session.view.status = 'error'
    session.view.message = errorMessage(error)
    session.view.canRetry = true
    logger.error(`[ICQQ Adapter] 账号 ${session.qq} 验证后重试登录失败`, error)
  }
}

async function pollSession (session: VerificationSession): Promise<void> {
  if (session.disposed || sessions.get(session.qq) !== session || !session.resultUrl || !session.resultToken) {
    return
  }

  try {
    const response = await axios.get<CaptchaResultResponse>(session.resultUrl, {
      headers: { Authorization: `Bearer ${session.resultToken}` },
      timeout: 10_000
    })
    if (session.disposed || sessions.get(session.qq) !== session) return

    const data = response.data
    session.pollFailures = 0

    switch (data.status) {
      case 'pending':
        schedule(session, session.intervalMs)
        return
      case 'solved':
        if (data.kind === 'approval') await applyApproved(session)
        else await applySolved(session, data.result)
        return
      case 'approved':
        await applyApproved(session)
        return
      case 'cancelled':
        session.view.status = 'cancelled'
        session.view.message = '验证已取消，可以重新发起验证'
        session.view.canRetry = true
        return
      case 'expired':
        session.view.status = 'expired'
        session.view.message = '验证会话已过期，请重新发起验证'
        session.view.canRetry = true
        return
      default:
        schedule(session, session.intervalMs)
        return
    }
  } catch (error) {
    if (session.disposed || sessions.get(session.qq) !== session) return
    session.pollFailures += 1
    if (session.pollFailures < MAX_POLL_FAILURES) {
      session.view.message = '查询验证结果失败，正在重试…'
      schedule(session, Math.max(1000, session.intervalMs))
      return
    }
    session.view.status = 'error'
    session.view.message = errorMessage(error)
    session.view.canRetry = true
    logger.error(`[ICQQ Adapter] 账号 ${session.qq} 查询验证结果失败`, error)
  }
}

/**
 * 开始一次人工验证会话
 * @param type 验证类型
 * @param url 本次登录返回的官方验证链接
 * @param bot 适配器实例
 * @param options 设备信息或手机号
 */
export function beginVerification (
  type: VerificationType,
  url: string,
  bot: AdapterICQQ,
  options: { deviceInfo?: Record<string, string>, phone?: string } = {}
): VerificationView {
  const qq = Number(bot.self_id)
  clearVerification(qq, true)

  const canSms = type === 'device' && Boolean(options.phone)
  const viaCaptcha = useCaptchaService(type)

  const session: VerificationSession = {
    qq,
    bot,
    challenge: {
      type,
      url,
      ...(options.deviceInfo ? { deviceInfo: options.deviceInfo } : {}),
      ...(options.phone ? { phone: options.phone } : {})
    },
    view: {
      id: `local-${randomUUID()}`,
      type,
      status: viaCaptcha ? 'creating' : 'pending',
      url: null,
      officialUrl: url,
      phone: options.phone || null,
      message: initialMessage(type, canSms),
      createdAt: Date.now(),
      expiresAt: null,
      canRetry: false,
      canSms
    },
    intervalMs: 1000,
    pollFailures: 0,
    disposed: false
  }

  sessions.set(qq, session)
  if (viaCaptcha) {
    void createSession(session)
  } else {
    logger.info(`[ICQQ Adapter] 账号 ${qq} 等待${typeLabels[type]}，${canSms ? '请使用短信验证码完成' : '请打开官方验证页面完成'}`)
  }
  return toView(session)
}

/** 使用原验证链接重新创建会话 */
export function renewVerification (qq: number): VerificationView {
  const session = sessions.get(qq)
  if (!session) throw new Error('当前没有待验证的登录会话')
  const bot = session.bot
  const challenge = { ...session.challenge }
  clearVerification(qq, true)
  return beginVerification(challenge.type, challenge.url, bot, {
    ...(challenge.deviceInfo ? { deviceInfo: challenge.deviceInfo } : {}),
    ...(challenge.phone ? { phone: challenge.phone } : {})
  })
}

/** 发送短信验证码 */
export async function sendSmsCode (qq: number): Promise<VerificationView> {
  const session = sessions.get(qq)
  if (!session) throw new Error('当前没有待验证的登录会话')
  if (session.challenge.type !== 'device') throw new Error('当前验证不需要短信验证码')
  if (!session.view.canSms) throw new Error('当前验证没有可用的密保手机，请打开官方验证页面完成')

  try {
    await session.bot.super.sendSmsCode()
    session.view.status = 'pending'
    session.view.message = session.view.phone
      ? `验证码已发送至密保手机 ${session.view.phone}，请查收后输入`
      : '短信验证码已发送，请查收后输入'
    session.view.canRetry = false
    return toView(session)
  } catch (error) {
    session.view.status = 'error'
    session.view.message = errorMessage(error)
    session.view.canRetry = true
    logger.error(`[ICQQ Adapter] 账号 ${qq} 发送短信验证码失败`, error)
    throw error
  }
}

/** 提交短信验证码 */
export async function submitSmsCode (qq: number, code: string): Promise<VerificationView> {
  const session = sessions.get(qq)
  if (!session) throw new Error('当前没有待验证的登录会话')
  if (session.challenge.type !== 'device') throw new Error('当前验证不需要短信验证码')
  const value = String(code).trim()
  if (!/^\d{6}$/.test(value)) throw new Error('请输入 6 位短信验证码')

  session.view.status = 'submitting'
  session.view.message = '正在提交短信验证码'
  try {
    await session.bot.super.submitSmsCode(value)
    session.view.message = '短信验证码已提交，正在等待登录结果'
    if (session.timer) {
      clearTimeout(session.timer)
      session.timer = undefined
    }
    scheduleCleanup(session)
    return toView(session)
  } catch (error) {
    session.view.status = 'error'
    session.view.message = errorMessage(error)
    session.view.canRetry = true
    throw error
  }
}

/** 登录错误时更新当前验证状态 */
export function markVerificationError (qq: number, message: string): void {
  const session = sessions.get(qq)
  if (!session) return
  if (['error', 'expired', 'cancelled'].includes(session.view.status)) return
  session.view.status = 'error'
  session.view.message = message || '登录验证失败'
  session.view.canRetry = true
  stopTimers(session)
}

/** 短信验证码错误，可以继续输入，需要保留验证会话 */
const SMS_RETRY_CODES = new Set([150022026])
const SMS_RETRY_PATTERN = /短信验证码|验证码错误|验证码不正确|SmsInvalid/i

/**
 * 登录流程抛出错误。
 * 短信验证码错误会保留验证会话，方便用户重新输入；其余错误说明本次登录流程已经结束，
 * 需要清理验证状态，让账号回到「异常」并在账号行保留错误原因。
 * @param qq QQ号
 * @param code 登录错误码
 * @param message 登录错误信息
 */
export function handleLoginError (qq: number, code: number, message: string): void {
  const session = sessions.get(qq)
  if (!session) return

  const retryable = session.challenge.type === 'device' &&
    session.view.canSms &&
    (SMS_RETRY_CODES.has(code) || SMS_RETRY_PATTERN.test(message))

  if (retryable) {
    markVerificationError(qq, message || '短信验证码错误，请重新输入')
    return
  }

  clearVerification(qq, true)
}
