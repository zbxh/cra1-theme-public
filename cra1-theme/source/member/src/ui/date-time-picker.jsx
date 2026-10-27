import { forwardRef, useId, useLayoutEffect, useRef, useState } from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { CalendarClock, ChevronLeft, ChevronRight } from 'lucide-react'
import { Select } from './select'
import { Button } from './button'
import { cn } from './utils'
import { calendarDays, formatLocalDateTime, moveCalendarDate, parseLocalDateTime } from './date-time'

function nowValue() {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate(), hour: now.getHours(), minute: now.getMinutes() }
}
const sameDay = (a, b) => a.year === b.year && a.month === b.month && a.day === b.day

/** A local-time picker with its own cancellable draft and themed calendar. */
export const DateTimePicker = forwardRef(function DateTimePicker({
  value = '', onChange, className, disabled, name, id, placeholder = '请选择日期和时间', ...props
}, ref) {
  const titleId = useId()
  const grid = useRef(null)
  const pendingFocus = useRef(false)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(() => parseLocalDateTime(value) || nowValue())
  const [view, setView] = useState({ year: draft.year, month: draft.month })
  const [focusDay, setFocusDay] = useState(draft)
  useLayoutEffect(() => {
    if (!pendingFocus.current) return
    grid.current?.querySelector(`[data-date="${focusDay.year}-${focusDay.month}-${focusDay.day}"]`)?.focus()
    pendingFocus.current = false
  }, [focusDay])
  const committed = parseLocalDateTime(value)
  const days = calendarDays(view.year, view.month)
  const currentYear = new Date().getFullYear()
  const firstYear = Math.min(currentYear - 100, view.year)
  const lastYear = Math.max(currentYear + 20, view.year)
  const changeOpen = (next) => {
    if (next) {
      const initial = parseLocalDateTime(value) || nowValue()
      setDraft(initial); setView({ year: initial.year, month: initial.month }); setFocusDay(initial)
    }
    setOpen(next)
  }
  const update = (next) => {
    const target = { value: next, name }
    onChange?.({ target, currentTarget: target, type: 'change' })
    setOpen(false)
  }
  const changeMonth = (amount) => {
    const date = new Date(view.year, view.month - 1 + amount, 1)
    const next = { year: date.getFullYear(), month: date.getMonth() + 1 }
    setView(next); setFocusDay({ ...next, day: 1 })
  }
  const keyDown = (event, day) => {
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
    let next
    if (event.key in moves) next = moveCalendarDate(day, moves[event.key])
    else if (event.key === 'Home') next = moveCalendarDate(day, -((new Date(day.year, day.month - 1, day.day).getDay() + 6) % 7))
    else if (event.key === 'End') next = moveCalendarDate(day, 6 - ((new Date(day.year, day.month - 1, day.day).getDay() + 6) % 7))
    if (!next) return
    event.preventDefault()
    pendingFocus.current = true
    setFocusDay(next); setView({ year: next.year, month: next.month })
  }
  return (
    <>
      {name && <input type="hidden" name={name} value={value} disabled={disabled} />}
      <PopoverPrimitive.Root open={open} onOpenChange={changeOpen} modal>
        <PopoverPrimitive.Trigger asChild>
          <button ref={ref} id={id} type="button" disabled={disabled}
            className={cn('cui-input cui-date-trigger', className)} {...props}>
            <span data-placeholder={!committed || undefined}>{committed ? value.replace('T', ' ') : placeholder}</span>
            <CalendarClock aria-hidden="true" />
          </button>
        </PopoverPrimitive.Trigger>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content sideOffset={6} collisionPadding={12} align="start"
            aria-labelledby={titleId} className="cui-popover cui-date-popover"
            onOpenAutoFocus={(event) => {
              event.preventDefault()
              grid.current?.querySelector('[tabindex="0"]')?.focus()
            }}>
            <div className="cui-date-body">
            <p id={titleId} className="cui-date-title">选择日期和时间</p>
            <div className="cui-date-navigation">
              <Button variant="ghost" size="icon" aria-label="上个月" onClick={() => changeMonth(-1)}><ChevronLeft /></Button>
              <Select value={view.year} aria-label="年份" size="sm" onChange={(e) => { setView((v) => ({ ...v, year: Number(e.target.value) })); setFocusDay((d) => ({ ...d, year: Number(e.target.value), day: 1 })) }}>
                {Array.from({ length: lastYear - firstYear + 1 }, (_, i) => firstYear + i).map((year) => <option key={year} value={year}>{year}年</option>)}
              </Select>
              <Select value={view.month} aria-label="月份" size="sm" onChange={(e) => { setView((v) => ({ ...v, month: Number(e.target.value) })); setFocusDay((d) => ({ ...d, month: Number(e.target.value), day: 1 })) }}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => <option key={month} value={month}>{month}月</option>)}
              </Select>
              <Button variant="ghost" size="icon" aria-label="下个月" onClick={() => changeMonth(1)}><ChevronRight /></Button>
            </div>
            <div className="cui-calendar" role="grid" aria-label={`${view.year}年${view.month}月`} ref={grid}>
              <div className="cui-calendar-row" role="row">{'一二三四五六日'.split('').map((label) => <span role="columnheader" key={label}>{label}</span>)}</div>
              {Array.from({ length: 6 }, (_, week) => <div className="cui-calendar-row" role="row" key={week}>
                {days.slice(week * 7, week * 7 + 7).map((day) => <button type="button" role="gridcell"
                  key={`${day.year}-${day.month}-${day.day}`} data-date={`${day.year}-${day.month}-${day.day}`}
                  data-outside={day.month !== view.month || undefined} aria-selected={sameDay(day, draft)}
                  aria-current={sameDay(day, nowValue()) ? 'date' : undefined}
                  aria-label={`${day.year}年${day.month}月${day.day}日`}
                  tabIndex={sameDay(day, focusDay) ? 0 : -1} onKeyDown={(e) => keyDown(e, day)}
                  onClick={() => { setDraft((d) => ({ ...d, ...day })); setFocusDay(day); setView({ year: day.year, month: day.month }) }}>
                  {day.day}
                </button>)}
              </div>)}
            </div>
            <div className="cui-date-time">
              <span>时间</span>
              <Select value={draft.hour} size="sm" aria-label="小时" onChange={(e) => setDraft((d) => ({ ...d, hour: Number(e.target.value) }))}>
                {Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{String(hour).padStart(2, '0')} 时</option>)}
              </Select>
              <Select value={draft.minute} size="sm" aria-label="分钟" onChange={(e) => setDraft((d) => ({ ...d, minute: Number(e.target.value) }))}>
                {Array.from({ length: 60 }, (_, minute) => <option key={minute} value={minute}>{String(minute).padStart(2, '0')} 分</option>)}
              </Select>
            </div>
            <p className="cui-date-summary">{formatLocalDateTime(draft).replace('T', ' ')}</p>
            </div>
            <div className="cui-date-footer">
              <Button size="sm" variant="ghost" onClick={() => update('')}>清空</Button>
              <Button size="sm" variant="outline" onClick={() => setOpen(false)}>取消</Button>
              <Button size="sm" onClick={() => update(formatLocalDateTime(draft))}>确定</Button>
            </div>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </>
  )
})
