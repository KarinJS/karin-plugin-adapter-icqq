import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Button, Card, InputGroup, Spinner, toast } from '@heroui/react'
import { Globe2, Settings2 } from 'lucide-react'
import { SensitiveInput } from './SensitiveInput'

interface GlobalConfigCardProps {
  signApiAddr: string
  captchaApi: string
  onSave: (signApiAddr: string, captchaApi: string) => Promise<void>
}

function isHttpUrl (value: string): boolean {
  if (!value) return true
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/** 过码服务地址必须是兼容 icqq.qwqo.cn API 的根地址 */
function isCaptchaApi (value: string): boolean {
  if (!value) return true
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:') &&
      !url.username &&
      !url.password &&
      url.pathname === '/' &&
      !url.search &&
      !url.hash
  } catch {
    return false
  }
}

export function GlobalConfigCard ({ signApiAddr, captchaApi, onSave }: GlobalConfigCardProps) {
  const [signApi, setSignApi] = useState(signApiAddr)
  const [captcha, setCaptcha] = useState(captchaApi)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setSignApi(signApiAddr)
  }, [signApiAddr])

  useEffect(() => {
    setCaptcha(captchaApi)
  }, [captchaApi])

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (!isHttpUrl(signApi.trim())) {
      toast.danger('签名服务器地址格式不正确')
      return
    }
    if (!isCaptchaApi(captcha.trim())) {
      toast.danger('过码服务地址必须是不含子路径的 http(s) 根地址')
      return
    }

    setSaving(true)
    try {
      await onSave(signApi.trim(), captcha.trim())
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="gap-0 border border-separator bg-surface/70 p-0 shadow-none backdrop-blur-xl">
      <Card.Header className="flex flex-row items-center gap-3 border-b border-separator p-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-accent/20 bg-accent/10 text-accent">
          <Settings2 className="size-5" />
        </span>
        <div className="min-w-0">
          <Card.Title className="text-sm font-semibold">全局配置</Card.Title>
          <Card.Description className="mt-0.5 text-xs">
            签名服务器与人工过码服务。未单独配置签名地址的账号会跟随这里的设置。
          </Card.Description>
        </div>
      </Card.Header>

      <Card.Content className="p-5">
        <form className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end" onSubmit={submit}>
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="text-xs font-medium">签名服务器地址</span>
            <SensitiveInput
              value={signApi}
              onChange={setSignApi}
              ariaLabel="全局签名服务器地址，默认隐藏"
              placeholder="https://sign.example.com，留空使用 icqq 默认值"
            />
            <span className="text-[11px] text-muted">
              地址默认隐藏，点击眼睛图标显示完整内容；保存后对账号下次登录生效。
            </span>
          </label>

          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="text-xs font-medium">过码服务地址</span>
            <InputGroup className="min-w-0">
              <InputGroup.Prefix>
                <Globe2 className="size-4 text-muted" />
              </InputGroup.Prefix>
              <InputGroup.Input
                value={captcha}
                onChange={event => setCaptcha(event.target.value)}
                placeholder="https://icqq.qwqo.cn"
                aria-label="人工过码服务地址"
                spellCheck={false}
                autoComplete="off"
                className="min-w-0"
              />
            </InputGroup>
            <span className="text-[11px] text-muted">
              仅支持兼容 icqq.qwqo.cn API 的 http(s) 根地址，不支持子路径；留空恢复默认。
            </span>
          </label>

          <Button type="submit" variant="primary" isDisabled={saving} className="w-full shrink-0 lg:w-auto">
            {saving ? <Spinner size="sm" color="current" /> : null}
            保存配置
          </Button>
        </form>
      </Card.Content>
    </Card>
  )
}
