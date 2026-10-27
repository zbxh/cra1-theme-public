export function isPaymentPaid(response) {
  if (response?.status != null && Number(response.status) !== 200) return false
  return (response?.code ?? response?.data?.code ?? response?.data?.status) === 'Paid'
}

/** 支付确认独立于面板渲染，慢响应不重叠，关闭后禁止迟到回调。 */
export function createPaymentPoller({ read, onPaid, onError, isVisible = () => true,
  setTimer = setTimeout, clearTimer = clearTimeout, interval = 3000 }) {
  let timer = null, stopped = false, running = false, abort
  const cancel = () => { if (timer !== null) clearTimer(timer); timer = null }
  const schedule = () => {
    cancel()
    if (!stopped && isVisible()) timer = setTimer(run, interval)
  }
  async function run() {
    cancel()
    if (stopped || running || !isVisible()) return
    running = true; abort = new AbortController()
    try {
      const response = await read(abort.signal)
      if (stopped) return
      if (isPaymentPaid(response)) {
        stopped = true; onPaid()
      } else onError?.(null)
    } catch (error) {
      if (!stopped) {
        onError?.(error)
        // 系统约定业务 400 停止自动轮询；网络失败保留重试。
        if (Number(error?.data?.status) === 400) stopped = true
      }
    } finally { running = false; schedule() }
  }
  return {
    start: schedule, resume: () => { if (!running) void run() }, pause: cancel,
    retry: () => { stopped = false; if (!running) void run() },
    destroy: () => { stopped = true; abort?.abort(); cancel() },
  }
}
