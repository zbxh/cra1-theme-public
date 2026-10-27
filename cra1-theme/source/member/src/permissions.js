// Mirrors installed native rules. Unknown native routes retain native behavior;
// explicit sensitive operation groups are always resolved by the server.
export function allowed(access, rule) {
  if (!access || !rule) return !rule
  rule = String(rule).replace(/\\+/g, '\\')
  if (access.all === true) return true
  if (rule.startsWith('action:')) return access.actions?.[rule.slice(7)] === true
  const full = rule.includes('\\') ? rule : `app\\home\\controller\\${rule.replace('::','Controller::')}`
  const normalize = value => String(value).replace(/\\+/g, '\\')
  return !(access.known || []).some(value => normalize(value) === full) ||
    (access.rules || []).some(value => normalize(value) === full)
}
export const dialogPermission = type => {
  if (['power','powerOn','powerOff','reboot','hardOff','hardReboot'].includes(type)) return 'action:power'
  if (['renew','unsubscribe','refund','upgrade','upgradeElastic','upgradePackage','billingConvert','autoRenew','flowPacket','defence','diskOrder','diskResize','bsConfig'].includes(type)) return 'action:billing'
  if (['loginInfo','reinstall','resetPass','rescue','rescueExit','simulate','vnc','bsCreate','bsRestore','diskMount','diskUnmount','securityGroup','vpc','nat','natAcl','natWeb','autoRelease','notes'].includes(type)) return 'action:control'
  if (['delete','diskDelete','bsDelete'].includes(type)) return 'action:delete'
  return ''
}
