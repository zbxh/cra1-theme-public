/** UI record IDs and preview correlation; authentication uses server-issued tokens. */
export function randomId(source = globalThis.crypto) {
  if (typeof source.randomUUID === 'function') return source.randomUUID()
  // getRandomValues is available on ordinary HTTP pages too.
  const bytes = source.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 15) | 64
  bytes[8] = (bytes[8] & 63) | 128
  const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
