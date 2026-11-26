export const globalTarget = { scope: 'global', id: 0, name: '全局说明', path: '全局说明', selection: {} }
export const scopeNames = { global: '全局说明', first: '一级分组', second: '二级分组', product: '商品' }
export const emptyRule = { mode: 'custom', html: '' }
export const targetKey = row => row.scope + ':' + row.id

export function indexCatalog(catalog) {
  const roots = []
  const products = []
  const targets = new Map([[targetKey(globalTarget), globalTarget]])
  for (const group of catalog?.groups || []) {
    if (Number(group.parent_id)) continue
    const id = Number(group.id)
    const root = { scope: 'first', id, name: group.name, path: group.name, hidden: Number(group.hidden) === 1,
      selection: { first: id }, children: [] }
    roots.push(root)
    targets.set(targetKey(root), root)
  }
  for (const group of catalog?.groups || []) {
    const parent = targets.get('first:' + group.parent_id)
    if (!parent) continue
    const id = Number(group.id)
    const row = { scope: 'second', id, name: group.name, path: parent.path + ' / ' + group.name,
      hidden: parent.hidden || Number(group.hidden) === 1, selection: { first: parent.id, second: id }, children: [] }
    parent.children.push(row)
    targets.set(targetKey(row), row)
  }
  for (const product of catalog?.products || []) {
    const parent = targets.get('second:' + product.group_id) || targets.get('first:' + product.group_id)
    if (!parent) continue
    const id = Number(product.id)
    const row = { scope: 'product', id, name: product.name, path: parent.path + ' / ' + product.name,
      hidden: parent.hidden || Number(product.hidden) === 1, selection: { ...parent.selection, product: id } }
    parent.children.push(row)
    products.push(row)
    targets.set(targetKey(row), row)
  }
  return { roots, products, targets }
}

export function missingTargets(rules, targets) {
  return ['first', 'second', 'product'].flatMap(scope => Object.keys(rules[scope] || {}).flatMap(id => {
    if (targets.has(scope + ':' + id)) return []
    const name = scopeNames[scope] + ' #' + id
    return [{ scope, id: Number(id), name, path: name, missing: true }]
  }))
}

export function bindingAt(rules, row) {
  return row.scope === 'global' ? rules.global : rules[row.scope]?.[row.id]
}

export function ruleAt(rules, row) {
  const binding = bindingAt(rules, row)
  return (binding?.ref ? rules.shared?.[binding.ref] : binding) || emptyRule
}

export function isConfigured(binding) {
  return Boolean(binding?.ref || binding?.mode === 'hide' || binding?.html?.trim())
}

export function changeBindings(rules, rows, binding) {
  const result = { ...rules }
  const copied = new Set()
  for (const { scope, id } of rows) {
    if (scope === 'global') {
      result.global = binding || emptyRule
      continue
    }
    if (!copied.has(scope)) {
      result[scope] = { ...rules[scope] }
      copied.add(scope)
    }
    if (binding) result[scope][id] = binding
    else delete result[scope][id]
  }
  return result
}

export function pruneShared(rules) {
  if (!rules.shared) return rules
  const bindings = [rules.global, ...['first', 'second', 'product'].flatMap(scope => Object.values(rules[scope] || {}))]
  const used = new Set(bindings.map(binding => binding?.ref))
  const shared = Object.fromEntries(Object.entries(rules.shared).filter(([ref]) => used.has(ref)))
  const { shared: previous, ...result } = rules
  return Object.keys(shared).length ? { ...result, shared } : result
}

export function shareRule(rules, current, added, removed, ref) {
  const binding = { ref }
  const after = changeBindings(changeBindings(rules, removed), [current, ...added], binding)
  return pruneShared({ ...after, shared: { ...rules.shared, [ref]: ruleAt(rules, current) } })
}

export function newReference() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return 'd-' + Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

export function covers(row, product) {
  return row.scope === 'global' || product.selection[row.scope] === row.id
}

export function previewRules(rules, target, selection) {
  const currentRef = bindingAt(rules, target)?.ref
  const related = [globalTarget, ...Object.entries(selection).map(([scope, id]) => ({ scope, id })), target]
  let result = {}
  for (const row of related) {
    const binding = bindingAt(rules, row)
    if (!binding || (targetKey(row) === targetKey(target) && !currentRef)) continue
    result = changeBindings(result, [row], binding)
    if (binding.ref && binding.ref !== currentRef) {
      result.shared = { ...result.shared, [binding.ref]: rules.shared?.[binding.ref] }
    }
  }
  return result
}
