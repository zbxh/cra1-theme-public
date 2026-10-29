/**
 * CRA1 后台 API 客户端
 *
 * 后端是 public/cra1admin/index.php 的 ?r=api.* 路由：
 *   - 全部为 POST（含读取类），必须带 X-CSRF-Token（来自 PHP 壳的 #app[data-csrf]）
 *   - 同源 Cookie 会话 CRA1THEMEID
 *   - 统一返回 { status, msg, data? }
 *
 * 这里的 csrf 由 PHP 注入的 window.__CRA1_ADMIN__ 提供，避免竞态
 * （早期实现从 DOM dataset 读取，在 Alpine/React 初始化前会拿到空值）。
 */
const boot = (typeof window !== 'undefined' && window.__CRA1_ADMIN__) || {}
let csrf = boot.csrf || ''
let base = boot.base || 'index.php'

export function setCsrf(next) {
  if (next) csrf = next
}

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message)
    this.status = status
    this.payload = payload
  }
}

function multipartRequest(url, body, options) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const signal = options.signal
    const abort = () => xhr.abort()
    const cleanup = () => signal?.removeEventListener('abort', abort)
    xhr.open('POST', url)
    xhr.withCredentials = true
    xhr.setRequestHeader('X-CSRF-Token', csrf)
    xhr.upload.onprogress = event => {
      if (event.lengthComputable) options.onUploadProgress(Math.min(100, Math.round(event.loaded * 100 / event.total)))
    }
    xhr.onload = () => {
      cleanup()
      if (xhr.status === 413) return reject(new ApiError('安装包超过服务器上传限制，可改用服务器本地导入', 413, null))
      resolve({status:xhr.status, json:async()=>JSON.parse(xhr.responseText)})
    }
    xhr.onerror = () => { cleanup(); reject(new ApiError('上传连接中断，请检查网络后重试；也可使用服务器本地导入', 0, null)) }
    xhr.onabort = () => { cleanup(); reject(new DOMException('请求已取消', 'AbortError')) }
    if (signal?.aborted) return reject(new DOMException('请求已取消', 'AbortError'))
    signal?.addEventListener('abort', abort, {once:true})
    xhr.send(body)
  })
}

export async function api(route, body, options = {}) {
  const multipart = typeof FormData !== 'undefined' && body instanceof FormData
  const res = multipart && typeof options.onUploadProgress === 'function'
    ? await multipartRequest(base + '?r=' + route, body, options)
    : await fetch(base + '?r=' + route, {
    method: 'POST',
    signal: options.signal,
    credentials: 'same-origin',
    headers: { ...(multipart ? {} : { 'Content-Type': 'application/json' }), 'X-CSRF-Token': csrf },
    body: multipart ? body : JSON.stringify(body || {}),
  })
  let json = null
  try {
    json = await res.json()
  } catch {
    throw new ApiError('服务端返回了非 JSON 响应，请刷新页面重试', res.status, null)
  }
  if (!json || typeof json.status === 'undefined') {
    throw new ApiError('响应格式异常', res.status, json)
  }
  if (json.status === 401) {
    // 会话过期：回登录页，避免页面上留下半残状态
    window.location.replace(base + '?r=login')
    throw new ApiError(json.msg || '会话已过期', 401, json)
  }
  if(json.code==='REAUTH_REQUIRED'&&options.reauth!==false){
    const action=route.replace(/^api\./,''),domain=body?.domain||(action.startsWith('member.')?'member':action.startsWith('cart.')?'cart':'website')
    const target=action.startsWith('security.accounts.')?'account:'+(body?.id||'new'):action==='security.audit.export'?'audit':action==='path'||action==='security.settings.save'?'security':action==='security.session.revoke'?'account:'+(body?.account_id||boot.user_id):action.startsWith('security.mfa.')||action.startsWith('security.recovery.')||action==='security.password'?'account:'+boot.user_id:domain+':'+(body?.editorId||body?.scopeId||'all')
    const credential=await new Promise(resolve=>window.dispatchEvent(new CustomEvent('theme-reauth',{detail:{action,target,resolve}})))
    if(credential){if(multipart){body.set('_reauth',credential);return api(route,body,{...options,reauth:false})}return api(route,{...body,_reauth:credential},{...options,reauth:false})}
  }
  // 其余状态（200 / 400 / 409 / 403 ...）一律原样返回，
  // 由调用方按 status 决定提示或冲突处理 —— 不在这里吞掉业务语义。
  return json
}

