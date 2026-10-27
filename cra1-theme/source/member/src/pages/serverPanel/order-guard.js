// A browser receipt prevents accidental resubmission; it never grants API access.
// Do not expire uncertain attempts: a slow server may have created the order.
const PREFIX = 'cra1:disk-order:v1:'
const validId = value => /^[1-9]\d*$/.test(String(value)) && Number.isSafeInteger(Number(value))

export function diskOrderScope(token, module, hostId, decode = value => atob(value)) {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const info = JSON.parse(decode(payload)).info
    const child = Number(info.sub_account_id || info.sub_id || 0)
    if (!validId(info.id) || !Number.isSafeInteger(child) || child < 0 || !validId(hostId) || !/^mf_(cloud|dcim)$/.test(module)) return ''
    return PREFIX + [info.id, child, module, hostId].join(':')
  } catch { return '' }
}

export function definiteOrderRejection(error) {
  // Only a native, explicit validation/authentication refusal is safe to retry.
  // HTTP failures, invalid bodies, timeouts and unknown exceptions are uncertain.
  if (error?.uncertain) return false
  if (error?.code === 'SECURITY_CANCELLED') return true // challenge cancelled before submission
  if (error?.code === 'UNAUTHORIZED' && Number(error.status) === 401) return true
  const status = Number(error?.data?.status)
  return error?.code === 'API_ERROR' && [400, 401, 403, 404, 409, 422, 429].includes(status)
    && Number(error.status) === status
}

export function createDiskOrderGuard(storage, key) {
  if (!key) throw Error('登录状态无法确认，请刷新页面后重试')
  function read() {
    const raw = storage.getItem(key)
    if (!raw) return null
    const value = JSON.parse(raw)
    if (!value || !['pending', 'unknown', 'created'].includes(value.state) || typeof value.attempt !== 'string'
      || !Number.isFinite(value.startedAt) || (value.state === 'created' && !validId(value.orderId))) {
      throw Error('订单记录暂时无法读取，请先到财务中心核对订单')
    }
    return value
  }
  function write(value) {
    storage.setItem(key, JSON.stringify(value))
    if (storage.getItem(key) !== JSON.stringify(value)) throw Error('无法保存本次订单记录，请检查浏览器存储设置后重试')
    return value
  }
  return {
    key, read,
    claim(attempt, startedAt = Date.now()) {
      if (read()) return null
      return write({ state: 'pending', attempt, startedAt })
    },
    update(receipt, state, orderId) {
      const current = read()
      if (current?.attempt !== receipt.attempt) throw Error('订单状态已变化，请重新打开查看')
      return write({ ...current, state, ...(validId(orderId) ? { orderId: Number(orderId) } : {}) })
    },
    clear(receipt) {
      if (read()?.attempt === receipt.attempt) storage.removeItem(key)
    },
  }
}

export function validQuoteAmount(value) {
  return (typeof value === 'number' || typeof value === 'string') && String(value).trim() !== ''
    && Number.isFinite(Number(value)) && Number(value) >= 0
}
