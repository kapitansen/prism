import { cn } from '@/lib/utils'

export interface ChipOption<T extends string | number> {
  value: T
  label: string
  // Optional per-chip styling (e.g. the metric colour ramp). When set, these
  // override the default look for that chip.
  className?: string // applied when not selected
  selectedClassName?: string // applied when selected
}

interface ChipGroupProps<T extends string | number> {
  options: ChipOption<T>[]
  value: T | null
  onChange: (value: T) => void
  ariaLabel?: string
  size?: 'sm' | 'md'
}

// Segmented single-select control: one bordered frame, chips behave as radios.
// Reused for any small fixed scale (metric chips, card conviction).
export function ChipGroup<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
  size = 'md',
}: ChipGroupProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex rounded-lg border',
        size === 'sm' ? 'gap-0.5 p-0.5' : 'gap-1 p-1',
      )}
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
              'rounded-md font-medium transition',
              size === 'sm'
                ? 'size-7 text-xs'
                : 'min-w-9 px-3 py-1.5 text-sm',
              selected
                ? (opt.selectedClassName ?? 'bg-primary text-primary-foreground')
                : (opt.className ?? 'text-muted-foreground hover:bg-muted'),
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
