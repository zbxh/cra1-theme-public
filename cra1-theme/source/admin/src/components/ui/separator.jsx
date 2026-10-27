import * as SeparatorPrimitive from '@radix-ui/react-separator'
import { cn } from './utils'

export function Separator({ className, orientation = 'horizontal', decorative = true, ...props }) {
  return (
    <SeparatorPrimitive.Root
      decorative={decorative}
      orientation={orientation}
      className={cn(
        'shrink-0 bg-line',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-4 w-px',
        className
      )}
      {...props}
    />
  )
}
