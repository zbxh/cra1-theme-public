import { useEffect, useState } from 'react'

// Dialog reads distinguish an unavailable response from a successful empty list.
// Closing, changing the resource, or retrying invalidates the previous response.
export function useDialogRead(load, dependencies, enabled = true) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({ data: null, error: '', loading: enabled })
  useEffect(() => {
    let active = true
    setState({ data: null, error: '', loading: enabled })
    if (enabled) Promise.resolve().then(load).then(data => {
      if (active) setState({ data, error: '', loading: false })
    }).catch(error => {
      if (active) setState({ data: null, error: window.CRA1Shared?.Errors?.message(error) || '暂时无法读取内容，请稍后重试', loading: false })
    })
    return () => { active = false }
    // The caller explicitly lists the resource identity, just as with useEffect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, enabled, attempt])
  return { ...state, retry: () => setAttempt(value => value + 1) }
}
