import path from 'node:path'
import { existsSync } from 'node:fs'
import {
  app,
  authMiddleware,
  createBadRequestResponse,
  createNotFoundResponse,
  createServerErrorResponse,
  createSuccessResponse,
  logger
} from 'node-karin'
import express from 'node-karin/express'
import type { NextFunction, Request, Response } from 'node-karin/express'
import { Root } from '@/common/Root'
import { getIcqqVersion } from '@/core/version'
import { getAccountRuntime, startAccount, stopAccount } from '@/core/runtime'
import { renewVerification, sendSmsCode, submitSmsCode } from '@/core/verification'
import {
  applyAccount,
  createAccount,
  deleteAccount,
  findAccount,
  getAccountsPayload,
  parseQQ,
  updateAccount,
  updateGlobalConfig
} from './accounts'

export const API_PREFIX = '/icqq/api/v1'
export const WEB_PREFIX = '/icqq/web'

let initialized = false

/** 串行化配置写入，避免并发请求互相覆盖 */
let queue: Promise<unknown> = Promise.resolve()
function serialize<T> (task: () => Promise<T> | T): Promise<T> {
  const result = queue.then(task, task)
  queue = result.then(() => undefined, () => undefined)
  return result
}

type AsyncHandler = (req: Request, res: Response) => Promise<void> | void

const handle = (fn: AsyncHandler) => {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      await fn(req, res)
    } catch (error) {
      logger.error('[ICQQ Adapter] API 请求处理失败', error)
      if (!res.headersSent) {
        createServerErrorResponse(res, error instanceof Error ? error.message : '服务器内部错误')
      }
    }
  }
}

