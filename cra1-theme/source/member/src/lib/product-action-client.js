import { sharedReady } from '../shared'

/** This endpoint sanitizes native failures before any response reaches the browser. */
export async function productActionRequest(path, { method = 'GET', params, body, signal, timeout, securityHandled = false } = {}) {
  const shared = await sharedReady(), contract = shared.Request
  const token = contract.getToken(), controller = new AbortController()
  const cancel = () => controller.abort()
  if (signal?.aborted) controller.abort()
  else signal?.addEventListener('abort', cancel, { once: true })
  let expired = false
  const timer = setTimeout(() => { expired = true; controller.abort() }, timeout || (method === 'GET' ? 15000 : 30000))
  const headers = contract.headers({ token })
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  try {
    const queryParams = { ...params }
    if (queryParams.customfield?.promo_code) {
      queryParams.customfield.promo_code.forEach((value, index) => { queryParams[`customfield[promo_code][${index}]`] = value })
      delete queryParams.customfield
    }
    const query = contract.query({ ...queryParams, target: path })
    const response = await fetch(`/cra1-shared/instance.php?${query}`, { method, headers, credentials: 'same-origin', signal: controller.signal, body: body === undefined ? undefined : JSON.stringify(body) })
    // HTTP authentication failure is authoritative even if its body is not JSON.
    if (response.status === 401) {
      contract.unauthorized({ policy: 'redirect', token })
      const error = new Error('登录已失效，请重新登录'); error.status = 401; throw error
    }
    const data = await response.json().catch(() => { throw new Error('服务响应异常，请稍后重试') })
    if (Number(data.status) === 401) contract.unauthorized({ policy: 'redirect', token })
    if (!response.ok || Number(data.status) !== 200) {
      if (!securityHandled && shared.Security?.setup(data)) { clearTimeout(timer); return await shared.Security.requireSetup(data, { signal }) }
      if (!securityHandled && shared.Security?.challenge(data)) {
        clearTimeout(timer)
        return await shared.Security.perform(data, proof => productActionRequest(path, { method, params, body: Object.keys(proof).length ? { ...body, ...proof } : body, signal, timeout, securityHandled: true }), { signal, token })
      }
      // Defense in depth: only canonical Chinese errors from this adapter are displayed.
      const allowed = /^(?:登录已失效，请重新登录|当前账号无权执行此操作|当前产品暂不支持此功能|服务器状态已变化，请重新检查后操作|提交的信息不符合要求，请检查后重试|操作过于频繁，请稍后重试|暂时无法获取服务器状态，请稍后重试|暂时无法完成此操作，请稍后重试或联系客服|该操作需要验证操作密码|操作密码错误，请重新输入|验证码错误，请重新输入|验证码已过期，请重新获取|服务器已关机|服务器已开机|请先调整至少一项配置|优惠码不可用，请检查后重试|服务暂时不可用，请稍后重试)$/
      const error = new Error(shared.Security?.challenge(data) ? '安全验证未通过，请检查验证码后重试' : allowed.test(data.msg) ? data.msg : '暂时无法完成此操作，请稍后重试或联系客服')
      error.status = Number(data.status) || response.status
      error.data = data
      error.requestId = /^[a-f0-9]{20}$/.test(data.request_id) ? data.request_id : ''
      throw error
    }
    return data
  } catch (error) {
    if (signal?.aborted) { const aborted = new Error('检查已取消'); aborted.name = 'AbortError'; throw aborted }
    if (expired) { const timedOut = new Error(method === 'GET' ? '检查超时，请稍后重试' : '请求超时，请先确认服务器状态后再重试'); timedOut.uncertain = method !== 'GET'; throw timedOut }
    if (error.status || error.code?.startsWith('SECURITY_') || error.message === '服务响应异常，请稍后重试') throw error
    throw new Error('网络连接异常，请稍后重试')
  } finally {
    clearTimeout(timer); signal?.removeEventListener('abort', cancel)
  }
}
