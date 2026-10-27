import { forwardRef } from 'react'
import { cn } from './utils'

/** Shared selected, keyboard focus and disabled states for card/chip choices. */
export const ChoiceButton = forwardRef(function ChoiceButton({ selected = false, className, ...props }, ref) {
  return <button ref={ref} type="button" aria-pressed={!!selected} data-selected={!!selected}
    className={cn('cui-choice', className)} {...props} />
})
