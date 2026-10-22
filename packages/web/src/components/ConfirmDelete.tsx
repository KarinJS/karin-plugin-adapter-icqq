import { useState } from 'react'
import { AlertDialog, Button, Spinner, toast } from '@heroui/react'
import { Trash2 } from 'lucide-react'
import type { Account } from '../types'

interface ConfirmDeleteProps {
  account: Account | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (account: Account) => Promise<void>
}

export function ConfirmDelete ({ account, open, onOpenChange, onConfirm }: ConfirmDeleteProps) {
  const [deleting, setDeleting] = useState(false)

  const confirm = async (): Promise<void> => {
    if (!account) return
    setDeleting(true)
    try {
      await onConfirm(account)
      onOpenChange(false)
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : '删除账号失败')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AlertDialog isOpen={open} onOpenChange={onOpenChange}>
      <AlertDialog.Backdrop>
        <AlertDialog.Container size="sm">
          <AlertDialog.Dialog>
            <AlertDialog.Header className="flex flex-col items-center gap-3 px-6 pt-7 text-center">
              <AlertDialog.Icon status="danger">
                <Trash2 className="size-6" />
              </AlertDialog.Icon>
              <AlertDialog.Heading className="text-lg font-bold">删除账号</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body className="px-6 pb-5 text-center">
              <p className="text-xs leading-relaxed text-muted">
                配置会从插件配置中移除，运行中的账号会被下线，此操作无法恢复。
              </p>
              <code className="mt-3 inline-flex rounded-lg border border-separator bg-field px-3 py-1.5 font-mono text-sm text-foreground">
                {account?.qq ?? '—'}
              </code>
            </AlertDialog.Body>
            <AlertDialog.Footer className="flex justify-center gap-2 border-t border-separator p-4">
              <Button variant="ghost" isDisabled={deleting} onPress={() => onOpenChange(false)}>
                取消
              </Button>
              <Button variant="danger" isDisabled={deleting} onPress={confirm}>
                {deleting ? <Spinner size="sm" color="current" /> : null}
                确认删除
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  )
}
