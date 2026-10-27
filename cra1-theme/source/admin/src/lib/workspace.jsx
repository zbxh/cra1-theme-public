import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { workspaceApi, bootInfo } from './api'

import { clone, equal, changes, editorChanges, threeWay, setAt } from './workspace-state.js'
import { migrateEditorDrafts } from './legacy-drafts.js'
export { clone, equal, changes, editorChanges, threeWay, setAt } from './workspace-state.js'
const Context = createContext(null)
const sessionKey = `cra1-workspace-v3:${bootInfo.user_id}`
const assertResponse = (r) => { if (r.status !== 200) { const e = new Error(r.msg || '请求失败'); e.status = r.status; e.data = r.data; throw e } return r.data }

export function WorkspaceProvider({ children }) {
  const [records, setRecords] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(sessionKey) || '{}') } catch { return {} }
  })
  const ref = useRef(records)
  const flights = useRef(new Map())
  const [persistenceError, setPersistenceError] = useState('')
  const update = useCallback((id, fn) => {
    setRecords((old) => {
      const next = { ...old, [id]: fn(old[id] || {}) }
      ref.current = next
      return next
    })
  }, [])
  useEffect(() => {
    ref.current = records
    try {
      const dirty = {}
      for (const [id, r] of Object.entries(records)) {
        if (r.values && r.original && !equal(r.values, r.original)) dirty[id] = { domain: r.domain, scopeId: id, values: r.values, original: r.original, revision: r.revision, revisions:r.revisions || r.data?.revisions }
      }
      sessionStorage.setItem(sessionKey, JSON.stringify(dirty))
      setPersistenceError('')
    } catch { setPersistenceError('浏览器无法缓存草稿；当前草稿仍保留，刷新前请保存。') }
  }, [records])
  useEffect(() => {
    const leave = (e) => { if (Object.values(ref.current).some((r) => r.values && r.original && !equal(r.values, r.original))) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', leave)
    return () => window.removeEventListener('beforeunload', leave)
  }, [])
  const load = useCallback((domain, id, force = false, discard = false) => {
    if (flights.current.has(id)) return flights.current.get(id)
    if (ref.current[id]?.loaded && !force) return Promise.resolve(ref.current[id])
    update(id, (r) => ({ ...r, domain, loading: true, error: '' }))
    const task = (id.startsWith('editor:') ? workspaceApi.editorGet(domain,id.slice(('editor:'+domain+':').length)) : workspaceApi.get(domain, id)).then(assertResponse).then((data) => {
      if(id.startsWith('editor:')){const migrated=migrateEditorDrafts(ref.current,domain,data);if(migrated.record){ref.current=migrated.records;setRecords(migrated.records)}}
      update(id, (r) => {
        const dirty = !discard && r.values && r.original && !equal(r.values, r.original)
        return { ...r, domain, data, loading: false, loaded: true, error: '',
          values: dirty ? r.values : clone(data.values), original: dirty ? r.original : clone(data.values),
          revision: dirty ? r.revision : data.revision,
          revisions: dirty ? r.revisions : data.revisions,
          remote: dirty && (r.revision !== data.revision || r.migrated && !equal(r.original,data.values)) ? data : null }
      })
      return data
    }).catch((e) => { update(id, (r) => ({ ...r, loading: false, error: e.message })); throw e }).finally(() => flights.current.delete(id))
    flights.current.set(id, task)
    return task
  }, [update])
  const save = useCallback(async (domain, id) => {
    const r = ref.current[id]
    if (!r?.data || r.saving || r.error) return
    const patch = id.startsWith('editor:') ? editorChanges(r.original, r.values) : changes(r.original, r.values)
    if (!Object.keys(patch).length) return
    update(id, (old) => ({ ...old, saving: true, saveError: '', savedMessage: '' }))
    try {
      const response = id.startsWith('editor:') ? await workspaceApi.editorSave({domain,editorId:id.slice(('editor:'+domain+':').length),expectedRevisions:r.revisions || r.data.revisions,patch}) : await workspaceApi.save({ domain, scopeId: id, expectedRevision: r.revision, patch })
      if (response.status === 409) {
        update(id, (old) => ({ ...old, saving: false, remote: response.data, saveError: response.msg }))
        return
      }
      const data = assertResponse(response)
      update(id, (old) => ({ ...old, data, revision: data.revision, revisions:data.revisions, values: clone(data.values), original: clone(data.values),
        remote: null, migrated:false, saving: false, saveError: '', savedMessage: data.snapshot_ok === false ? '配置已保存，前台同步失败，请重试同步。' : response.msg }))
      setRecords((old) => {
        const next = { ...old }
        for (const [key, entry] of Object.entries(next)) {
          if (entry.domain === domain && entry.data && data.version != null) next[key] = { ...entry, data: { ...entry.data, version: data.version } }
        }
        ref.current = next
        return next
      })
      // Refresh inherited values without replacing other scopes' local drafts.
      await Promise.allSettled(Object.entries(ref.current).filter(([key,entry]) => key !== id && entry.domain === domain && entry.loaded)
        .map(([key]) => load(domain, key, true)))
    } catch (e) { update(id, (old) => ({ ...old, saving: false, saveError: e.message })) }
  }, [update, load])
  const clear = useCallback(() => { sessionStorage.removeItem(sessionKey); sessionStorage.removeItem(`${sessionKey}:route`); setRecords({}); ref.current = {} }, [])
  return <Context.Provider value={{ records, update, load, save, clear, persistenceError, sessionKey }}>{children}</Context.Provider>
}
export function useWorkspaces() { return useContext(Context) }
export function useWorkspace(domain, id) {
  const ctx = useWorkspaces()
  const record = ctx.records[id] || {}
  useEffect(() => { ctx.load(domain, id).catch(() => {}) }, [ctx.load, domain, id])
  return { ...record, domain, id, dirty: !!record.values && !equal(record.values, record.original),
    loading: record.loading || !record.data && !record.error,
    setValues: (fn) => ctx.update(id, (r) => r.saving ? r : ({ ...r, values: typeof fn === 'function' ? fn(r.values) : fn, savedMessage: '' })),
    save: () => ctx.save(domain, id),
    setBusy: (saving) => ctx.update(id, (r) => ({ ...r, saving })),
    noteSyncFailure: () => ctx.update(id, (r) => ({ ...r, data: { ...r.data, snapshot_ok: false },
      savedMessage: '配置已保存，前台同步失败，请重试同步。' })),
    reload: (discard = false) => ctx.load(domain, id, true, discard),
    revert: () => ctx.update(id, (r) => ({ ...r, values: clone(r.original), saveError: '', savedMessage: '' })),
    rebase: (values) => ctx.update(id, (r) => ({ ...r, values, original: clone(r.remote.values), revision: r.remote.revision, revisions:r.remote.revisions,
      data: { ...r.data, ...r.remote }, remote: null, saveError: '', savedMessage: '差异已合并，请检查后保存。' })),
  }
}
export function useScopedState(workspace, path, initial, original = false) {
  const local = useState(initial)
  if (!workspace) return local
  const parts = path ? path.split('.') : []
  const source = original ? workspace.original : workspace.values
  const value = parts.reduce((v, key) => v?.[key], source) ?? initial
  return [value, (next) => {
    if (original) return
    workspace.setValues((current) => {
      const prev = parts.reduce((v, key) => v?.[key], current) ?? initial
      return setAt(current, parts, typeof next === 'function' ? next(prev) : next)
    })
  }]
}
export const rememberRoute = (route) => { try { sessionStorage.setItem(`${sessionKey}:route`, route) } catch {} }
export const restoredRoute = () => { try { return sessionStorage.getItem(`${sessionKey}:route`) } catch { return null } }
