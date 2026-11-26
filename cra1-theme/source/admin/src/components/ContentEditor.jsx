import { lazy, Suspense } from 'react'

const Editor = lazy(() => import('./content-editor/Editor'))

export default function ContentEditor(props) {
  return <Suspense fallback={<p role="status" className="text-sm text-muted">正在加载内容编辑器…</p>}><Editor {...props} /></Suspense>
}
