import { Field, Input, Select, Textarea } from './input'
export default function CustomFields({ fields = [], values = {}, onChange, disabled: formDisabled = false, restricted = [], beforeSettle = false, fieldClassName, SelectComponent = Select }) {
  return fields.map(field => {
    const disabled = formDisabled || restricted.some(id=>String(id)===String(field.id))
    const id = `custom-${field.id}`, type = field.type || field.field_type, value = values[field.id] ?? ''
    const change = v => onChange({ ...values, [field.id]: v })
    const options = Array.isArray(field.options) ? field.options : String(field.options || '').split(',').filter(Boolean)
    let control
    if (type === 'tickbox' || type === 'checkbox') control = <input id={id} type="checkbox" className="cui-checkbox" checked={!!Number(value)} onChange={e => change(e.target.checked ? 1 : 0)} disabled={disabled} />
    else if (type === 'dropdown') control = <SelectComponent id={id} value={value} onChange={e => change(e.target.value)} disabled={disabled}><option value="">请选择</option>{options.map(o => <option key={String(o.value ?? o)} value={o.value ?? o}>{o.label ?? o.name ?? o}</option>)}</SelectComponent>
    else if (type === 'dropdown_text') {
      const [selected, ...rest] = String(value).split('|')
      control = <div className="flex gap-2"><SelectComponent id={id} value={selected} onChange={e => change(`${e.target.value}|${rest.join('|')}`)} disabled={disabled}><option value="">请选择</option>{options.map(o => <option key={String(o)}>{o}</option>)}</SelectComponent><Input aria-label={`${field.name || field.field_name}内容`} value={rest.join('|')} onChange={e => change(`${selected}|${e.target.value}`)} disabled={disabled} /></div>
    } else if (type === 'textarea') control = <Textarea id={id} value={value} onChange={e => change(e.target.value)} disabled={disabled} />
    else control = <Input id={id} type={type === 'password' ? 'password' : 'text'} autoComplete={type === 'password' ? 'new-password' : 'off'} value={value} onChange={e => change(e.target.value)} disabled={disabled} />
    return <Field key={field.id} className={fieldClassName} label={field.name || field.field_name} htmlFor={id} required={Number(field.required) === 1 || (beforeSettle && Number(field.before_settle) === 1)} hint={field.description || undefined}>{control}</Field>
  })
}