/** 官网主题（自有 config.json） */
export const websiteApi = {
  get: () => api('api.get'),
  save: (payload) => api('api.save', payload),
  reset: () => api('api.reset'),
  pageLayoutGet: () => api('api.page-layout.get'),
  pageLayoutSave: (payload) => api('api.page-layout.save', payload),
  pageLayoutReset: (payload) => api('api.page-layout.reset', payload),
  seoGet: () => api('api.seo.get'),
  seoSave: (payload) => api('api.seo.save', payload),
  sitePages: () => api('api.site-pages'),
  linkOptions: () => api('api.link-options'),
  icons: () => api('api.icons'),
  iconsCatalog: (payload, options) => api('api.icons.catalog', payload, options),
  iconsPage: (payload, options) => api('api.icons.page', payload, options),
  iconSearch: (payload, options) => api('api.icon-search', payload, options),
  iconsResolve: (payload, options) => api('api.icons.resolve', payload, options),
  iconsPreview: (payload, options) => api('api.icons.preview', payload, options),
  iconsApply: (payload, options) => api('api.icons.apply', payload, options),
  productOptions: () => api('api.product-options'),
  navigationCatalog: () => api('api.navigation-catalog'),
  logs: () => api('api.logs'),
  password: (payload) => api('api.password', payload),
  path: (payload) => api('api.path', payload),
  logout: () => api('api.logout'),
}

/** 会员中心主题（独立 member_center.json，与官网互不影响） */
export const memberApi = {
  get: () => api('api.member.get'),
  catalog: () => api('api.member.catalog'),
  import: (payload) => api('api.member.import', payload),
  saveSidebar: (payload) => api('api.member.sidebar.save', payload),
  saveAppearance: (payload) => api('api.member.appearance.save', payload),
  contentGet: () => api('api.member.content.get'),
  contentCatalog: () => api('api.member.content.catalog'),
  ticketCatalog: () => api('api.member.ticket.catalog'),
  saveContent: (payload) => api('api.member.content.save', payload),
  reset: () => api('api.member.reset'),
}

export const cartApi = {
  get: () => api('api.cart.get'),
  save: (payload) => api('api.cart.save', payload),
  reset: () => api('api.cart.reset'),
  products: () => api('api.product-options'),
}

export const bootInfo = boot

/** Scope-based workspace API; the existing endpoint contracts stay available. */
export const workspaceApi = {
  catalog: () => api('api.workspace.catalog'),
  get: (domain, scopeId) => api('api.workspace.get', { domain, scopeId }),
  save: (body) => api('api.workspace.save', body),
  rebuild: (domain) => api('api.workspace.snapshot.rebuild', { domain }),
  editorGet: (domain, editorId) => api('api.workspace.editor.get', { domain, editorId }),
  editorSave: (body) => api('api.workspace.editor.save', body),
  preview: (body) => api('api.workspace.preview', body),
  editorImport: (mode,nodes,shape) => api('api.workspace.editor.import', {domain:'member',mode,nodes,shape}),
}
export const mediaApi = {
  list: (body, options) => api('api.media.list', body, options),
  attachments: (body, options) => api('api.media.attachments', body, options),
  rename: (body) => api('api.media.rename', body),
  delete: (body) => api('api.media.delete', body),
  restore: (body) => api('api.media.restore', body),
  upload: async (file) => {
    const body = new FormData(); body.append('file', file)
    const response = await fetch(base + '?r=api.media.upload', {method:'POST',credentials:'same-origin',headers:{'X-CSRF-Token':csrf},body})
    const json = await response.json()
    if (json.status === 401) window.location.replace(base + '?r=login')
    return json
  },
}

export const securityApi={call:(action,p={})=>api('api.security.'+action,p),export:async(p={})=>{
  const credential=await new Promise(resolve=>window.dispatchEvent(new CustomEvent('theme-reauth',{detail:{action:'security.audit.export',target:'audit',resolve}})))
  if(!credential)return null
  const r=await fetch(base+'?r=api.security.audit.export',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({...p,_reauth:credential})})
  if(!r.ok){const j=await r.json();throw new Error(j.msg)}
  const blob=await r.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='主题后台审计.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return {nextCursor:r.headers.get('X-Next-Cursor')}
}}
