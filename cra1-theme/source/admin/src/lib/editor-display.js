/** Resolve pending editor actions before a save response is available. */
export function moduleVisible(module, layout = {}, resolved = {}) {
  if (!module?.visibilityKey) return true
  const mode = layout.visibility?.[module.id]
  if (mode === 'show') return true
  if (mode === 'hide') return false
  return !!(resolved.inheritedVisibility?.[module.id] ?? resolved.visibility?.[module.id])
}

export function effectiveContent(values = {}, defaults = {}) {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value === null ? defaults[key] : value]))
}
