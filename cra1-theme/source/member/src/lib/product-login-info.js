const scalar = value => typeof value === 'string' || typeof value === 'number' ? String(value) : ''

export function loginInfoReason(host) {
  if (!['mf_cloud', 'mf_dcim'].includes(host.module)) return '该产品请进入控制面板查看登录信息'
  if (!['Active', 'Suspended', 'Grace', 'Keep'].includes(host.status)) return '该产品当前状态不支持读取登录信息'
  return ''
}

/** Only real login fields are copied. Never guess an account, port or password. */
export function formatLoginInfo(host, remote) {
  const username = scalar(remote?.username), password = scalar(remote?.password), panel = scalar(remote?.panel_pass)
  if (!username && !password && !panel) throw new Error('暂未获取到登录信息，请进入控制面板查看或稍后重试')
  const primaryIp = scalar(host.dedicate_ip || host.card_summary?.ip)
  const assigned = Array.isArray(host.assign_ip) ? host.assign_ip : scalar(host.assign_ip).split(/[,\n]+/)
  const ips = [...new Set([primaryIp, ...assigned.map(scalar)].map(value => value.trim()).filter(Boolean))]
  const port = scalar(remote?.port)
  return [
    ['主机标识', scalar(host.name)],
    ['服务器 IP', ips.join(', ')],
    ['内网 IP', scalar(remote?.vpc_private_ip)],
    ['用户名', username],
    ['密码', password],
    ['端口', /^\d+$/.test(port) && Number(port) > 0 && Number(port) <= 65535 ? port : ''],
    ['面板密码', panel],
  ].filter(([, value]) => value !== '').map(([label, value]) => `${label}：${value}`).join('\n')
}
