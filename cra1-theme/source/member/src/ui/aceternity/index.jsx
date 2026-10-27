import { memo, useCallback, useRef, useState, useEffect } from 'react'
import { motion, useMotionValue, useSpring, useReducedMotion } from 'framer-motion'
import { cn } from '../utils'

/**
 * Aceternity 浅色改良原语集（借鉴 ui.aceternity.com 的排版与光效手法，
 * 不引入其框架；配色全部走 @theme 令牌，遵守主题硬性标准 §8：
 * hover 不做按钮上浮、动效只碰 transform/opacity、reduced-motion 降级）。
 */

/**
 * SpotlightCard：鼠标跟随径向光斑卡（aceternity spotlight 的浅色版）。
 * mousemove 把光标写进 CSS 变量 --sx/--sy，光斑层用 radial-gradient 跟随；
 * 离开时光斑淡出。光斑是独立绝对定位层，不触碰 cra1-shell.css 的白底覆盖。
 */
export function SpotlightCard({ className, children, as: Tag = 'div', ...props }) {
  const ref = useRef(null)
  const [on, setOn] = useState(false)

  const onMove = useCallback((e) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--sx', `${e.clientX - r.left}px`)
    el.style.setProperty('--sy', `${e.clientY - r.top}px`)
  }, [])

  return (
    <Tag
      ref={ref}
      onMouseMove={onMove}
      onMouseEnter={() => setOn(true)}
      onMouseLeave={() => setOn(false)}
      className={cn('group/spot relative overflow-hidden rounded-lg border border-line bg-surface', className)}
      {...props}
    >
      {/* 聚光灯光斑：仅 hover 存在；尺寸足够大以覆盖边缘 */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: on ? 1 : 0,
          background:
            'radial-gradient(340px circle at var(--sx, 50%) var(--sy, 50%), color-mix(in srgb,var(--cui-titanium) 8.0%,transparent), transparent 65%)',
        }}
      />
      {/* 光斑处的边框提亮（aceternity 的 border spotlight） */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-lg transition-opacity duration-300"
        style={{
          opacity: on ? 1 : 0,
          background:
            'radial-gradient(220px circle at var(--sx, 50%) var(--sy, 50%), color-mix(in srgb,var(--cui-titanium) 25.0%,transparent), transparent 60%)',
          maskImage: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          maskComposite: 'exclude',
          WebkitMaskImage: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          padding: '1px',
        }}
      />
      {children}
    </Tag>
  )
}

/**
 * BorderBeam：conic-gradient 流光沿 1px 边框旋转（aceternity animated border 的浅色版）。
 * 放进 relative overflow-hidden 的容器内使用；两层错相形成彗尾。
 */
export function BorderBeam({ size = 64, duration = 6, delay = 0, reverse }) {
  const reduce = useReducedMotion()
  if (reduce) return null
  return (
    <>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit] border border-transparent"
        style={{
          maskImage: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          maskComposite: 'exclude',
          WebkitMaskImage: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
        }}
      >
        <motion.span
          className="absolute inset-0"
          style={{
            background: `conic-gradient(from ${reverse ? '180deg' : '0deg'}, transparent 0%, color-mix(in srgb,var(--cui-titanium) 0.0%,transparent) 0.02%, color-mix(in srgb,var(--cui-titanium) 85.0%,transparent) 0.12%, color-mix(in srgb,var(--cui-steel) 50.0%,transparent) 0.18%, transparent 28%)`,
            animation: `beam-spin ${duration}s linear infinite`,
            animationDelay: `${delay}s`,
          }}
        />
      </span>
    </>
  )
}

/**
 * HeroGridBg：英雄区淡网格 + 缓慢漂移的品牌色雾气（网格是 aceternity grid
 * pattern 的浅色版；雾气复用登录页 auth-fog 的语言——必须真的在动，§8.2）。
 */
