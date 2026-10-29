import { useEffect, useState } from 'react'
import { Save, RotateCcw, RefreshCw, ArrowRight } from 'lucide-react'
import { Button } from '@ui/button'
import { Alert, Badge } from '@ui/feedback'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@ui/dialog'
import { useWorkspace, threeWay, setAt } from '../lib/workspace'
import { workspaceApi,bootInfo } from '../lib/api'
import DraftPreview from './DraftPreview'

function conflictLabel(w,path){const fields=Object.values(w.data.scopes||{}).flatMap(s=>s.fields||[]);return path.map(k=>fields.find(f=>f.key===k)?.label||({'main':'页面设置','content':'页面内容','layout':'区块顺序与显示','seo':'搜索引擎设置','title':'标题','desc':'说明','kw':'关键词','noindex':'禁止收录','order':'区块顺序','visibility':'区块显示','inheritOrder':'使用默认顺序','custom_code':'自定义代码','css':'CSS','js':'JS','css_enabled':'启用 CSS','js_enabled':'启用 JS','appearance':'外观','sidebar':'菜单','nodes':'菜单条目','items':'条目','buttons':'按钮','label':'名称','name':'名称','enabled':'启用','home_banner':'首页横幅','product_list':'产品列表','default':'默认文案','overrides':'分类文案'}[k])||(/^\d+$/.test(k)?`第 ${Number(k)+1} 项`:'设置')).join(' / ')}
function conflictValue(v){if(v==null)return'未设置';if(typeof v==='boolean')return v?'开启':'关闭';if(Array.isArray(v))return v.map(x=>typeof x==='object'?(x.label||x.name||x.title||'条目'):String(x)).join('、');if(typeof v==='object')return Object.entries(v).map(([k,x])=>`${({title:'标题',desc:'说明',label:'名称',name:'名称',enabled:'启用'}[k]||'内容')}：${conflictValue(x)}`).join('\n');return String(v)}
function ConflictDialog({ workspace, open, onClose }) {
  const [choices, setChoices] = useState({})
  useEffect(() => setChoices({}), [workspace.remote])
  if (!workspace.remote) return null
  const comparison = threeWay(workspace.original, workspace.values, workspace.remote.values)
  const ready = comparison.conflicts.every((c) => choices[c.path.join('.')] != null)
  return <Dialog open={open} onOpenChange={(value) => !value && onClose()}><DialogContent className="max-w-[720px]">
    <DialogHeader><DialogTitle>当前配置有更新，草稿已保留</DialogTitle><DialogDescription>没有冲突的修改会自动合并。请为冲突项选择要保留的值，合并后再保存。</DialogDescription></DialogHeader>
    <div className="space-y-3">{comparison.conflicts.map((c) => <div className="rounded-md border border-line p-3" key={c.path.join('.')}>
      <p className="mb-2 text-sm font-medium">{conflictLabel(workspace,c.path)}</p>
      <div className="mb-2 rounded bg-surface-alt p-2"><p className="text-xs font-medium text-muted-foreground">修改前内容</p><pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap break-all text-xs text-muted-foreground">{conflictValue(c.base)}</pre></div>
      <div className="grid gap-2 sm:grid-cols-2">{['local','remote'].map((kind) => <label className="min-w-0 rounded border border-line p-2" key={kind}>
        <input type="radio" name={c.path.join('.')} checked={choices[c.path.join('.')] === kind} onChange={() => setChoices({ ...choices, [c.path.join('.')]: kind })} /> {kind === 'local' ? '保留我的修改' : '使用服务器值'}
        <pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap break-all text-xs text-muted-foreground">{conflictValue(c[kind])}</pre>
      </label>)}</div></div>)}{!comparison.conflicts.length && <Alert tone="info">两边修改没有重叠，可以合并。</Alert>}</div>
    <DialogFooter><Button variant="ghost" onClick={onClose}>稍后处理</Button><Button variant="outline" onClick={() => workspace.rebase(workspace.remote.values)}>使用服务器配置</Button><Button disabled={!ready} onClick={() => {
      let merged = comparison.value
      for (const c of comparison.conflicts) merged = setAt(merged, c.path, c[choices[c.path.join('.')]])
      workspace.rebase(merged)
    }}>合并到草稿</Button></DialogFooter>
  </DialogContent></Dialog>
}
export default function WorkspaceFrame({ domain, scopeId, editorId, title, saveDescription, children }) {
  const w = useWorkspace(domain, editorId ? `editor:${domain}:${editorId}` : scopeId)
  const [sync, setSync] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [conflictOpen, setConflictOpen] = useState(false)
  useEffect(() => { if (w.remote) setConflictOpen(true) }, [w.remote])
  if (w.loading) return <div className="space-y-3 p-6" role="status"><div className="h-8 w-48 animate-pulse rounded bg-surface-alt" /><div className="h-48 animate-pulse rounded bg-surface-alt" />正在读取配置…</div>
  if (w.error || !w.data) return <Alert tone="error"><p>页面错误，请刷新重试</p></Alert>
  return <section className="workspace-frame">
    <div className="workspace-savebar"><div className="min-w-0"><p className="truncate text-sm font-medium">{title || w.data.scope.label}</p><p className="text-xs text-muted-foreground">{w.dirty ? '有未保存修改' : '已保存'} · {saveDescription||(editorId?'保存本配置页的全部修改':'只保存此处修改')}</p></div>
      <div className="flex flex-wrap gap-2">{editorId&&<DraftPreview workspace={w} editorId={editorId}/>}<Button variant="outline" disabled={w.saving || !w.dirty} onClick={w.revert}><RotateCcw className="size-4" />撤销当前页修改</Button><Button disabled={w.saving || !w.dirty || !!w.remote} onClick={w.save}><Save className="size-4" />{w.saving ? '保存中…' : `保存${title || w.data.scope.label}`}</Button></div>
    </div>
    {w.saveError && <Alert tone="error">{w.saveError}</Alert>}
    {w.savedMessage && <Alert tone={w.data.snapshot_ok === false ? 'warning' : 'success'}>{w.savedMessage}</Alert>}
    {w.remote && <Alert tone="warning">服务器配置有更新，草稿已保留。<Button variant="outline" className="ml-3" onClick={() => setConflictOpen(true)}>处理配置差异</Button></Alert>}
    {w.data.snapshot_ok === false && bootInfo.role!=='operator' && <Button variant="outline" disabled={syncing} onClick={async () => { setSyncing(true); setSync(''); try { const r = await workspaceApi.rebuild(domain); if (r.status !== 200) throw new Error(r.msg); await w.reload(); } catch (e) { setSync(e.message) } finally { setSyncing(false) } }}><RefreshCw className="size-4" />{syncing ? '同步中…' : '重试前台同步'}</Button>}
    {sync && <Alert tone="error">{sync}</Alert>}
    <fieldset disabled={w.saving} inert={w.saving || undefined} aria-busy={!!w.saving} className="min-w-0 space-y-5 border-0 p-0">{children(w)}</fieldset>
    <ConflictDialog workspace={w} open={conflictOpen} onClose={() => setConflictOpen(false)} />
  </section>
}
