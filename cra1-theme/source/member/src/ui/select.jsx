import { Children, Fragment, forwardRef, isValidElement, useCallback, useEffect, useRef, useState } from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from './utils'

// Keep the option order, values and change contract of the existing forms.
// Prefix all values so an empty option (e.g. “全部状态”) is selectable in Radix.
const encode = (value) => `option:${String(value ?? '')}`
const textOf = (children) => Children.toArray(children).map((child) =>
  isValidElement(child) ? textOf(child.props.children) : String(child)
).join('')

function optionsOf(children, groupDisabled = false) {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement(child)) return []
    if (child.type === Fragment) return optionsOf(child.props.children, groupDisabled)
    if (child.type === 'optgroup') return [{
      label: child.props.label,
      items: optionsOf(child.props.children, groupDisabled || child.props.disabled),
    }]
    if (child.type !== 'option') return []
    return [{
      value: String(child.props.value ?? textOf(child.props.children)),
      text: textOf(child.props.children),
      label: child.props.children,
      disabled: !!(groupDisabled || child.props.disabled),
    }]
  })
}

export const Select = forwardRef(function Select({
  children, value, defaultValue, onChange, className, disabled, required,
  name, form, size = 'default', placeholder = '请选择', valueLabel, ...props
}, ref) {
  const groups = optionsOf(children)
  const options = groups.flatMap((entry) => entry.items || [entry])
  const initial = String(defaultValue ?? options.find((entry) => !entry.disabled)?.value ?? '')
  const [localValue, setLocalValue] = useState(initial)
  const [invalid, setInvalid] = useState(false)
  const selectedValue = value === undefined ? localValue : String(value ?? '')
  const trigger = useRef(null)
  const native = useRef(null)
  const setTrigger = useCallback((node) => {
    trigger.current = node
    if (typeof ref === 'function') ref(node)
    else if (ref) ref.current = node
  }, [ref])
  useEffect(() => {
    const owner = native.current?.form || trigger.current?.form
    const reset = () => {
      if (value === undefined) setLocalValue(initial)
      setInvalid(false)
    }
    owner?.addEventListener('reset', reset)
    return () => owner?.removeEventListener('reset', reset)
  }, [initial, value, form])
  const emitRaw = (next) => {
    setLocalValue(next)
    setInvalid(false)
    const target = { value: next, name }
    onChange?.({ target, currentTarget: target, type: 'change' })
  }
  const option = (entry) => (
    <SelectPrimitive.Item key={entry.value} value={encode(entry.value)} disabled={entry.disabled}
      textValue={entry.text} className="cui-menu-item cui-select-option">
      <SelectPrimitive.ItemText>{entry.label}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="cui-select-option__check"><Check aria-hidden="true" /></SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
  return (
    <SelectPrimitive.Root value={encode(selectedValue)} disabled={disabled}
      onValueChange={(next) => emitRaw(next.slice('option:'.length))}>
      {/* Keep Radix's private option encoding out of native form submission and
          preserve the browser's empty/required validation and reset behavior. */}
      {(name || required) && <select ref={native} aria-hidden="true" tabIndex={-1}
        className="cui-select-native" name={name} form={form} value={selectedValue}
        disabled={disabled} required={required} onChange={(event) => emitRaw(event.target.value)}
        onInvalid={(event) => { event.preventDefault(); setInvalid(true); trigger.current?.focus() }}>
        {options.map((entry) => <option key={entry.value} value={entry.value} disabled={entry.disabled}>{entry.text}</option>)}
      </select>}
      <SelectPrimitive.Trigger ref={setTrigger} form={form} aria-required={required || undefined}
        className={cn('cui-input cui-select-trigger',
          size === 'sm' && 'cui-select-trigger--compact', className)} {...props}
        aria-invalid={props['aria-invalid'] ?? (invalid || undefined)}>
        <SelectPrimitive.Value placeholder={placeholder}>{valueLabel}</SelectPrimitive.Value>
        <SelectPrimitive.Icon className="cui-select-trigger__arrow"><ChevronDown aria-hidden="true" /></SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content position="popper" sideOffset={6} collisionPadding={12}
          className="cui-popover cui-select-content">
          <SelectPrimitive.ScrollUpButton className="cui-select-scroll"><ChevronUp aria-hidden="true" /></SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport className="cui-select-viewport">
            {groups.map((entry, i) => entry.items ? (
              <SelectPrimitive.Group key={i}>
                <SelectPrimitive.Label className="cui-select-group-label">{entry.label}</SelectPrimitive.Label>
                {entry.items.map(option)}
              </SelectPrimitive.Group>
            ) : option(entry))}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="cui-select-scroll"><ChevronDown aria-hidden="true" /></SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
})
