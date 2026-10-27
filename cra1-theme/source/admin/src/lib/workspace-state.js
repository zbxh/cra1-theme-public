export const clone = (v) => v === undefined ? undefined : JSON.parse(JSON.stringify(v))
export const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b)
export function changes(base = {}, draft = {}) {
  return Object.fromEntries(Object.entries(draft).filter(([key, value]) => !equal(base[key], value)))
}
// Composite editors contain save scopes. Send changed members of each scope,
// keeping dictionaries and lists within a member atomic for its field contract.
// Sending an entire content scope would turn untouched inherited values into
// page overrides merely because another field was edited.
export function editorChanges(base = {}, draft = {}) {
  const patch = {}
  for (const [section, values] of Object.entries(draft)) {
    const changed = changes(base[section] || {}, values)
    if (Object.keys(changed).length) patch[section] = changed
  }
  return patch
}
const object = (v) => v && typeof v === 'object' && !Array.isArray(v)
export function threeWay(base, local, remote, path = []) {
  if (equal(local, base)) return { value: clone(remote), conflicts: [] }
  if (equal(remote, base) || equal(local, remote)) return { value: clone(local), conflicts: [] }
  if (object(base) && object(local) && object(remote)) {
    const result = { value: {}, conflicts: [] }
    for (const key of new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)])) {
      const next = threeWay(base[key], local[key], remote[key], [...path, key])
      if (next.value !== undefined) result.value[key] = next.value
      result.conflicts.push(...next.conflicts)
    }
    return result
  }
  return { value: clone(local), conflicts: [{ path, base, local, remote }] }
}
export function setAt(value, path, next) {
  if (!path.length) return next
  const [key, ...tail] = path
  const result = { ...value }
  const item = setAt(value?.[key] || {}, tail, next)
  if (item === undefined) delete result[key]
  else result[key] = item
  return result
}
