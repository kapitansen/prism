import { cn } from '@/lib/utils'

export interface ChipOption<T extends string | number> {
  value: T
  label: string
}

interface ChipGroupProps<T extends string | number> {
  options: ChipOption<T>[]
  value: T | null
  onChange: (value: T) => void
  ariaLabel?: string
}

// Segmented single-select control: one bordered frame, chips behave as radios.
// Reused for any small fixed scale (conviction, and later the metric chips).
export function ChipGroup<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
}: ChipGroupProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex gap-1 rounded-lg border p-1"
    >
      {options.map((opt) => {
        const selected = opt.value === value
        return (
          <button
            key={String(opt.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={cn(
              'min-w-9 rounded-md px-3 py-1.5 text-sm font-medium transition',
              selected
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
