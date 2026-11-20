// An installed add-on can be enabled without the corresponding licensed feature.
// Only an explicit unavailable-feature response may remove an optional extension;
// session, permission and transient failures must keep their normal handling.
export function optionalPluginUnavailable(error) {
  if (error?.code && error.code !== 'API_ERROR') return false
  if (error?.status != null && Number(error.status) !== 400) return false
  if (error?.response?.status != null && ![200,400].includes(Number(error.response.status))) return false
  const data = error?.data || error?.response?.data
  const status = Number(data?.status ?? error?.status)
  if (status !== 400) return false
  const message = String(data?.msg || data?.message || error?.msg || error?.message || '').trim()
  return /^(?:功能未授权|插件未授权|插件未安装|插件未启用|插件已停用|功能未启用|功能未开启)[。！!]?$/u.test(message)
}
