import type {
  AccountInput,
  AccountsPayload,
  MutationResult,
  RuntimeMutationResult,
  Verification
} from './types'

const API_BASE = '/icqq/api/v1'
const ACCESS_TOKEN_KEY = 'accessToken'
const USER_ID_KEY = 'userId'

/** 未授权事件名 */
export const UNAUTHORIZED_EVENT = 'icqq:unauthorized'

export class ApiError extends Error {
  status: number
  code?: number

  constructor (message: string, status = 0, code?: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
}

interface ApiResponse<T> {
  code: number
  data: T
  message: string
}

function readStorage (key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function authHeaders (): Record<string, string> {
  const headers: Record<string, string> = {}
  const token = readStorage(ACCESS_TOKEN_KEY)
  const userId = readStorage(USER_ID_KEY)

  if (token) headers.Authorization = `Bearer ${token}`
  if (userId) headers['x-user-id'] = userId

  return headers
}

async function request<T> (path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')

  for (const [key, value] of Object.entries(authHeaders())) {
    headers.set(key, value)
  }

  let body = options.body
  if (body !== undefined && body !== null && typeof body === 'object' && !(body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(body)
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      body: body as BodyInit | undefined,
      credentials: 'same-origin'
    })
  } catch (error) {
    throw new ApiError(error instanceof Error ? error.message : '无法连接到 Karin 服务', 0)
  }

  let payload: ApiResponse<T> | null = null
  try {
    payload = await response.json() as ApiResponse<T>
  } catch {
    // 非 JSON 响应交给下方状态码处理
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 419) {
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT))
    }
    throw new ApiError(payload?.message || `请求失败 (${response.status})`, response.status, payload?.code)
  }

  if (!payload) {
    throw new ApiError('Karin 返回了无法解析的响应', response.status)
  }

  return payload.data
}

/** 获取账号列表 */
export function fetchAccounts (): Promise<AccountsPayload> {
  return request<AccountsPayload>('/accounts', { method: 'GET' })
}

/** 保存全局配置 */
export function saveGlobalConfig (signApiAddr: string, captchaApi: string): Promise<{ message: string }> {
  return request<{ message: string }>('/config', {
    method: 'POST',
    body: { signApiAddr, captchaApi }
  })
}

/** 创建账号 */
export function createAccount (input: AccountInput): Promise<MutationResult> {
  return request<MutationResult>('/accounts/create', {
    method: 'POST',
    body: input
  })
}

/** 更新账号 */
export function updateAccount (input: AccountInput): Promise<MutationResult> {
  return request<MutationResult>('/accounts/update', {
    method: 'POST',
    body: input
  })
}

/** 删除账号 */
export function deleteAccount (qq: number): Promise<MutationResult> {
  return request<MutationResult>('/accounts/delete', {
    method: 'POST',
    body: { qq }
  })
}

/** 上线账号 */
export function onlineAccount (qq: number): Promise<RuntimeMutationResult> {
  return request<RuntimeMutationResult>('/accounts/online', {
    method: 'POST',
    body: { qq }
  })
}

/** 下线账号 */
export function offlineAccount (qq: number): Promise<RuntimeMutationResult> {
  return request<RuntimeMutationResult>('/accounts/offline', {
    method: 'POST',
    body: { qq }
  })
}

/** 重新发起当前账号的登录验证 */
export function renewVerification (qq: number): Promise<Verification> {
  return request<Verification>('/accounts/verification/renew', {
    method: 'POST',
    body: { qq }
  })
}

/** 发送短信验证码 */
export function sendVerificationSms (qq: number): Promise<Verification> {
  return request<Verification>('/accounts/verification/sms/send', {
    method: 'POST',
    body: { qq }
  })
}

/** 提交短信验证码 */
export function submitVerificationSms (qq: number, code: string): Promise<Verification> {
  return request<Verification>('/accounts/verification/sms/submit', {
    method: 'POST',
    body: { qq, code }
  })
}
