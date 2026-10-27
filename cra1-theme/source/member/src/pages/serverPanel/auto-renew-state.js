const initialState = { phase: 'loading', enabled: null, target: null, error: '' }

function requireSuccess(response) {
  if (Number(response?.status) !== 200) {
    throw new Error(response?.msg || '服务器未能完成请求')
  }
}

/** Renew 插件可能返回字符串 0/1；禁止用字符串真值推断开启状态。 */
export function parseAutoRenewStatus(response) {
  requireSuccess(response)
  const data = response.data
  const value = data && Object.prototype.hasOwnProperty.call(data, 'status')
    ? data.status
    : data?.is_open
  if (value === 1 || value === '1' || value === true) return true
  if (value === 0 || value === '0' || value === false) return false
  throw new Error('服务器返回的自动续费状态无法识别')
}

/** 独立于面板刷新；失败后的重试只读取状态，不再盲目反转或重复写入。 */
export function createAutoRenewController(api, onChange) {
  let state = { ...initialState }
  let locked = false
  let disposed = false
  const update = (next) => {
    if (disposed) return
    state = { ...state, ...next }
    onChange(state)
  }
  const confirm = (response, target) => {
    const enabled = parseAutoRenewStatus(response)
    update({
      phase: 'ready', enabled, target: null,
      error: target !== null && target !== enabled
        ? `设置未生效，当前仍为${enabled ? '开启' : '关闭'}状态。请再次点击开关重试。`
        : '',
    })
  }
  return {
    async read() {
      if (locked || disposed) return
      locked = true
      const target = state.target
      update({ phase: 'loading', error: '' })
      try {
        const response = await api.renewAutoStatus()
        if (!disposed) confirm(response, target)
      } catch (error) {
        update({ phase: 'error', error: `无法读取自动续费状态：${error.message || '请稍后重试'}。点击开关重新读取。` })
      } finally {
        locked = false
      }
    },
    async toggle() {
      if (locked || disposed || state.phase !== 'ready') return
      locked = true
      const target = !state.enabled
      let submitted = false
      update({ phase: 'saving', target, error: '' })
      try {
        const response = await api.renewAutoSet({ status: target ? 1 : 0 })
        if (disposed) return
        requireSuccess(response)
        submitted = true
        update({ phase: 'confirming' })
        const confirmation = await api.renewAutoStatus()
        if (!disposed) confirm(confirmation, target)
      } catch (error) {
        update({
          phase: 'error',
          error: submitted
            ? `设置已提交，但状态确认失败：${error.message || '请稍后重试'}。点击开关重新确认。`
            : `自动续费设置未完成：${error.message || '请稍后重试'}。点击开关重新读取状态后再操作。`,
        })
      } finally {
        locked = false
      }
    },
    dispose() { disposed = true },
  }
}
