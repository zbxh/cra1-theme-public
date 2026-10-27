import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createResourceRefreshController } from './resource-refresh'
import { REFRESH_INTERVALS } from './refresh-policy'

export const PanelRefreshContext = createContext(null)

export function usePanelRefresh({ enabled, scope }) {
  const controller = useMemo(() => createResourceRefreshController({
    isVisible: () => document.visibilityState !== 'hidden',
  }), [scope, enabled])
  const [summary, setSummary] = useState([])
  useEffect(() => {
    if (!enabled) return
    const unsubscribe = controller.subscribe(() => setSummary(controller.summary()))
    const visible = () => document.visibilityState === 'hidden' ? controller.pause() : controller.resume()
    const focus = () => controller.resume()
    document.addEventListener('visibilitychange', visible)
    window.addEventListener('focus', focus)
    controller.start()
    return () => {
      unsubscribe(); controller.destroy()
      document.removeEventListener('visibilitychange', visible)
      window.removeEventListener('focus', focus)
    }
  }, [controller, enabled])
  return { controller, summary }
}

export function usePanelReader({ controller: explicit, id, scope, fetch, apply, onError,
  interval = REFRESH_INTERVALS[id], activeInterval, pending, fingerprint, onSettled,
  initialData, readOnMount }) {
  const context = useContext(PanelRefreshContext)
  const controller = explicit || context
  const latest = useRef(null)
  latest.current = { fetch, apply, onError, pending, fingerprint, onSettled }
  useEffect(() => {
    if (!controller || !scope) return
    return controller.register(id, {
      scope, interval, activeInterval, initialData, readOnMount,
      read: arg => latest.current.fetch(arg), apply: data => latest.current.apply?.(data),
      onError: err => latest.current.onError?.(err), pending: data => latest.current.pending?.(data),
      fingerprint: data => latest.current.fingerprint ? latest.current.fingerprint(data) : data,
      onSettled: data => latest.current.onSettled?.(data),
    })
  }, [controller, id, scope])
  return controller
}
