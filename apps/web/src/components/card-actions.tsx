import { Pencil, Trash2 } from 'lucide-react'
import { type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

// Unified card actions, top-right corner. Edit/Delete fade in on hover or
// keyboard focus of the parent card (which must be `group relative`).
// Delete asks for confirmation. `trailing` holds always-visible controls
// (e.g. a favourite star).
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
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t('common.delete')}
              >
                <Trash2 />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {t('common.deleteConfirmTitle')}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t('common.deleteConfirmText')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete}>
                  {t('common.delete')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </span>
      {trailing}
    </div>
  )
}
