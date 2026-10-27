// Endpoint-specific V10 contracts. Keep these pure so fixtures never contact production.
export function profilePatch(account = {}, edits = {}, customValues) {
  const result = {}
  for (const key of ['username', 'company', 'country_id', 'address', 'language', 'notice_open', 'notice_method']) result[key] = edits[key] ?? account[key]
  result.country_id = Number(result.country_id || 0)
  result.language ||= 'zh-cn'
  result.notice_open = Number(result.notice_open ?? 1)
  result.notice_method ||= 'all'
  result.notes = edits.notes ?? account.client_notes ?? account.notes ?? ''
  if (customValues !== undefined) result.customfield = { addon_client_custom_field: customValues }
  return result
}
export function passwordPayload(type, form) {
  const result = { type, account: String(form[type] || '').trim(), code: form.code || '', password: form.password, re_password: form.re_password }
  if (type === 'phone') result.phone_code = String(form.phone_code)
  return result
}
export function ipWhitelist(value) { return String(value || '').split(/[\s,，;；]+/).map(x => x.trim()).filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).join('\n') }
export function hostPayload(data = {}) { return { ...(data.host || {}), self_defined_field: data.self_defined_field || [] } }
export function refundState(host = {}, page = {}, method = 'credit') {
  const immediate = host.billing_cycle === 'on_demand'
  const gateway = method === 'gateway_original'
  return { immediate, types: immediate ? ['Immediate'] : ['Expire', 'Immediate'], base: page.host?.base_amount, fee: gateway ? page.host?.gateway_original_service_fee : page.host?.service_fee, amount: gateway ? page.host?.gateway_original_amount : page.host?.amount }
}
export function withdrawalFee(rule, amount) {
  if (!rule) return null
  if (rule.withdraw_fee_type === 'fixed') return Number(rule.withdraw_fee || 0)
  const percent=Number(rule.percent || 0)
  if (!percent) return 0
  // Native bcdiv truncates percentage fees to two decimal places.
  const fee=Math.floor((Number(amount || 0)*percent + 1e-8))/100
  return Math.max(Number(rule.percent_min || 0), fee)
}
export function safeReturn(value, fallback = '/home.htm') {
  if (!value) return fallback
  try { const u = new URL(value, window.location.origin); return u.origin === window.location.origin && !/\/(?:login|regist|forget|oauth)\.htm$/.test(u.pathname) ? u.pathname + u.search + u.hash : fallback } catch { return fallback }
}
export function validateFields(fields, values, beforeSettle = false) {
  for (const f of fields) {
    const v = values[f.id] ?? ''
    const type = f.type || f.field_type
    const empty = v === '' || v === null || (type === 'dropdown_text' && String(v).split('|').some(part => !part.trim())) || ((type === 'tickbox' || type === 'checkbox') && !Number(v))
    if ((Number(f.required) === 1 || (beforeSettle && Number(f.before_settle) === 1)) && empty) return `请填写${f.name || f.field_name || '必填内容'}`
    if (!empty && f.regexpr && !['dropdown','tickbox','checkbox'].includes(f.type)) {
      try { if (!new RegExp(f.regexpr.replace(/^\/(.*)\/[a-z]*$/, '$1')).test(String(v))) return `${f.name || f.field_name || '内容'}格式不正确` } catch { /* PHP-specific expressions remain validated by V10. */ }
    }
  }
  return ''
}
