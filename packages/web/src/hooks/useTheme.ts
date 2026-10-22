import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

function resolveTheme (): Theme {
  try {
    const stored = localStorage.getItem('theme')
    if (stored === 'dark' || stored === 'light') return stored
  } catch {
    // localStorage 可能被 iframe 沙箱禁用
  }
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function applyTheme (theme: Theme): void {
  document.documentElement.dataset.theme = theme
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#070a12' : '#f2f6ff')
}

/**
 * 跟随 Karin WebUI 的主题设置。
 * 页面不再自己提供主题切换按钮，只响应 Karin 的 theme 变化。
 */
export function useKarinTheme (): void {
  const [theme, setTheme] = useState<Theme>(resolveTheme)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    const onStorage = (event: StorageEvent): void => {
      if (event.key === 'theme') setTheme(resolveTheme())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])
}
