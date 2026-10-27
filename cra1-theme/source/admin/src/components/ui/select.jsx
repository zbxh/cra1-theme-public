import { Children, forwardRef, isValidElement } from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from './utils'
import './select.css'

// Keep the option/onChange contract used by existing forms. Opt in where the
// styled popup is needed; native selects elsewhere retain their original API.
function entries(children, group) {
  return Children.toArray(children).flatMap(child => {
    if (!isValidElement(child)) return []
    if (child.type === 'optgroup') return entries(child.props.children, child.props.label)
    if (child.type !== 'option') return entries(child.props.children, group)
    return [{ value: String(child.props.value ?? child.props.children), label: child.props.children, disabled: child.props.disabled, group }]
  })
}

export const MenuSelect = forwardRef(function MenuSelect({ children, value, defaultValue, onChange, className, name, disabled, required, placeholder = '请选择', portalContainer, ...props }, ref) {
  const options = entries(children)
  const encode = item => 'choice:' + String(item)
  const emit = selected => {
    const next = selected.slice(7)
    onChange?.({ target: { value: next, name }, currentTarget: { value: next, name } })
  }
  return <SelectPrimitive.Root value={value == null ? undefined : encode(value)} defaultValue={defaultValue == null ? undefined : encode(defaultValue)} onValueChange={emit} name={name} disabled={disabled} required={required}>
    <SelectPrimitive.Trigger ref={ref} className={cn('admin-menu-select', className)} {...props}>
      <span className="admin-menu-select__value"><SelectPrimitive.Value placeholder={placeholder} /></span>
      <SelectPrimitive.Icon asChild><ChevronDown className="admin-menu-select__chevron" /></SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
    <SelectPrimitive.Portal container={portalContainer}>
      <SelectPrimitive.Content className="admin-menu-select__popup" position="popper" sideOffset={5} collisionPadding={12}>
        <SelectPrimitive.ScrollUpButton className="admin-menu-select__scroll"><ChevronUp size={14} /></SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport className="admin-menu-select__viewport">
          {options.map((option, index) => <SelectPrimitive.Item key={encode(option.value)} value={encode(option.value)} disabled={option.disabled} className="admin-menu-select__option" textValue={typeof option.label === 'string' ? option.label : undefined}>
            <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
            <SelectPrimitive.ItemIndicator className="admin-menu-select__check"><Check size={14} /></SelectPrimitive.ItemIndicator>
          </SelectPrimitive.Item>)}
        </SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton className="admin-menu-select__scroll"><ChevronDown size={14} /></SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  </SelectPrimitive.Root>
})
