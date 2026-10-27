import { useCallback, useRef, useState } from 'react'
import { usePanelReader } from './use-panel-refresh'

/** 后台读取保留内容；独立队列确保慢接口也能完成。 */
export function usePanelResource({ id, scope, fetch, pending, fingerprint, interval, activeInterval, readOnMount }) {
  const [state, setState] = useState({ id, scope, data: null, error: false })
  const activeScope = useRef(scope)
  activeScope.current = scope
  const controller = usePanelReader({
    id, scope, fetch, pending, fingerprint, interval, activeInterval, readOnMount,
    apply: data => setState({ id, scope, data, error: false }),
    onError: () => setState(old => ({ id, scope, data: old.scope === scope && old.id === id ? old.data : null, error: true })),
  })
  const load = useCallback(() => {
    if (activeScope.current) controller?.refresh([id])
  }, [controller, id])
  return { data: state.scope === scope && state.id === id ? state.data : null, error: state.scope === scope && state.id === id && state.error, load }
}
