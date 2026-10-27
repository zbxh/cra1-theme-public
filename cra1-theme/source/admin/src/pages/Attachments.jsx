import { useEffect, useRef, useState } from 'react'
import { Upload, Search, Image, Pencil, Trash2, RotateCcw, Copy, Info, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@ui/button'
import { Input, Field } from '@ui/input'
import { Alert, Badge } from '@ui/feedback'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@ui/dialog'
import { useToast } from '@ui/toast'
import { mediaApi, bootInfo } from '../lib/api'
import './attachments.css'

const kindLabel = { theme: '主题图片', avatar: '会员头像', builtin: '系统图片' }
const pageSize = 36
function visiblePages(page, count, compact = false) {
  if (count <= (compact ? 3 : 7)) return Array.from({ length: count }, (_, i) => i + 1)
  const numbers = new Set([1, page, count])
  if (!compact) for (let n = Math.max(2, Math.min(page - 1, count - 4)); n <= Math.min(count - 1, Math.max(page + 1, 5)); n++) numbers.add(n)
  const pages = [], sorted = [...numbers].sort((a, b) => a - b)
  sorted.forEach((n, i) => {
    const previous = sorted[i - 1]
    if (!compact && n - previous === 2) pages.push(previous + 1)
    else if (n - previous > 1) pages.push(`gap-${n}`)
    pages.push(n)
  })
  return pages
}
const bytes = value => value < 1024 * 1024 ? `${Math.max(1, Math.round(value / 1024))} KB` : `${(value / 1024 / 1024).toFixed(1)} MB`
function AttachmentImage({ file }) {
  const [failed, setFailed] = useState(false)
  return failed ? <div className="attachment-trash-image"><Image /><span>图片暂时无法显示</span></div>
    : <img src={file.url} alt={file.name} loading="lazy" decoding="async" onError={() => setFailed(true)} />
}
export default function Attachments() {
  const manager = bootInfo.role !== 'operator', toast = useToast()
  const [kind, setKind] = useState('all'), [trash, setTrash] = useState(false), [search, setSearch] = useState('')
  const [items, setItems] = useState([]), [total, setTotal] = useState(0), [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1), [jump, setJump] = useState('1'), [jumpError, setJumpError] = useState(''), [refresh, setRefresh] = useState(0)
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [dialog, setDialog] = useState(null), [name, setName] = useState('')
  const file = useRef(), abort = useRef(), seq = useRef(0), timer = useRef(), previousQuery = useRef(), grid = useRef(), scrollToList = useRef(false)
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  function invalidate() {
    seq.current++; clearTimeout(timer.current); abort.current?.abort()
    setLoading(true); setItems([]); setError('')
  }
  async function load(targetPage = page) {
    clearTimeout(timer.current)
    abort.current?.abort(); const controller = new AbortController(); abort.current = controller
    const n = ++seq.current; let redirected = false; setLoading(true); setError(''); setItems([])
    try {
      const r = await mediaApi.attachments({ kind, trash, search, offset: (targetPage - 1) * pageSize }, { signal: controller.signal })
      if (r.status !== 200) throw new Error(r.msg)
      if (n === seq.current) {
        setTotal(r.data.total)
        const lastPage = Math.max(1, Math.ceil(r.data.total / pageSize))
        if (targetPage > lastPage) { redirected = true; scrollToList.current = true; setPage(lastPage) }
        else setItems(r.data.items)
      }
    } catch (e) { if (n === seq.current && e.name !== 'AbortError') setError(e.name === 'TypeError' ? '附件暂时无法读取，请检查网络后重试。' : e.message || '附件读取失败，请重试。') }
    finally { if (n === seq.current && !redirected) setLoading(false) }
  }
  useEffect(() => {
    const previous = previousQuery.current
    const filtersChanged = !previous || previous.kind !== kind || previous.trash !== trash || previous.search !== search
    const searchChanged = previous && previous.search !== search
    previousQuery.current = { kind, trash, search }
    // Cancel immediately; only typing a search waits for the debounce.
    invalidate(); setJump(String(page)); setJumpError('')
    if (filtersChanged) setTotal(0)
    timer.current = setTimeout(() => load(page), searchChanged ? 200 : 0)
    return () => { clearTimeout(timer.current); seq.current++; abort.current?.abort() }
  }, [kind, trash, search, page, refresh])
  useEffect(() => {
    if (!loading && !error && scrollToList.current) {
      scrollToList.current = false
      grid.current?.scrollIntoView({ block: 'start' })
      grid.current?.focus({ preventScroll: true })
    }
  }, [loading, error, items])
  function filter(nextKind, nextTrash = false) {
    if (nextKind === kind && nextTrash === trash && page === 1) return
    invalidate()
    scrollToList.current = false; setPage(1); setKind(nextKind); setTrash(nextTrash)
  }
  function goToPage(nextPage) {
    if (loading) return
    setJumpError(''); setJump(String(nextPage))
    if (nextPage === page) return
    invalidate(); scrollToList.current = true; setPage(nextPage)
  }
  function jumpToPage(event) {
    event.preventDefault()
    if (loading || !total) return
    const value = jump.trim(), nextPage = Number(value)
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(nextPage) || nextPage < 1 || nextPage > pageCount) {
      setJumpError(`请输入 1 至 ${pageCount} 之间的整数页码。`); return
    }
    goToPage(nextPage)
  }
  async function upload(event) {
    const f = event.target.files?.[0]; event.target.value = ''; if (!f || busy) return
    setBusy(true); setError('')
    try {
      if (f.size > 5 * 1024 * 1024) throw new Error('图片不能超过 5MB。')
      const r = await mediaApi.upload(f); if (r.status !== 200) throw new Error(r.msg)
      toast('图片已上传', 'success'); invalidate(); scrollToList.current = true; setPage(1); setRefresh(v => v + 1)
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }
  async function change() {
    if (!dialog || busy) return
    setBusy(true)
    try {
      const r = await mediaApi[dialog.action]({ id: dialog.file.id, ...(dialog.action === 'rename' ? { name } : {}) })
      if (r.status !== 200) throw new Error(r.msg)
      toast(r.msg, 'success'); invalidate(); setDialog(null); setRefresh(v => v + 1)
    } catch (e) { toast(e.message, 'error') }
    finally { setBusy(false) }
  }
  function pick(action, f) { setName(f.name); setDialog({ action, file: f }) }
  async function copy(url) {
    try { await navigator.clipboard.writeText(url); toast('图片地址已复制', 'success') }
    catch { setDialog({ action: 'copy', file: { url } }) }
  }
  const filters = [['all', '全部附件'], ['theme', '主题图片'], ...(manager ? [['avatar', '会员头像']] : []), ['builtin', '系统图片']]
  return <div className="attachments-page">
    <div className="attachments-heading"><div><h1>附件管理</h1><p>管理主题图片与会员头像，正在使用的附件不能删除。</p></div>
      <Button disabled={busy || trash} onClick={() => file.current?.click()}><Upload className="size-4" />{busy ? '处理中…' : '上传图片'}</Button>
      <input ref={file} type="file" className="hidden" accept="image/png,image/jpeg,image/webp,image/gif,image/x-icon,image/vnd.microsoft.icon" onChange={upload} aria-label="上传主题图片" />
    </div>
    <div className="attachments-toolbar">
      <div className="attachments-filters" aria-label="附件类型">{filters.map(([id, label]) => <Button key={id} size="sm" variant={kind === id && !trash ? 'default' : 'outline'} aria-pressed={kind === id && !trash} onClick={() => filter(id)}>{label}</Button>)}
        {manager && <Button size="sm" variant={trash ? 'default' : 'outline'} aria-pressed={trash} onClick={() => filter('all', true)}><Trash2 className="size-3.5" />回收站</Button>}
      </div>
      <div className="attachments-search"><Search className="size-4" /><Input aria-label="搜索附件" value={search} onChange={e => { invalidate(); scrollToList.current = false; setPage(1); setSearch(e.target.value) }} placeholder={kind === 'avatar' ? '搜索名称或会员 ID' : '搜索附件名称'} /></div>
    </div>
    {trash && <Alert>回收站中的文件已停止公开访问，可在这里恢复。</Alert>}
    {error && <Alert tone="error">{error}<Button variant="ghost" onClick={() => load()}>重试</Button></Alert>}
    <div className="attachments-grid" ref={grid} role="region" aria-label="附件列表" aria-busy={loading} tabIndex={-1}>{items.map(f => <article key={f.id} className="attachment-card">
      <button type="button" className="attachment-image" disabled={!!f.deleted_at} onClick={() => pick('detail', f)} aria-label={'查看附件：' + f.name}>
        {f.deleted_at ? <div className="attachment-trash-image"><Image /><span>已移入回收站</span></div> : <AttachmentImage file={f} />}
      </button>
      <div className="attachment-card__body"><h2 title={f.name}>{f.name}</h2><div className="attachment-meta"><span>{kindLabel[f.kind]}</span><span>{bytes(f.bytes)}</span></div>
        <div className="attachment-status">{f.kind === 'avatar' && <span>会员 #{f.owner_id}</span>}<Badge tone={f.in_use ? 'success' : 'muted'}>{f.in_use ? '使用中' : f.source === 'builtin' ? '只读' : f.deleted_at ? '回收站' : '未使用'}</Badge></div>
        <div className="attachment-actions">
          <Button size="sm" variant="ghost" onClick={() => pick('detail', f)}><Info className="size-3.5" />详情</Button>
          {!f.deleted_at && <Button size="sm" variant="ghost" onClick={() => copy(f.url)} aria-label={'复制地址：' + f.name}><Copy className="size-3.5" /></Button>}
          {f.source === 'managed' && !f.deleted_at && <Button size="sm" variant="ghost" onClick={() => pick('rename', f)} aria-label={'修改名称：' + f.name}><Pencil className="size-3.5" /></Button>}
          {manager && f.source === 'managed' && (f.deleted_at ? <Button size="sm" variant="outline" onClick={() => pick('restore', f)}><RotateCcw className="size-3.5" />恢复</Button> : <Button size="sm" variant="ghost" disabled={f.in_use} title={f.in_use ? '先更换正在使用的图片，再删除附件' : '移入回收站'} onClick={() => pick('delete', f)} aria-label={'移入回收站：' + f.name}><Trash2 className="size-3.5" /></Button>)}
        </div>
      </div>
    </article>)}</div>
    {loading && <p className="attachments-loading" role="status">正在读取附件…</p>}
    {!loading && !error && !items.length && <p className="attachments-empty">{search ? '没有找到相关附件，请换个关键词。' : trash ? '回收站是空的。' : '暂时没有附件。'}</p>}
    <div className="attachments-pagination">
      <span className="attachments-page-summary" role="status">共 {total} 项 · 第 {page} / {pageCount} 页</span>
      <nav className="attachments-page-nav" aria-label="附件分页">
        <Button size="sm" variant="outline" className="attachments-page-direction" aria-label="上一页" disabled={loading || page <= 1} onClick={() => goToPage(page - 1)}><ChevronLeft /><span>上一页</span></Button>
        {[false, true].map(compact => <span key={String(compact)} className={`attachments-page-list attachments-page-list--${compact ? 'compact' : 'full'}`}>
          {visiblePages(page, pageCount, compact).map(n => typeof n === 'number'
            ? <Button key={n} size="sm" className="attachments-page-number" variant={page === n ? 'default' : 'outline'} aria-label={`第 ${n} 页`} aria-current={page === n ? 'page' : undefined} disabled={loading} onClick={() => goToPage(n)}>{n}</Button>
            : <span key={n} className="attachments-page-gap" aria-hidden="true">…</span>)}
        </span>)}
        <Button size="sm" variant="outline" className="attachments-page-direction" aria-label="下一页" disabled={loading || page >= pageCount} onClick={() => goToPage(page + 1)}><span>下一页</span><ChevronRight /></Button>
      </nav>
      <form className="attachments-page-jump" onSubmit={jumpToPage} noValidate>
        <label htmlFor="attachments-jump">跳至</label><Input id="attachments-jump" aria-label="跳转页码" inputMode="numeric" autoComplete="off" value={jump} disabled={loading || !total} aria-invalid={!!jumpError} aria-describedby={jumpError ? 'attachments-jump-error' : undefined} onChange={e => { setJump(e.target.value); setJumpError('') }} /><span>页</span>
        <Button size="sm" type="submit" variant="outline" disabled={loading || !total}>跳转</Button>
      </form>
      {jumpError && <p id="attachments-jump-error" className="attachments-page-error" role="alert">{jumpError}</p>}
    </div>
    <Dialog open={!!dialog} onOpenChange={v => { if (!v && !busy) setDialog(null) }}><DialogContent className="attachment-dialog">
      <DialogHeader><DialogTitle>{({ detail: '附件详情', rename: '修改附件名称', delete: '移入回收站', restore: '恢复附件', copy: '复制图片地址' })[dialog?.action] || '附件'}</DialogTitle><DialogDescription>{dialog?.action === 'delete' ? '文件会停止公开访问，需要时可以从回收站恢复。' : dialog?.action === 'rename' ? '只修改管理名称，原图片地址保持不变。' : '查看附件信息。'}</DialogDescription></DialogHeader>
      {dialog?.action === 'rename' ? <Field label="附件名称" htmlFor="attachment-name"><Input id="attachment-name" maxLength={120} value={name} onChange={e => setName(e.target.value)} /></Field> : dialog?.action === 'detail' ? <div className="attachment-detail">
        {!dialog.file.deleted_at && <img src={dialog.file.url} alt={dialog.file.name} />}
        <dl><dt>名称</dt><dd>{dialog.file.name}</dd><dt>来源</dt><dd>{kindLabel[dialog.file.kind]}{dialog.file.kind === 'avatar' ? ` · 会员 #${dialog.file.owner_id}` : ''}</dd><dt>大小 / 尺寸</dt><dd>{bytes(dialog.file.bytes)} · {dialog.file.width} × {dialog.file.height}</dd><dt>上传时间</dt><dd>{new Date(dialog.file.created_at * 1000).toLocaleString('zh-CN', { hour12: false })}</dd><dt>使用位置</dt><dd>{dialog.file.references?.join('、') || '未使用'}</dd><dt>地址</dt><dd>{dialog.file.url}</dd></dl>
      </div> : dialog?.action === 'copy' ? <Input aria-label="图片地址" readOnly value={dialog.file.url} onFocus={e => e.target.select()} /> : <p className="attachment-confirm-name">{dialog?.file.name}</p>}
      <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setDialog(null)}>{['detail', 'copy'].includes(dialog?.action) ? '关闭' : '取消'}</Button>{['rename', 'delete', 'restore'].includes(dialog?.action) && <Button variant={dialog.action === 'delete' ? 'danger' : 'default'} disabled={busy || dialog.action === 'rename' && !name.trim()} onClick={change}>{busy ? '处理中…' : dialog.action === 'delete' ? '移入回收站' : dialog.action === 'restore' ? '确认恢复' : '保存名称'}</Button>}</DialogFooter>
    </DialogContent></Dialog>
  </div>
}
