import { cn } from './utils'

/** Table：shadcn 风格表格（吸顶表头 + 斑马纹可选 + 横向滚动容器） */
export function Table({ className, wrapperClassName, ...props }) {
  return (
    <div className={cn('cui-table-shell w-full', wrapperClassName)}>
      <table className={cn('cui-table w-full caption-bottom text-sm', className)} {...props} />
    </div>
  )
}

export function TableHeader({ className, ...props }) {
  return <thead className={cn('bg-surface-alt [&_tr]:border-b [&_tr]:border-line', className)} {...props} />
}

export function TableBody({ className, ...props }) {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />
}

export function TableRow({ className, ...props }) {
  return (
    <tr
      className={cn(
        'border-b border-line transition-colors duration-150 hover:bg-surface-alt/70 data-[state=selected]:bg-brand/5',
        className
      )}
      {...props}
    />
  )
}

export function TableHead({ className, ...props }) {
  return (
    <th
      className={cn(
        'h-10 whitespace-nowrap px-4 text-left align-middle text-xs font-medium text-body',
        className
      )}
      {...props}
    />
  )
}

export function TableCell({ className, ...props }) {
  return <td className={cn('px-4 py-3 align-middle text-[13px] text-ink', className)} {...props} />
}

export function TableCaption({ className, ...props }) {
  return <caption className={cn('mt-3 text-xs text-muted', className)} {...props} />
}

/** 表格空态（Table 内部使用，避免留白） */
export function TableEmpty({ colSpan, children = '暂无数据' }) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="py-12 text-center text-muted">
        {children}
      </TableCell>
    </TableRow>
  )
}

/** 加载骨架（表格形态） */
export function TableSkeleton({ rows = 5, cols = 4 }) {
  return Array.from({ length: rows }).map((_, r) => (
    <TableRow key={r} className="hover:bg-transparent">
      {Array.from({ length: cols }).map((__, c) => (
        <TableCell key={c}>
          <div className="h-4 w-full max-w-[140px] animate-pulse rounded bg-line/60" />
        </TableCell>
      ))}
    </TableRow>
  ))
}
