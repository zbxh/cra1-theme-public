/** Keep native declarations, shell ownership and per-page script order in one adapter. */
export async function mountModuleScripts(host, options = {}) {
  if (!window.CRA1ModuleDeps?.mountScripts) throw new Error('页面所需组件未能加载，请刷新重试')
  return window.CRA1ModuleDeps.mountScripts(host, options)
}
