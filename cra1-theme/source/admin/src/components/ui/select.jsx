import { Children, forwardRef, isValidElement, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from './utils'
import './select.css'

// Keep the option/onChange contract used by existing forms. Opt in where the
// styled popup is needed; native selects elsewhere retain their original API.
function entries(children, group, groupDisabled = false) {
  return Children.toArray(children).flatMap(child => {
    if (!isValidElement(child)) return []
    if (child.type === 'optgroup') return entries(child.props.children, child.props.label, child.props.disabled)
    if (child.type !== 'option') return entries(child.props.children, group)
    return [{ value: String(child.props.value ?? child.props.children), label: child.props.children, disabled: groupDisabled || child.props.disabled, group }]
  })
}

export const MenuSelect = forwardRef(function MenuSelect({ children, value, defaultValue, onChange, className, name, disabled, required, placeholder = '请选择', portalContainer, ...props }, ref) {
  const trigger = useRef(null)
  const [dialogContainer, setDialogContainer] = useState()
  const setTrigger = useCallback(node => {
    trigger.current = node
    if (typeof ref === 'function') ref(node)
    else if (ref) ref.current = node
  }, [ref])
  // Native <dialog> uses the top layer: a body portal would be underneath it.
  useLayoutEffect(() => { setDialogContainer(trigger.current?.closest('dialog') || undefined) }, [])
  const options = entries(children)
  const initialValue = String(defaultValue ?? options.find(option => !option.disabled)?.value ?? '')
  const [localValue, setLocalValue] = useState(initialValue)
  const selectedValue = value == null ? localValue : String(value)
  useEffect(() => {
    if (value != null) return
    const form = trigger.current?.form
    const reset = () => setLocalValue(initialValue)
    form?.addEventListener('reset', reset)
    return () => form?.removeEventListener('reset', reset)
  }, [initialValue, value])
  const groups = options.reduce((result, option) => {
    const previous = result[result.length - 1]
    if (previous && previous.label === option.group) previous.items.push(option)
    else result.push({ label: option.group, items: [option] })
    return result
  }, [])
  const encode = item => 'choice:' + String(item)
  const emitRaw = next => {
    setLocalValue(next)
    if (!props['aria-invalid']) trigger.current?.removeAttribute('aria-invalid')
    onChange?.({ target: { value: next, name }, currentTarget: { value: next, name } })
  }
  return <SelectPrimitive.Root value={encode(selectedValue)} onValueChange={selected => emitRaw(selected.slice(7))} disabled={disabled}>
    {(name || required) && <select aria-hidden="true" tabIndex={-1} className="admin-menu-select__native" name={name} form={props.form} value={selectedValue} disabled={disabled} required={required} onChange={event => emitRaw(event.target.value)} onInvalid={event => { event.preventDefault(); trigger.current?.setAttribute('aria-invalid', 'true'); trigger.current?.focus() }}>
      {options.map(option => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
    </select>}
    <SelectPrimitive.Trigger ref={setTrigger} aria-required={required || undefined} className={cn('admin-menu-select', className)} {...props}>
      <span className="admin-menu-select__value"><SelectPrimitive.Value placeholder={placeholder} /></span>
      <SelectPrimitive.Icon asChild><ChevronDown className="admin-menu-select__chevron" /></SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
    <SelectPrimitive.Portal container={portalContainer || dialogContainer}>
      <SelectPrimitive.Content data-cra1-ui="admin" className="admin-menu-select__popup" position="popper" sideOffset={5} collisionPadding={12}>
        <SelectPrimitive.ScrollUpButton className="admin-menu-select__scroll"><ChevronUp size={14} /></SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport className="admin-menu-select__viewport">
          {groups.map((group, index) => <SelectPrimitive.Group key={index}>
            {group.label && <SelectPrimitive.Label className="admin-menu-select__group">{group.label}</SelectPrimitive.Label>}
            {group.items.map(option => <SelectPrimitive.Item key={encode(option.value)} value={encode(option.value)} disabled={option.disabled} className="admin-menu-select__option" textValue={typeof option.label === 'string' ? option.label : undefined}>
            <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
            <SelectPrimitive.ItemIndicator className="admin-menu-select__check"><Check size={14} /></SelectPrimitive.ItemIndicator>
          </SelectPrimitive.Item>)}
          </SelectPrimitive.Group>)}
        </SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton className="admin-menu-select__scroll"><ChevronDown size={14} /></SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  </SelectPrimitive.Root>
})
