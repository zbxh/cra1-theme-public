import { useState } from 'react'
import { Plus, Pencil, Power, Trash2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@ui/card'
import { Button } from '@ui/button'
import { Input, Label, Textarea } from '@ui/input'
import { Badge } from '@ui/feedback'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@ui/dialog'
import MediaPicker from '../components/MediaPicker'
import LinkPicker from './LinkPicker'
import SwitchControl from '../ui/Switch'
import { DragHandle, DropBadge, DRAG_LIST_BASE, RowIconBtn, dragRowClass, useFlatDrag, DragAnnouncer } from '../ui/dragSort'
import { useScopedState } from '../lib/workspace'
import defaults from '../../../../backend/Storage/auth-pages.defaults.json'

function TextField({ label, value, onChange, multiline, maxLength, placeholder }) {
  const Control = multiline ? Textarea : Input
  return <div className="space-y-1.5"><Label>{label}</Label><Control aria-label={label} value={value ?? ''} onChange={e => onChange(e.target.value)} maxLength={maxLength} placeholder={placeholder} rows={multiline ? 3 : undefined}/></div>
}

function Highlights({ items, onChange }) {
  const [editing, setEditing] = useState(null), [announcement, setAnnouncement] = useState('')
  const drag = useFlatDrag({count: () => items.length, keyOf: item => item.id, onAnnounce: setAnnouncement, onMove: (from, to) => {
    const next = [...items], [item] = next.splice(from, 1); next.splice(to, 0, item); onChange(next)
  }})
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3"><Label>介绍条目</Label><Button size="sm" variant="outline" disabled={items.length >= 6} onClick={() => setEditing({id: crypto.randomUUID(), title: '', description: '', enabled: 1})}><Plus className="size-4"/>添加条目</Button></div>
    <p className="text-xs text-muted-foreground">最多 6 条。拖动手柄排序，也可聚焦手柄后按空格和方向键调整。</p>
    {items.length ? <ul className={DRAG_LIST_BASE}>{items.map((item, i) => <li key={item.id} draggable {...drag.itemProps(i)} className={dragRowClass({isDragging: drag.isDragging(i), isOver: drag.isOver(i)})}>
      <DragHandle {...drag.handleProps(i, '拖拽排序：' + (item.title || '未命名条目'))}/>
      <span className="min-w-0 flex-1 truncate text-sm">{item.title || item.description || '未命名条目'}</span>
      {!Number(item.enabled) && <Badge tone="muted">隐藏</Badge>}{drag.isOver(i) && <DropBadge pos={drag.dropPos}/>}
      <RowIconBtn label={'编辑：' + (item.title || '条目')} onClick={() => setEditing({...item})}><Pencil className="size-3.5"/></RowIconBtn>
      <RowIconBtn label={(Number(item.enabled) ? '隐藏：' : '显示：') + (item.title || '条目')} onClick={() => onChange(items.map(x => x.id === item.id ? {...x, enabled: Number(x.enabled) ? 0 : 1} : x))}><Power className="size-3.5"/></RowIconBtn>
      <RowIconBtn label={'删除：' + (item.title || '条目')} danger onClick={() => onChange(items.filter(x => x.id !== item.id))}><Trash2 className="size-3.5"/></RowIconBtn>
    </li>)}</ul> : <p className="rounded-lg border border-dashed border-line p-4 text-sm text-muted-foreground">尚未添加介绍条目。</p>}
    <DragAnnouncer message={announcement}/>
    <Dialog open={!!editing} onOpenChange={open => !open && setEditing(null)}><DialogContent><DialogHeader><DialogTitle>编辑介绍条目</DialogTitle><DialogDescription>应用到当前页草稿，保存页面后生效。</DialogDescription></DialogHeader>{editing && <form className="space-y-4" onSubmit={e => {e.preventDefault(); onChange(items.some(x => x.id === editing.id) ? items.map(x => x.id === editing.id ? editing : x) : [...items, editing]); setEditing(null)}}>
      <TextField label="条目标题" value={editing.title} onChange={title => setEditing({...editing, title})} maxLength={60}/>
      <TextField label="条目说明" value={editing.description} onChange={description => setEditing({...editing, description})} multiline maxLength={160}/>
      <DialogFooter><Button type="button" variant="outline" onClick={() => setEditing(null)}>取消</Button><Button type="submit">应用到草稿</Button></DialogFooter>
    </form>}</DialogContent></Dialog>
  </div>
}

/** Appearance edits use the existing atomic page workspace, never native auth settings. */
export default function MemberAuth({ workspace, kind }) {
  const [content, setContent] = useScopedState(workspace, 'content', null)
  if (!content) return <p role="status">正在读取页面设置…</p>
  const key = 'auth_' + kind, d = defaults[kind], raw = content[key] || {}
  const value = {...d, ...raw, brand: {...d.brand, ...raw.brand}, support: {...d.support, ...raw.support}}
  const set = patch => setContent(c => ({...c, [key]: {...value, ...patch}}))
  const setBrand = patch => set({brand: {...value.brand, ...patch}}), setSupport = patch => set({support: {...value.support, ...patch}})
  return <div className="space-y-5">
    <p className="text-sm text-muted-foreground">这里修改页面外观与文案。邮箱、手机、验证码、注册开关及第三方登录由系统设置和已启用插件决定。</p>
    <Card><CardHeader><CardTitle>表单文案</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">
      <TextField label="表单标题" value={value.title} onChange={title => set({title})} maxLength={80} placeholder={d.title}/>
      <TextField label="表单说明" value={value.description} onChange={description => set({description})} maxLength={200} placeholder="留空则不显示说明"/>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>页面品牌</CardTitle><CardDescription>Logo 留空时使用系统 Logo；手机端收起左侧介绍，优先展示表单。</CardDescription></CardHeader><CardContent className="space-y-5">
      <div className="max-w-md space-y-2"><Label>页面 Logo</Label><MediaPicker label="页面 Logo" value={value.logo} onChange={logo => set({logo})}/></div>
      <div className="flex items-center justify-between gap-4 rounded-lg border border-line px-4 py-3"><div><Label>显示左侧介绍</Label><p className="mt-1 text-xs text-muted-foreground">关闭后表单居中，已填写内容继续保留。</p></div><SwitchControl label="显示左侧介绍" checked={!!Number(value.brand.enabled)} onCheckedChange={enabled => setBrand({enabled: enabled ? 1 : 0})}/></div>
      {!!Number(value.brand.enabled) && <div className="space-y-5">
        <TextField label="介绍眉题" value={value.brand.label} onChange={label => setBrand({label})} maxLength={40}/>
        <TextField label="介绍标题" value={value.brand.title} onChange={title => setBrand({title})} multiline maxLength={120} placeholder="支持换行"/>
        <TextField label="介绍说明" value={value.brand.description} onChange={description => setBrand({description})} multiline maxLength={240}/>
        <div className="max-w-md space-y-2"><Label>介绍配图</Label><p className="text-xs text-muted-foreground">未选择图片时显示主题内置的云资源插图。</p><MediaPicker label="介绍配图" value={value.brand.image} onChange={image => setBrand({image})}/></div>
        <Highlights items={value.brand.items} onChange={items => setBrand({items})}/>
      </div>}
    </CardContent></Card>
    <Card><CardHeader><CardTitle>辅助信息</CardTitle></CardHeader><CardContent className="space-y-4">
      <div className="flex items-center justify-between gap-4"><Label>显示支持链接</Label><SwitchControl label="显示支持链接" checked={!!Number(value.support.enabled)} onCheckedChange={enabled => setSupport({enabled: enabled ? 1 : 0})}/></div>
      {!!Number(value.support.enabled) && <><TextField label="支持链接文字" value={value.support.label} onChange={label => setSupport({label})} maxLength={30}/><div className="space-y-1.5"><Label>支持链接</Label><LinkPicker label="支持链接" styledSelect value={value.support.url} onChange={url => setSupport({url})}/></div></>}
      <TextField label="页脚文字" value={value.footer} onChange={footer => set({footer})} maxLength={200} placeholder="留空则使用系统版权信息"/>
    </CardContent></Card>
  </div>
}
