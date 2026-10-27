import { Children, Fragment, forwardRef, isValidElement } from 'react'
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
  const initial = defaultValue ?? options[0]?.value ?? ''
  const option = (entry) => (
    <SelectPrimitive.Item key={entry.value} value={encode(entry.value)} disabled={entry.disabled}
      textValue={entry.text} className="cui-menu-item cui-select-option">
      <SelectPrimitive.ItemText>{entry.label}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="cui-select-option__check"><Check aria-hidden="true" /></SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
  return (
    <SelectPrimitive.Root value={value === undefined ? undefined : encode(value)}
      defaultValue={encode(initial)} disabled={disabled} required={required} name={name} form={form}
      onValueChange={(next) => {
        const target = { value: next.slice('option:'.length), name }
        onChange?.({ target, currentTarget: target, type: 'change' })
      }}>
      <SelectPrimitive.Trigger ref={ref} className={cn('cui-input cui-select-trigger',
        size === 'sm' && 'cui-select-trigger--compact', className)} {...props}>
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