/** 注册 ICQQ 账号管理 API 与 Web 页面 */
export function initServer (): void {
  if (initialized) return
  initialized = true

  const router = express.Router()

  router.use(express.json({ limit: '256kb' }))
  router.use(authMiddleware)

  router.get('/', (_req, res) => {
    createSuccessResponse(res, {
      name: 'ICQQ Adapter Account API',
      version: getIcqqVersion(),
      web: WEB_PREFIX
    })
  })

  router.get('/accounts', (_req, res) => {
    createSuccessResponse(res, getAccountsPayload())
  })

  router.post('/config', handle(async (req, res) => {
    const result = await serialize(() => updateGlobalConfig(req.body))
    if ('error' in result) {
      createBadRequestResponse(res, result.error)
      return
    }
    createSuccessResponse(res, result, result.message)
  }))

  router.post('/accounts/create', handle(async (req, res) => {
    const result = await serialize(async () => {
      const created = createAccount(req.body)
      if ('error' in created) return created
      await applyAccount(created.account, '新建账号')
      return created
    })

    if ('error' in result) {
      createBadRequestResponse(res, result.error)
      return
    }

    const payload = getAccountsPayload()
    createSuccessResponse(res, {
      account: payload.list.find(item => item.qq === result.account.qq),
      ...payload
    }, `账号 ${result.account.qq} 已创建，正在登录`)
  }))

  router.post('/accounts/update', handle(async (req, res) => {
    const result = await serialize(async () => {
      const updated = updateAccount(req.body)
      if ('error' in updated) return updated
      await applyAccount(updated.account)
      return updated
    })

    if ('error' in result) {
      createBadRequestResponse(res, result.error)
      return
    }

    const payload = getAccountsPayload()
    createSuccessResponse(res, {
      account: payload.list.find(item => item.qq === result.account.qq),
      ...payload
    }, `账号 ${result.account.qq} 配置已更新`)
  }))

  router.post('/accounts/delete', handle(async (req, res) => {
    const result = await serialize(async () => {
      const removed = deleteAccount(req.body)
      if ('error' in removed) return removed
      await stopAccount(removed.account.qq, '删除账号')
      return removed
    })

    if ('error' in result) {
      createBadRequestResponse(res, result.error)
      return
    }

    createSuccessResponse(res, {
      qq: result.account.qq,
      ...getAccountsPayload()
    }, `账号 ${result.account.qq} 已删除`)
  }))

  router.post('/accounts/online', handle(async (req, res) => {
    const account = findAccount(req.body)
    if (!account) {
      createNotFoundResponse(res, '账号不存在')
      return
    }
    if (account.enable === false) {
      createBadRequestResponse(res, '该账号已停用，请先启用账号')
      return
    }

    const config = getAccountsPayload()
    const current = getAccountRuntime(account.qq)
    if (current.status === 'offline' || current.status === 'error') {
      await stopAccount(account.qq, '重新登录')
    }
    const info = startAccount(account, getIcqqVersion(), config.signApiAddr)
    createSuccessResponse(res, info, `账号 ${account.qq} 正在登录`)
  }))

  router.post('/accounts/offline', handle(async (req, res) => {
    const account = findAccount(req.body)
    if (!account) {
      createNotFoundResponse(res, '账号不存在')
      return
    }

    const stopped = await stopAccount(account.qq, '手动下线')
    if (!stopped) {
      createBadRequestResponse(res, '该账号当前未运行')
      return
    }

    createSuccessResponse(res, {
      qq: account.qq,
      status: 'offline'
    }, `账号 ${account.qq} 已下线`)
  }))

  router.post('/accounts/verification/renew', handle(async (req, res) => {
    const qq = parseQQ((req.body as { qq?: unknown })?.qq)
    if (!qq) {
      createBadRequestResponse(res, '缺少要验证的 QQ 号')
      return
    }

    try {
      const verification = renewVerification(qq)
      createSuccessResponse(res, verification, '已重新发起验证')
    } catch (error) {
      createBadRequestResponse(res, error instanceof Error ? error.message : '重新发起验证失败')
    }
  }))

  router.post('/accounts/verification/sms/send', handle(async (req, res) => {
    const qq = parseQQ((req.body as { qq?: unknown })?.qq)
    if (!qq) {
      createBadRequestResponse(res, '缺少要验证的 QQ 号')
      return
    }

    try {
      const verification = await sendSmsCode(qq)
      createSuccessResponse(res, verification, '短信验证码已发送')
    } catch (error) {
      createBadRequestResponse(res, error instanceof Error ? error.message : '发送短信验证码失败')
    }
  }))

  router.post('/accounts/verification/sms/submit', handle(async (req, res) => {
    const body = req.body as { qq?: unknown, code?: unknown }
    const qq = parseQQ(body?.qq)
    const code = typeof body?.code === 'string' || typeof body?.code === 'number' ? String(body.code).trim() : ''
    if (!qq) {
      createBadRequestResponse(res, '缺少要验证的 QQ 号')
      return
    }
    if (!/^\d{6}$/.test(code)) {
      createBadRequestResponse(res, '请输入 6 位短信验证码')
      return
    }

    try {
      const verification = await submitSmsCode(qq, code)
      createSuccessResponse(res, verification, '短信验证码已提交')
    } catch (error) {
      createBadRequestResponse(res, error instanceof Error ? error.message : '提交短信验证码失败')
    }
  }))

  router.use((error: Error & { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('[ICQQ Adapter] API 未捕获异常', error)
    if (res.headersSent) return
    if (error instanceof SyntaxError) {
      createBadRequestResponse(res, '请求 JSON 格式错误')
      return
    }
    createServerErrorResponse(res, error.message || '服务器内部错误')
  })

  app.use(API_PREFIX, router)

  const webDir = path.join(Root.pluginPath, 'web')
  const indexFile = path.join(webDir, 'index.html')

  const sendIndex = (_req: Request, res: Response): void => {
    if (!existsSync(indexFile)) {
      res.status(503).type('html').send(
        '<!doctype html><meta charset="utf-8"><title>ICQQ Web 未构建</title>' +
        '<body style="font:15px/1.7 system-ui;padding:48px;color:#e5e7eb;background:#0b0d12">' +
        '<h1>ICQQ 账号管理页面尚未构建</h1>' +
        '<p>请在插件仓库执行 <code>pnpm build</code> 后重启 Karin。</p>' +
        '</body>'
      )
      return
    }
    res.sendFile(indexFile)
  }

  app.get(WEB_PREFIX, sendIndex)
  app.get(`${WEB_PREFIX}/`, sendIndex)
  app.use(WEB_PREFIX, express.static(webDir, {
    index: 'index.html',
    etag: true,
    maxAge: 0,
    fallthrough: true
  }))

  logger.info(`[ICQQ Adapter] 账号管理 API: ${API_PREFIX}`)
  logger.info(`[ICQQ Adapter] 账号管理页面: ${WEB_PREFIX}`)
}
