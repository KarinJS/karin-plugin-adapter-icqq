import { useState } from 'react'
import { Button, InputGroup } from '@heroui/react'
import { Eye, EyeOff, Link2 } from 'lucide-react'

interface SensitiveInputProps {
  value: string
  onChange: (value: string) => void
  ariaLabel: string
  placeholder?: string
  withLinkIcon?: boolean
}

/**
 * 默认隐藏内容的输入框，用户点击眼睛按钮后才显示完整值。
 * 用于签名服务器地址等不便出现在截图中的配置。
 */
export function SensitiveInput ({
  value,
  onChange,
  ariaLabel,
  placeholder,
  withLinkIcon = true
}: SensitiveInputProps) {
  const [visible, setVisible] = useState(false)

  return (
    <InputGroup className="min-w-0">
      {withLinkIcon && (
        <InputGroup.Prefix>
          <Link2 className="size-4 text-muted" />
        </InputGroup.Prefix>
      )}
      <InputGroup.Input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoComplete="off"
        spellCheck={false}
        className="min-w-0"
      />
      <InputGroup.Suffix>
        <Button
          isIconOnly
          size="sm"
          type="button"
          variant="ghost"
          aria-label={visible ? '隐藏完整地址' : '显示完整地址'}
          onPress={() => setVisible(current => !current)}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </Button>
      </InputGroup.Suffix>
    </InputGroup>
  )
}
