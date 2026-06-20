import { Pencil, Trash2 } from 'lucide-react'
import { type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

// Unified card actions, top-right corner. Edit/Delete fade in on hover or
// keyboard focus of the parent card (which must be `group relative`).
// `trailing` holds always-visible controls (e.g. a favourite star).
export function CardActions({
  onEdit,
  onDelete,
  trailing,
}: {
  onEdit?: () => void
  onDelete?: () => void
  trailing?: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <div className="absolute top-2 right-2 flex items-center gap-0.5">
      <span className="flex gap-0.5 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100">
        {onEdit && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('common.edit')}
            onClick={onEdit}
          >
            <Pencil />
          </Button>
        )}
        {onDelete && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('common.delete')}
            onClick={onDelete}
          >
            <Trash2 />
          </Button>
        )}
      </span>
      {trailing}
    </div>
  )
}
