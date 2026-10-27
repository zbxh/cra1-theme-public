export const QUICK_ACTIONS = [
  { key: 'reboot', type: 'power', action: 'reboot', title: '重启' },
  { key: 'reinstall', type: 'reinstall', title: '重装系统' },
  { key: 'powerOn', type: 'power', action: 'powerOn', title: '开机' },
  { key: 'powerOff', type: 'power', action: 'powerOff', title: '关机', danger: true },
  { key: 'resetPass', type: 'resetPass', title: '重置密码' },
]

export function quickActionOptions({ host, power, cloud, ready, busy, orderReady = true, deferCheck = false }) {
  const supported = ['mf_cloud', 'mf_dcim'].includes(host?.module)
  const common = !supported ? '该产品请通过管理页操作'
    : host.status !== 'Active' ? '仅已开通的实例支持快捷操作'
      : busy || ['operating', 'pending'].includes(power?.status) ? '实例正在执行操作，请稍候'
        : !deferCheck && !ready ? '正在检查服务器状态'
          : !deferCheck && !['on', 'off'].includes(power?.status) ? '当前电源状态不支持此操作' : ''
  return QUICK_ACTIONS.map(action => {
    let reason = common
    if (!reason && ['reinstall', 'resetPass'].includes(action.type) && Number(cloud?.config?.manual_manage) === 1) reason = '该实例由人工管理，请通过管理页或联系客服处理'
    if (!reason && action.type === 'reinstall' && !orderReady) reason = '重装设置读取失败，请重新打开菜单重试'
    if (!reason && action.key === 'powerOn' && power?.status === 'on') reason = '服务器已开机'
    if (!reason && ['reboot', 'powerOff'].includes(action.key) && power?.status === 'off') reason = '服务器已关机'
    return { ...action, disabled: Boolean(reason), reason }
  })
}

export function quickDialogCapabilities(cloud, orderConfig) {
  const cfg = cloud?.config || {}, order = orderConfig || {}
  return {
    manualManage: Number(cfg.manual_manage) === 1,
    sshKey: Number(order.support_ssh_key) === 1 && Number(cfg.manual_manage || 0) !== 1,
    portMode: Number(order.rand_ssh_port || 0),
    portCfg: { start: order.rand_ssh_port_start, end: order.rand_ssh_port_end, windows: order.rand_ssh_port_windows, linux: order.rand_ssh_port_linux },
  }
}

/** V10 returns ordered image groups; some upstream adapters already flatten them. */
export function reinstallImages(list) {
  if (!Array.isArray(list)) throw new Error('镜像数据不完整，请重试')
  return list.flatMap(group => Array.isArray(group.image)
    ? group.image.map(image => ({ ...image, image_group_name: group.name, image_group_id: group.id }))
    : [group]).filter(image => Number(image.id) > 0 && image.name)
}
