import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '../../ui/button'
import { cn } from '../../ui/utils'

/**
 * 降级不退款提醒 + 强制阅读（业务规则）。
 *
 * 规则：升降级中的**降级**（目标配置低于当前配置）不产生退款项 ——
 * 后端询价的 `price_difference` 为负表示降级，`price` 已被 max(0,·) 归零（即不退钱）。
 * 所有可降级场景（弹性/套餐/IP数量/备份数量/IP防御）在识别到降级时必须：
 *   ① 醒目警示「降级不退款」；
 *   ② 强制 5 秒阅读倒计时，倒数结束前提交按钮不可点击。
 *
 * 判定：报价差额为负或目标配置低于当前配置，任一成立都显示提醒。
 */
export function useDowngradeGate(quote, fallbackIsDowngrade = false, selectionKey = '') {
  const [reading, setReading] = useState({ key: '', seconds: 5 })
  const priceDiff = quote?.price_difference !== undefined && quote?.price_difference !== null
    ? Number(quote.price_difference)
    : null
  // 原价折扣可能令差价归零，不能据此跳过实际降配的提醒。
  const isDowngrade = (priceDiff !== null && priceDiff < 0) || fallbackIsDowngrade
  const key = `${selectionKey}:${isDowngrade}`
  const seconds = reading.key === key ? reading.seconds : 5

  useEffect(() => {
    setReading({ key, seconds: 5 })
    if (!isDowngrade) return
    const t = window.setInterval(() => {
      setReading((value) => {
        if (value.key !== key) return value
        if (value.seconds <= 1) { window.clearInterval(t); return { key, seconds: 0 } }
        return { key, seconds: value.seconds - 1 }
      })
    }, 1000)
    return () => window.clearInterval(t)
  }, [isDowngrade, key])

  return { isDowngrade, readSeconds: seconds, locked: isDowngrade && seconds > 0 }
}

/** 降级醒目警示（强视觉）：实心警示头 + 大号"降级不退款" + 5 秒强制阅读 */
export function DowngradeNotice({ readSeconds, className }) {
  const locked = readSeconds > 0
  return (
    <div
      role="alert"
      className={cn('overflow-hidden rounded-lg border-2 border-danger', className)}
    >
      {/* 实心头部：最强视觉锚点 */}
      <div className="flex items-center gap-2 bg-danger px-3 py-2 text-white">
        <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
        <span className="text-sm font-bold tracking-wide">降级不退款</span>
        <span className="ml-auto rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-medium">
          {locked ? `请阅读 ${readSeconds}s` : '已确认'}
        </span>
      </div>
      {/* 正文：具体后果 */}
      <div className="space-y-1 bg-danger/8 px-3 py-2.5 text-xs leading-5 text-danger">
        <p className="font-semibold">
          本次为降配操作，<span className="underline decoration-2 underline-offset-2">已支付费用不予退还</span>，且不产生任何退款项。
        </p>
        <p className="text-danger/85">
          降配后多余资源将被释放，无法恢复；续费价格将按新配置重新计算。
          {locked ? <span className="ml-1 font-medium">（{readSeconds} 秒后可提交）</span> : null}
        </p>
      </div>
    </div>
  )
}

/** 提交按钮包装：降级未读满 5 秒时禁用并提示剩余秒数 */
export function DowngradeAwareSubmit({ locked, readSeconds, children, ...props }) {
  return (
    <Button {...props} disabled={props.disabled || locked} title={locked ? `请阅读降级不退款提示（${readSeconds}s）` : undefined}>
      {locked ? `请阅读 ${readSeconds}s` : children}
    </Button>
  )
}
