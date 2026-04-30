import { ReactNode } from 'react'
import { Button } from './Button'
import { Plus } from 'lucide-react'

interface Props {
  icon: ReactNode
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}

export function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="text-parchment/15 mb-4">{icon}</div>
      <p className="text-parchment/50 font-medium">{title}</p>
      {description && <p className="text-parchment/30 text-sm mt-1">{description}</p>}
      {action && (
        <Button size="sm" variant="ghost" className="mt-5" onClick={action.onClick}>
          <Plus size={14} /> {action.label}
        </Button>
      )}
    </div>
  )
}