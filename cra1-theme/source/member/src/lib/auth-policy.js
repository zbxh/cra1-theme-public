// Matches V10's public/common/passwordStrength.js and the native register /
// password-reset forms. Existing passwords are not revalidated at login.
export function loginMethods(methods = []) {
  const result = []
  if (methods.includes('email-password') || methods.includes('phone-password')) result.push('password')
  if (methods.includes('phone-code')) result.push('phone-code')
  return result
}

// Keep the input open to numeric email local parts; validate phone length without
// truncating a pasted account or preventing the user from entering a later @.
export function loginAccount(account, { methods = [], phoneCode = '86', code = false } = {}) {
  const value = String(account || '').trim()
  const type = code || /^\d+$/.test(value) ? 'phone' : 'email'
  const invalid = error => ({ type, value, error })
  if (!value) return invalid(code ? '请输入手机号' : '请输入手机号或邮箱')
  if (type === 'email') {
    const [local = '', domain = ''] = value.split('@')
    if (value.length > 254 || local.length > 64 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ||
      local.startsWith('.') || local.endsWith('.') || local.includes('..') ||
      domain.split('.').some(label => !/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(label))) return invalid('请输入有效的邮箱地址，如 name@example.com')
    if (!methods.includes('email-password')) return invalid('当前不支持邮箱账密登录，请使用已开放的登录方式')
  } else {
    if (String(phoneCode) === '86' ? !/^\d{11}$/.test(value) : !/^\d{4,15}$/.test(value)) return invalid(String(phoneCode) === '86' ? '请输入 11 位数字手机号' : '请输入有效的手机号')
    if (!methods.includes(code ? 'phone-code' : 'phone-password')) return invalid('当前不支持此手机号登录方式，请使用已开放的登录方式')
  }
  return { type, value, error: '' }
}

export function passwordError(password, { login = false, strong = false } = {}) {
  if (!password) return '请输入密码'
  if (login) return ''
  if (password.length < 6 || password.length > 32) return '密码长度应为 6–32 位'
  if (!strong) return ''
  if (password.length < 8) return '密码至少需要 8 位'
  const special = "]!@#$%^&*()-_=+[{}|;:'\",./<>?`~\\"
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password) || !Array.from(password).some(c => special.includes(c))) return '密码需同时包含字母、数字和特殊符号'
  for (let i = 0; i <= password.length - 3; i++) {
    const a = password.charCodeAt(i), b = password.charCodeAt(i + 1), c = password.charCodeAt(i + 2)
    if ((a === b && b === c) || (b - a === 1 && c - b === 1) || (a - b === 1 && b - c === 1)) return '密码不能包含连续 3 位递增、递减或重复字符'
  }
  return ''
}

export function providerLogo(provider, origin) {
  const source = provider.img || provider.logo
  if (!source) return ''
  try {
    const url = new URL(source, origin)
    return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url.href : ''
  } catch { return '' }
}