export function HeroGridBg() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <span
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(29,33,41,0.045) 1px, transparent 1px),' +
            'linear-gradient(to bottom, rgba(29,33,41,0.045) 1px, transparent 1px)',
          backgroundSize: '36px 36px',
          maskImage: 'radial-gradient(80% 90% at 60% 10%, #fff 30%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(80% 90% at 60% 10%, #fff 30%, transparent 100%)',
        }}
      />
      <span
        className="absolute -top-24 left-[8%] h-64 w-[42rem] rounded-full opacity-70"
        style={{
          background:
            'radial-gradient(closest-side, color-mix(in srgb,var(--cui-titanium) 14.0%,transparent), transparent 72%)',
          filter: 'blur(28px)',
          animation: 'fog-drift-a 13s ease-in-out infinite alternate',
        }}
      />
      <span
        className="absolute -bottom-28 right-[4%] h-56 w-[36rem] rounded-full opacity-60"
        style={{
          background:
            'radial-gradient(closest-side, color-mix(in srgb,var(--cui-steel) 12.0%,transparent), transparent 72%)',
          filter: 'blur(30px)',
          animation: 'fog-drift-b 16s ease-in-out infinite alternate',
        }}
      />
    </span>
  )
}

/** 状态灯：呼吸脉冲点（电源状态可视化，reduced-motion 时静态） */
export function PulseDot({ tone = 'success', className }) {
  const reduce = useReducedMotion()
  const color = { success: 'var(--color-success)', danger: 'var(--color-danger)', warning: 'var(--color-warning)', muted: 'var(--color-muted)' }[tone] || 'var(--color-success)'
  return (
    <span className={cn('relative inline-flex size-2', className)}>
      {!reduce && (
        <span
          className="absolute inline-flex size-full rounded-full opacity-60"
          style={{ background: color, animation: 'dot-pulse 2.2s cubic-bezier(0.4,0,0.6,1) infinite' }}
        />
      )}
      <span className="relative inline-flex size-2 rounded-full" style={{ background: color }} />
    </span>
  )
}

/**
 * NumberTicker：数字滚动（aceternity number ticker）。用 framer-motion spring
 * 驱动整数/小数滚动；reduced-motion 或首次渲染直接显示终值。
 */
export const NumberTicker = memo(function NumberTicker({ value, decimals = 0, className, suffix, prefix }) {
  const reduce = useReducedMotion()
  const [display, setDisplay] = useState(value)
  const mv = useMotionValue(0)
  const spring = useSpring(mv, { stiffness: 90, damping: 24 })

  useEffect(() => {
    if (reduce) {
      setDisplay(value)
      return
    }
    mv.set(value)
  }, [value, reduce, mv])

  useEffect(() => {
    if (reduce) return
    const unsub = spring.on('change', (v) => setDisplay(v))
    return unsub
  }, [spring, reduce])

  const text = Number(display).toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  return (
    <span className={cn('tabular-nums', className)}>
      {prefix}
      {text}
      {suffix}
    </span>
  )
})

/**
 * BentoGrid：非对称 bento 网格容器。默认 12 列（lg）/6 列（sm）/1 列（移动），
 * 子项用 colSpan/rowSpan 自由拼装（§8.1 禁止四格完全对称）。
 * 进场动画：整组 stagger 上浮淡入（transform/opacity only）。
 */
export function BentoGrid({ className, children, stagger = 0.045 }) {
  const reduce = useReducedMotion()
  const container = {
    hidden: {},
    show: { transition: { staggerChildren: reduce ? 0 : stagger } },
  }
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className={cn(
        'grid grid-cols-1 gap-4 sm:grid-cols-6 lg:grid-cols-12',
        className
      )}
    >
      {children}
    </motion.div>
  )
}

/** BentoCell：默认占满当前网格，断点跨列由调用方覆盖。 */
export function BentoCell({ className, colSpan, children, ...props }) {
  const reduce = useReducedMotion()
  const item = {
    hidden: { opacity: 0, y: reduce ? 0 : 14 },
    show: { opacity: 1, y: 0, transition: { duration: 0.34, ease: [0.23, 1, 0.32, 1] } },
  }
  return (
    <motion.div
      variants={item}
      className={cn('col-span-full min-w-0', colSpan, className)}
      {...props}
    >
      {children}
    </motion.div>
  )
}
