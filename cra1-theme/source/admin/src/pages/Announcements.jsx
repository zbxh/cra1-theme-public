import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Copy, Eye, Plus, Trash2 } from 'lucide-react'
import { Button } from '@ui/button'
import { Input, Label, Textarea } from '@ui/input'
import { MenuSelect as Select } from '@ui/select'
import { Card, CardHeader, CardTitle, CardContent } from '@ui/card'
import { Alert, Badge } from '@ui/feedback'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@ui/dialog'
import WorkspaceFrame from '../components/WorkspaceFrame'
import RichText from '../components/RichText'
import IconPicker from '../ui/IconPicker'
import SwitchControl from '../ui/Switch'
import LinkPicker from './LinkPicker'
import { DragHandle, DropBadge, DRAG_LIST_BASE, RowIconBtn, dragRowClass, useFlatDrag, DragAnnouncer } from '../ui/dragSort'
import { api } from '../lib/api'
import { useWorkspaces } from '../lib/workspace'
import { announcementDrafts, importedAnnouncementItems, consumeAnnouncementDraft } from '../lib/announcement-legacy'
import './announcements.css'

const THEMES = { website: '官网主题', member: '会员中心', cart: '购物车' }
const clone = value => JSON.parse(JSON.stringify(value))
const newId = () => 'notice-' + crypto.randomUUID()
const emptyTargets = () => Object.fromEntries(Object.keys(THEMES).map(theme => [theme, { all: false, pages: [] }]))
const newItem = () => ({ id: newId(), title: '', label: '通知', icon: 'megaphone', summary: '', detail: '', action: 'detail', action_label: '查看详情', url: '', new_tab: false, targets: { ...emptyTargets(), member: { all: true, pages: [] } }, starts_at: '', ends_at: '', priority: 0, dismissible: true, dismiss_for: 'day', enabled: true, extra_actions: [] })
function Field({ label, children, hint }) {
  return <div className="announcement-field space-y-1.5"><Label className="block">{label}</Label>{children}{hint && <p className="text-xs leading-5 text-muted-foreground">{hint}</p>}</div>
}
function Switch({ label, ...props }) {
  return <div className="flex items-center justify-between gap-3 text-sm"><span>{label}</span><SwitchControl label={label} {...props} /></div>
}
function TargetCheck({ mixed = false, ...props }) {
  const ref = useRef()
  useEffect(() => { if (ref.current) ref.current.indeterminate = mixed }, [mixed])
  return <input ref={ref} type="checkbox" {...props} />
}
function targetSummary(item) {
  return Object.entries(THEMES).flatMap(([theme, label]) => item.targets?.[theme]?.all ? [label + '全部页面'] : item.targets?.[theme]?.pages?.length ? [label + ' ' + item.targets[theme].pages.length + ' 页'] : []).join('、') || '未选择显示页面'
}
function audience(item, pages) {
  const publicTarget = ['website', 'cart'].some(theme => item.targets?.[theme]?.all || item.targets?.[theme]?.pages?.some(id => pages.some(page => page.theme === theme && page.id === id)))
  return publicTarget ? '公开可见（无需登录）' : '仅登录会员可见'
}
function status(item, siteTime) {
  if (!item.enabled) return '已停用'
  const now = new Date()
  // Status text is an editing aid. The server alone decides public visibility.
  const local = siteTime || [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-') + 'T' + now.toTimeString().slice(0, 8)
  if (item.starts_at && item.starts_at > local) return '未开始'
  if (item.ends_at && item.ends_at <= local) return '已到期'
  return '生效中'
}

export function PageTargets({ value, onChange, pages }) {
  const [search, setSearch] = useState('')
  const setTheme = (theme, target) => onChange({ ...value, [theme]: target })
  const togglePages = (theme, ids, checked) => {
    const current = value[theme] || { all: false, pages: [] }
    const selected = new Set(current.all ? pages.filter(page => page.theme === theme).map(page => page.id) : current.pages)
    ids.forEach(id => checked ? selected.add(id) : selected.delete(id))
    setTheme(theme, { all: false, pages: [...selected] })
  }
  return <div className="space-y-3">
    <div className="announcement-target-tools"><Input className="min-w-0 flex-1" aria-label="搜索显示页面" placeholder="搜索页面，例如：首页、工单、结算" value={search} onChange={event => setSearch(event.target.value)} /><Button variant="outline" size="sm" onClick={() => onChange(Object.fromEntries(Object.keys(THEMES).map(theme => [theme, { all: true, pages: [] }])))}>全选三个主题</Button><Button variant="ghost" size="sm" onClick={() => onChange(emptyTargets())}>清空</Button></div>
    {Object.entries(THEMES).map(([theme, label]) => {
      const target = value[theme] || { all: false, pages: [] }, allPages = pages.filter(page => page.theme === theme)
      const shown = allPages.filter(page => !search || (label + page.category + page.label).includes(search))
      const categories = [...new Set(shown.map(page => page.category))]
      const missing = target.pages.filter(id => !allPages.some(page => page.id === id))
      return <details key={theme} open className="announcement-target-theme rounded-lg border border-line p-3"><summary className="cursor-pointer text-sm font-medium">{label}<span className="ml-2 text-xs font-normal text-muted-foreground">{target.all ? '全部页面（包含以后新增页面）' : `已选 ${target.pages.length} 页`}</span></summary>
        <label className="mt-3 flex items-center gap-2 text-sm"><TargetCheck checked={target.all} mixed={!target.all && target.pages.length > 0} onChange={event => setTheme(theme, { all: event.target.checked, pages: [] })} />本主题全部页面，包含以后新增页面</label>
        <div className="announcement-target-pages mt-3 space-y-3">{categories.map(category => {
          const group = shown.filter(page => page.category === category), checked = target.all || group.every(page => target.pages.includes(page.id))
          return <div key={category}><label className="flex items-center gap-2 text-xs font-medium"><TargetCheck checked={checked} mixed={!checked && group.some(page => target.pages.includes(page.id))} onChange={event => togglePages(theme, group.map(page => page.id), event.target.checked)} />{category}<span className="font-normal text-muted-foreground">{group.length} 页</span></label><div className="announcement-target-grid mt-2">{group.map(page => <label key={page.id} className="flex items-start gap-2 text-xs leading-5"><TargetCheck className="mt-1" checked={target.all || target.pages.includes(page.id)} onChange={event => togglePages(theme, [page.id], event.target.checked)} />{page.label}</label>)}</div></div>
        })}{!shown.length && <p className="text-xs text-muted-foreground">没有匹配的页面</p>}{missing.map(id => <div key={id} className="flex items-center justify-between gap-2 text-xs"><span>原选页面当前不可用，选择已保留</span><Button size="sm" variant="ghost" onClick={() => togglePages(theme, [id], false)}>移除此选择</Button></div>)}</div>
      </details>
    })}
  </div>
}

function AnnouncementPreview({ workspace: w }) {
  const [open, setOpen] = useState(false), [theme, setTheme] = useState('member'), [pageId, setPageId] = useState('home'), [mobile, setMobile] = useState(false), [retry, setRetry] = useState(0), [error, setError] = useState(''), [loading, setLoading] = useState(false), [html, setHtml] = useState('')
  const frame = useRef(), sequence = useRef(0), nonce = useRef('')
  const pages = w.data.pages.filter(page => page.theme === theme), page = pages.find(entry => entry.id === pageId) || pages[0]
  const serialized = JSON.stringify(w.values)
  useEffect(() => {
    if (!open || !page) return
    const id = ++sequence.current, controller = new AbortController()
    setLoading(true); setError(''); setHtml('')
    const timeout = setTimeout(async () => {
      try {
        const response = await api('api.announcements.preview', { values: w.values, theme, path: page.paths[0] }, { signal: controller.signal })
        if (response.status !== 200) throw new Error(response.msg)
        if (id !== sequence.current) return
        nonce.current = crypto.randomUUID()
        const encoded = JSON.stringify({ payload: response.data, theme, nonce: nonce.current }).replace(/</g, '\\u003c').replace(/&/g, '\\u0026')
        const origin = window.location.origin
        // srcDoc inherits the admin CSP. Authorize its scripts with the current
        // document nonce while retaining the opaque allow-scripts-only sandbox.
        const scriptNonce = document.querySelector('script[nonce]')?.nonce || ''
        const nonceAttribute = /^[A-Za-z0-9+/_=-]+$/.test(scriptNonce) ? ` nonce="${scriptNonce}"` : ''
        setHtml(`<!doctype html><html data-cra1-theme="${theme}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${origin}${response.data.assets.css}"><style>body{margin:0;min-height:100vh;background:#f4f5f7}#empty{padding:36px;text-align:center;color:#61656b;font:14px sans-serif}</style></head><body><div id="notice"></div><p id="empty" hidden>当前页面没有生效中的通知。请检查启用开关、显示页面和时间。</p><script${nonceAttribute} src="${origin}${response.data.assets.js}"><\/script><script${nonceAttribute}>var state=${encoded};try{CRA1Shared.Notices.mount(document.getElementById('notice'),{theme:state.theme,payload:state.payload,preview:true});document.getElementById('empty').hidden=state.payload.items.length>0;document.addEventListener('click',function(e){var a=e.target.closest('a');if(a&&a.getAttribute('href')!=='#')e.preventDefault()});parent.postMessage({type:'cra1-notice-preview',nonce:state.nonce,state:'ready'},'*')}catch(e){parent.postMessage({type:'cra1-notice-preview',nonce:state.nonce,state:'error'},'*')}<\/script></body></html>`)
      } catch (e) { if (id === sequence.current && e.name !== 'AbortError') { setError(e.message); setLoading(false) } }
    }, 250)
    return () => { clearTimeout(timeout); controller.abort(); sequence.current++ }
  }, [open, theme, page?.id, serialized, retry])
  useEffect(() => {
    if (!open || !html) return
    const timeout = setTimeout(() => { setError('预览加载超时，请重试'); setLoading(false) }, 15000)
    const receive = event => { if (event.source !== frame.current?.contentWindow || event.origin !== 'null' || event.data?.type !== 'cra1-notice-preview' || event.data?.nonce !== nonce.current) return; clearTimeout(timeout); setLoading(false); if (event.data.state !== 'ready') setError('预览暂时无法显示，请重试') }
    window.addEventListener('message', receive)
    return () => { clearTimeout(timeout); window.removeEventListener('message', receive) }
  }, [open, html])
  return <><Button variant="outline" disabled={w.saving} onClick={() => setOpen(true)}><Eye className="size-4" />预览效果</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="preview-dialog announcement-preview-dialog"><DialogHeader><DialogTitle>通知效果预览</DialogTitle><DialogDescription>使用当前草稿、所选页面与服务器时间生成效果。关闭记忆仅在本次预览中生效。</DialogDescription></DialogHeader><div className="announcement-preview-tools"><Field label="主题"><Select aria-label="预览主题" value={theme} onChange={event => { setTheme(event.target.value); setPageId('') }}>{Object.entries(THEMES).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</Select></Field><Field label="显示页面"><Select aria-label="预览显示页面" value={page?.id || ''} onChange={event => setPageId(event.target.value)}>{pages.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</Select></Field><div className="announcement-preview-buttons"><Button variant="outline" onClick={() => setMobile(!mobile)}>{mobile ? '切换桌面' : '切换手机'}</Button><Button variant="ghost" onClick={() => setRetry(retry + 1)}>刷新预览</Button></div></div>{loading && <p role="status" className="text-sm text-muted-foreground">正在生成效果…</p>}{error && <Alert tone="error">页面错误，请刷新重试</Alert>}<div className={`preview-stage ${mobile ? 'mobile-preview' : ''}`}>{html && <iframe ref={frame} title="通知草稿预览" srcDoc={html} sandbox="allow-scripts" />}</div></DialogContent></Dialog></>
}

function Editor({ w }) {
  const context=useWorkspaces(),legacy=announcementDrafts(context.records)
  const [recovering,setRecovering]=useState(false),[recoveryError,setRecoveryError]=useState('')
  const values = w.values, items = values.items || []
  const [selected, setSelected] = useState(items[0]?.id), [search, setSearch] = useState(''), [deleting, setDeleting] = useState(null), [live, setLive] = useState('')
  const item = items.find(row => row.id === selected) || items[0]
  const set = patch => w.setValues(current => ({ ...current, ...patch }))
  const setItems = next => set({ items: next })
  const update = patch => setItems(items.map(row => row.id === item.id ? { ...row, ...patch } : row))
  const move = (from, to) => { if (from < 0 || to < 0 || from >= items.length || to >= items.length || from === to) return; const next = items.slice(), [row] = next.splice(from, 1); next.splice(to, 0, row); setItems(next) }
  const drag = useFlatDrag({ count: () => items.length, onMove: move, keyOf: row => row.id, onAnnounce: setLive, onPickup: () => clone(items), onCancel: snapshot => snapshot && setItems(snapshot) })
  const add = source => { const row = source ? { ...clone(source), id: newId(), title: source.title + '（副本）' } : newItem(); delete row.revision; delete row.published_at; setItems([...items, row]); setSelected(row.id); setSearch('') }
  return <>
    {!!legacy.length && <Alert tone="warning"><p>检测到旧通知入口中尚未保存的草稿，可恢复到当前通知列表后检查并保存。</p><Button variant="outline" className="mt-2" disabled={recovering} onClick={async()=>{
      setRecovering(true);setRecoveryError('')
      try {
        let recovered=items
        for(const draft of legacy){const response=await api('api.announcements.legacy-draft',draft);if(response.status!==200)throw new Error(response.msg);recovered=importedAnnouncementItems(recovered,response.data)}
        sessionStorage.setItem(context.sessionKey+':announcement-recovery',JSON.stringify(legacy))
        setItems(recovered)
        for(const draft of legacy)context.update(draft.id,record=>consumeAnnouncementDraft(record,draft))
      } catch(error){setRecoveryError(error.message)} finally{setRecovering(false)}
    }}>{recovering?'正在恢复…':'恢复旧通知草稿'}</Button>{recoveryError&&<p className="mt-2">{recoveryError}</p>}</Alert>}
    <Card><CardHeader><CardTitle>展示设置</CardTitle></CardHeader><CardContent className="announcement-settings"><Switch label="启用通知" checked={values.enabled} onCheckedChange={enabled => set({ enabled })} /><Field label="自动切换间隔（秒）"><Input aria-label="自动切换间隔（秒）" className="w-24" type="number" min="3" max="300" value={values.interval} onChange={event => set({ interval: event.target.value === '' ? '' : Number(event.target.value) })} /></Field><AnnouncementPreview workspace={w} /></CardContent></Card>
    <div className="announcement-layout"><div className="announcement-list-panel min-w-0 space-y-3"><div className="flex items-center justify-between gap-2"><h2 className="font-semibold">通知列表 <span className="text-sm font-normal text-muted-foreground">{items.length} / {w.data.max_items}</span></h2><Button size="sm" variant="outline" disabled={items.length >= w.data.max_items} onClick={() => add()}><Plus className="size-4" />添加通知</Button></div><Input aria-label="搜索通知" placeholder="搜索标题或分类" value={search} onChange={event => setSearch(event.target.value)} /><p className="text-xs leading-5 text-muted-foreground">先按优先级从高到低展示，同级按列表顺序轮播。拖动手柄或使用上下移按钮排序。</p>
      <ul className={DRAG_LIST_BASE+' announcement-list'}>{items.map((row, index) => (!search || (row.title + row.label).includes(search)) && <li key={row.id} draggable={!search} {...drag.itemProps(index)} className={dragRowClass({ isDragging: drag.isDragging(index), isOver: drag.isOver(index), className: `!h-auto min-h-20 !flex-wrap !px-2 !py-2 ${item?.id === row.id ? 'bg-brand/5' : ''}` })}><DragHandle {...drag.handleProps(index, '拖拽排序：' + (row.title || '未命名通知'))} /><button type="button" className="min-w-0 flex-1 text-left" onClick={() => setSelected(row.id)} aria-current={item?.id === row.id ? 'true' : undefined}><span className="block truncate text-sm font-medium">{row.title || '未命名通知'}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{targetSummary(row)}</span></button><Badge tone={row.enabled ? 'default' : 'warning'}>{status(row, w.data.site_time)}</Badge><div className="flex w-full items-center justify-end"><span className="mr-auto pl-6 text-xs text-muted-foreground">优先级 {row.priority}</span><RowIconBtn label="上移通知" disabled={index === 0} onClick={() => move(index, index - 1)}><ArrowUp className="size-3.5" /></RowIconBtn><RowIconBtn label="下移通知" disabled={index === items.length - 1} onClick={() => move(index, index + 1)}><ArrowDown className="size-3.5" /></RowIconBtn><RowIconBtn label="复制通知" disabled={items.length >= w.data.max_items} onClick={() => add(row)}><Copy className="size-3.5" /></RowIconBtn><RowIconBtn label="删除通知" danger onClick={() => setDeleting(row)}><Trash2 className="size-3.5" /></RowIconBtn>{drag.isOver(index) && <DropBadge pos={drag.dropPos} />}</div></li>)}</ul>{!items.length && <p className="rounded-lg border border-dashed border-line p-5 text-sm text-muted-foreground">添加第一条通知后，选择需要显示的主题和页面。</p>}<DragAnnouncer message={live} />
    </div><div className="min-w-0 space-y-4">{item ? <>
      <Card><CardHeader><CardTitle className="announcement-item-title">{item.title || '新通知'}</CardTitle></CardHeader><CardContent className="space-y-4"><Switch label="启用此通知" checked={item.enabled} onCheckedChange={enabled => update({ enabled })} /><Field label="通知标题"><Input aria-label="通知标题" value={item.title} maxLength={160} onChange={event => update({ title: event.target.value })} /></Field><div className="announcement-fields-grid"><Field label="分类文字"><Input aria-label="分类文字" value={item.label} maxLength={24} placeholder="通知、维护、活动…" onChange={event => update({ label: event.target.value })} /></Field><Field label="通知图标"><IconPicker styledSelect label="通知图标" context="website" tile={false} value={item.icon} onChange={icon => update({ icon })} /></Field></div><Field label="简短说明（可选）" hint="与标题同一行显示；留空时自动提取通知内容的纯文本。"><Textarea aria-label="简短说明" value={item.summary} maxLength={400} rows={2} onChange={event => update({ summary: event.target.value })} /></Field><RichText key={item.id} enhanced label="通知详情" value={item.detail} onChange={detail => update({ detail })} /><div className="announcement-fields-grid"><Field label="文字操作"><Select aria-label="文字操作" value={item.action} onChange={event => update({ action: event.target.value })}><option value="detail">打开通知详情</option><option value="link">跳转链接</option><option value="none">不显示文字操作</option></Select></Field>{item.action !== 'none' && <Field label="操作文字"><Input aria-label="操作文字" value={item.action_label} maxLength={20} onChange={event => update({ action_label: event.target.value })} /></Field>}</div>{item.action === 'link' && <><LinkPicker styledSelect label="通知跳转链接" value={item.url} onChange={url => update({ url })} /><Switch label="在新窗口打开" checked={item.new_tab} onCheckedChange={new_tab => update({ new_tab })} /></>}
        {!!item.extra_actions?.length && <div className="space-y-3"><h3 className="text-sm font-medium">详情中的附加链接</h3>{item.extra_actions.map((extra, i) => <div key={i} className="space-y-2 rounded border border-line p-3"><Input aria-label={`附加链接 ${i + 1} 文字`} value={extra.label} onChange={event => update({ extra_actions: item.extra_actions.map((link, n) => n === i ? { ...link, label: event.target.value } : link) })} /><LinkPicker styledSelect label={`附加链接 ${i + 1}`} value={extra.url} onChange={url => update({ extra_actions: item.extra_actions.map((link, n) => n === i ? { ...link, url } : link) })} /><Button size="sm" variant="ghost" onClick={() => update({ extra_actions: item.extra_actions.filter((_, n) => n !== i) })}>移除链接</Button></div>)}</div>}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>通知条显示页面</CardTitle></CardHeader><CardContent><p className="mb-2 text-xs leading-5 text-muted-foreground">在下方选择通知条出现的位置。选择任意官网或购物车页面即可免登录查看；仅选择会员中心页面时，登录后才显示。此规则同时适用于通知条、本页通知和所有通知；关闭记忆仅影响通知条。</p><p className="mb-4 text-sm font-medium" role="status">{audience(item, w.data.pages)}</p><PageTargets value={item.targets} pages={w.data.pages} onChange={targets => update({ targets })} /></CardContent></Card>
      <Card><CardHeader><CardTitle>时间与关闭规则</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-xs text-muted-foreground">按站点时区 {w.data.timezone} 生效。留空开始时间即刻开始，留空到期时间长期有效。</p><div className="announcement-fields-grid"><Field label="开始时间"><Input aria-label="开始时间" type="datetime-local" step="1" value={item.starts_at} onChange={event => update({ starts_at: event.target.value })} /></Field><Field label="到期时间"><Input aria-label="到期时间" type="datetime-local" step="1" value={item.ends_at} onChange={event => update({ ends_at: event.target.value })} /></Field></div><Field label="优先级" hint="0 至 99，数字越大越靠前。同优先级按列表顺序轮播。"><Input className="w-24" aria-label="优先级" type="number" min="0" max="99" value={item.priority} onChange={event => update({ priority: event.target.value === '' ? '' : Number(event.target.value) })} /></Field><Switch label="允许用户关闭此通知" checked={item.dismissible} onCheckedChange={dismissible => update({ dismissible })} />{item.dismissible && <Field label="关闭后多久不再显示"><Select aria-label="关闭记忆" value={item.dismiss_for} onChange={event => update({ dismiss_for: event.target.value })}><option value="visit">本次访问</option><option value="day">当天</option><option value="revision">本条通知内容更新前</option></Select></Field>}</CardContent></Card>
    </> : null}</div></div>
    <Dialog open={!!deleting} onOpenChange={open => !open && setDeleting(null)}><DialogContent><DialogHeader><DialogTitle>删除这条通知？</DialogTitle><DialogDescription>{deleting?.title || '未命名通知'}会从当前草稿移除，保存后生效。</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setDeleting(null)}>取消</Button><Button onClick={() => { setItems(items.filter(row => row.id !== deleting.id)); setDeleting(null) }}>删除通知</Button></DialogFooter></DialogContent></Dialog>
  </>
}

export default function Announcements() {
  return <div className="announcements-page space-y-5"><div><h1 className="text-2xl font-semibold">通知管理</h1><p className="mt-2 text-sm text-muted-foreground">统一编辑三个主题的通知，按页面选择显示位置。</p></div><WorkspaceFrame domain="announcements" scopeId="announcements:all" title="通知" saveDescription="保存全部通知及展示设置">{w => <Editor w={w} />}</WorkspaceFrame></div>
}
