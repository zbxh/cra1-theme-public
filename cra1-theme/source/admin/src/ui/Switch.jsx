import { cn } from '@ui/utils'

/** Shared accessible switch: 36x20 / 44x24 visual track inside >=24px hit area. */
export default function SwitchControl({
  checked,
  onCheckedChange,
  label,
  size = 'md',
  className,
  disabled = false,
  ...props
}) {
  const small = size === 'sm'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked ? 'true' : 'false'}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        'disabled:pointer-events-none disabled:opacity-50',
        small ? 'h-6 w-10' : 'h-7 w-12',
        className,
      )}
      {...props}
    >
      <span
        data-switch-track
        aria-hidden="true"
        className={cn(
          'pointer-events-none relative inline-flex shrink-0 rounded-full transition-colors duration-150',
          small ? 'h-5 w-9' : 'h-6 w-11',
          checked ? 'bg-brand' : 'bg-line',
        )}
      >
        <span
          data-switch-thumb
          className={cn(
            'pointer-events-none absolute left-0.5 top-0.5 rounded-full bg-white shadow transition-transform duration-150',
            small ? 'size-4' : 'size-5',
            checked && (small ? 'translate-x-4' : 'translate-x-5'),
          )}
        />
      </span>
    </button>
  )
}
