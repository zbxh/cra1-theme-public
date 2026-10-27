/** Backend requires 7–65 characters containing upper/lowercase letters and digits. */
export function randomPassword(length = 12, source = globalThis.crypto) {
  if (!Number.isInteger(length) || length < 7 || length > 65) throw new RangeError('密码长度必须为 7~65 位')
  const groups = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghjkmnpqrstuvwxyz', '23456789']
  const alphabet = groups.join(''), random = new Uint32Array(length * 2)
  source.getRandomValues(random)
  const result = groups.map((group, index) => group[random[index] % group.length])
  for (let index = result.length; index < length; index++) result.push(alphabet[random[index] % alphabet.length])
  for (let index = length - 1; index > 0; index--) {
    const swap = random[length + index] % (index + 1)
    ;[result[index], result[swap]] = [result[swap], result[index]]
  }
  return result.join('')
}
