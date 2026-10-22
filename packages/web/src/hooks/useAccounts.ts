import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, UNAUTHORIZED_EVENT, fetchAccounts } from '../api'
import type { AccountsPayload } from '../types'

interface LoadOptions {
  silent?: boolean
}

/** 账号列表数据、轮询与登录态管理 */
export function useAccounts () {
  const [payload, setPayload] = useState<AccountsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [authRequired, setAuthRequired] = useState(false)
  const sequence = useRef(0)

  const load = useCallback(async (options: LoadOptions = {}) => {
    const current = ++sequence.current
    if (!options.silent) setRefreshing(true)

    try {
      const next = await fetchAccounts()
      if (current !== sequence.current) return
      setPayload(next)
      setError(null)
      setAuthRequired(false)
    } catch (err) {
      if (current !== sequence.current) return
      if (err instanceof ApiError && (err.status === 401 || err.status === 419)) {
        setAuthRequired(true)
        return
      }
      setError(err instanceof Error ? err.message : '读取账号配置失败')
    } finally {
      if (current === sequence.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [])

  const fastPoll = Boolean(
    payload?.list.some(item => item.runtime.status === 'starting' || Boolean(item.verification))
  )

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => {
      if (!document.hidden) void load({ silent: true })
    }, fastPoll ? 1500 : 12_000)

    const onVisible = (): void => {
      if (!document.hidden) void load({ silent: true })
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load, fastPoll])

  useEffect(() => {
    const onUnauthorized = (): void => setAuthRequired(true)
    const onStorage = (event: StorageEvent): void => {
      if (event.key === 'accessToken' || event.key === 'userId') {
        let token: string | null = null
        try {
          token = localStorage.getItem('accessToken')
        } catch {
          // 忽略 iframe 沙箱下的存储异常
        }
        if (token) {
          setAuthRequired(false)
          void load({ silent: true })
        } else {
          setAuthRequired(true)
        }
      }
    }

    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
      window.removeEventListener('storage', onStorage)
    }
  }, [load])

  return {
    payload,
    loading,
    refreshing,
    error,
    authRequired,
    reload: load
  }
}
