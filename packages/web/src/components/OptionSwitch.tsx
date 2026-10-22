import { Switch } from '@heroui/react'

interface OptionSwitchProps {
  isSelected: boolean
  title: string
  description: string
  onChange: (value: boolean) => void
}

export function OptionSwitch ({ isSelected, title, description, onChange }: OptionSwitchProps) {
  return (
    <Switch isSelected={isSelected} onChange={onChange} size="sm" className="px-4 py-3">
      <Switch.Content className="flex w-full items-center gap-3">
        <Switch.Control><Switch.Thumb /></Switch.Control>
        <span className="flex min-w-0 flex-col gap-0.5 text-left">
          <span className="text-xs font-medium">{title}</span>
          <span className="text-[10px] leading-relaxed text-muted">{description}</span>
        </span>
      </Switch.Content>
    </Switch>
  )
}
