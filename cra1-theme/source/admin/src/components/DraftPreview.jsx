import { useEffect, useRef, useState } from 'react'
import { Eye, Monitor, Smartphone, RefreshCw } from 'lucide-react'
import { Button } from '@ui/button'
import { Alert } from '@ui/feedback'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@ui/dialog'
import { workspaceApi } from '../lib/api'
import { useWorkspaces, editorChanges, equal } from '../lib/workspace'

export default function DraftPreview({ workspace, editorId, cartTarget }) {
  const ctx = useWorkspaces()
  const [open, setOpen] = useState(false)
  const [mobile, setMobile] = useState(false)
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [retry, setRetry] = useState(0)
  const frame = useRef(null)
  const nonce = useRef('')
  const values = JSON.stringify(workspace.values)
  const cartSelection = JSON.stringify(cartTarget?.selection || {})
  const isCartList = workspace.domain === 'cart' && editorId === 'goodslist'

  useEffect(() => {
    if (!open) return
    let active = true
    setUrl('')
    setLoading(true)
    setError('')
    const timer = setTimeout(async () => {
      const related = {}
      for (const [id, record] of Object.entries(ctx.records)) {
        if (id !== workspace.id && id.startsWith('editor:' + workspace.domain + ':')
          && record.data?.editor.kind === 'public' && record.values && !equal(record.values, record.original)) {
          related[record.data.editorId] = editorChanges(record.original, record.values)
        }
      }
      try {
        const result = await workspaceApi.preview({
          domain: workspace.domain, editorId, patch: editorChanges(workspace.original, workspace.values), related,
          ...(isCartList ? { cartSelection: JSON.parse(cartSelection) } : {}),
        })
        if (!active) return
        if (result.status !== 200) throw new Error(result.msg)
        nonce.current = result.data.nonce
        setUrl(result.data.url)
      } catch (error) {
        if (active) { setError(error.message); setLoading(false) }
      }
    }, 250)
    return () => { active = false; clearTimeout(timer) }
  }, [open, values, retry, cartSelection])

  useEffect(() => {
    if (!open || !url) return
    let refreshTimer
    const timeout = setTimeout(() => {
      setError('预览加载超时，请重试。')
      setLoading(false)
    }, 20000)
    function receive(event) {
      const message = event.data
      if (event.source !== frame.current?.contentWindow || event.origin !== 'null' || !message
        || message.type !== 'theme-preview' || message.nonce !== nonce.current || !['ready', 'error'].includes(message.state)) return
      clearTimeout(timeout)
      setLoading(false)
      if (message.state === 'error') setError('预览暂时无法显示，请重试。')
      if (isCartList && message.state === 'ready' && Number.isFinite(message.refreshAfter) && message.refreshAfter > 0) {
        clearTimeout(refreshTimer)
        const delay = Math.min(2147483647, message.refreshAfter * 1000)
        refreshTimer = setTimeout(() => setRetry(value => value + 1), delay)
      }
    }
    window.addEventListener('message', receive)
    return () => {
      clearTimeout(timeout)
      clearTimeout(refreshTimer)
      window.removeEventListener('message', receive)
    }
  }, [open, url, isCartList])

  const description = workspace.domain === 'website' ? '展示当前未保存修改，正式页面保持原样。'
    : isCartList ? '使用示例商品展示草稿。顶部说明预览范围为「' + (cartTarget?.selection ? cartTarget.path : '全局说明') + '」。'
    : '展示当前未保存修改，使用示例数据。'

  return <>
    <Button variant="outline" disabled={workspace.saving} onClick={() => setOpen(true)}><Eye className="size-4" />预览效果</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="preview-dialog">
      <DialogHeader><DialogTitle>预览效果</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant={!mobile ? 'secondary' : 'ghost'} onClick={() => setMobile(false)}><Monitor className="size-4" />桌面</Button>
        <Button variant={mobile ? 'secondary' : 'ghost'} onClick={() => setMobile(true)}><Smartphone className="size-4" />手机</Button>
        <Button variant="ghost" onClick={() => setRetry(value => value + 1)}><RefreshCw className="size-4" />刷新预览</Button>
        {loading && <span className="text-sm text-muted-foreground" role="status">正在生成效果…</span>}
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      <div className={`preview-stage ${mobile ? 'mobile-preview' : ''}`}>
        {url && <iframe key={url} title="当前配置效果预览" src={url} ref={frame} sandbox="allow-scripts"
          onError={() => { setError('页面预览加载失败'); setLoading(false) }} />}
      </div>
    </DialogContent></Dialog>
  </>
}
