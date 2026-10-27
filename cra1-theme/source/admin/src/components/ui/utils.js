import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** shadcn 约定：合并 Tailwind 类名，后者覆盖前者的冲突项 */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
