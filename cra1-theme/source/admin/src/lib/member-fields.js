/** Effective choices match the member renderer, including old name behavior. */
export const DEFAULT_HOST_FIELDS = ['product_name', 'base_info', 'ip', 'notes', 'status', 'due_time', 'os', 'area']
export function memberDisplayFields(category) {
  const explicit = category && (category.select_field_set || category.select_field?.length)
  const selected = Array.isArray(category?.select_field) ? category.select_field : String(category?.select_field || '').split(',').map(v=>v.trim()).filter(Boolean)
  const fields = new Set(explicit ? selected : DEFAULT_HOST_FIELDS)
  if ((!explicit || Number(category.select_field_version || 1) < 2) && fields.has('product_name')) fields.add('instance_name')
  return fields
}
