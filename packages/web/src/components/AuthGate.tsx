import { Button, Card } from '@heroui/react'
import { ShieldAlert } from 'lucide-react'

interface AuthGateProps {
  open: boolean
}

export function AuthGate ({ open }: AuthGateProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-backdrop p-5 backdrop-blur-xl">
      <Card className="w-full max-w-sm border border-separator bg-surface shadow-overlay">
        <Card.Content className="flex flex-col items-center p-7 text-center">
          <span className="mb-4 grid size-14 place-items-center rounded-2xl border border-warning/25 bg-warning/10 text-warning">
            <ShieldAlert className="size-7" />
          </span>
          <h2 className="text-lg font-bold">登录状态已失效</h2>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            请在 Karin 控制台重新登录，然后刷新此页面。
          </p>
          <div className="mt-5 flex w-full gap-2">
            <Button variant="primary" className="flex-1" onPress={() => window.location.reload()}>
              刷新页面
            </Button>
            <Button
              variant="ghost"
              className="flex-1"
              onPress={() => {
                try {
                  window.top!.location.href = '/web'
                } catch {
                  window.location.href = '/web'
                }
              }}
            >
              前往 Karin
            </Button>
          </div>
        </Card.Content>
      </Card>
    </div>
  )
}
