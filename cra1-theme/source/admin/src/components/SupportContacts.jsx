import { useMemo, useState } from 'react'
import { Button } from '@ui/button'
import { Input, Label, Select } from '@ui/input'
import { Alert } from '@ui/feedback'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, ConfirmDialog } from '@ui/dialog'
import Switch from '../ui/Switch'
import IconPicker from '../ui/IconPicker'
import LinkPicker from '../pages/LinkPicker'
import { TreeSortEditor } from '../ui/treeSort'
import { contactTypes, contactPreview, contactError, emptyContact, parseSupport, supportId, supportToTree, supportFromTree, supportDropPositions } from '../lib/support-contacts'

function ContactDialog({ editing, onApply, onClose }) {
  const [item, setItem] = useState(() => ({ ...editing.item })), [error, setError] = useState('')
  const type = contactTypes.find(t => t.id === item.type) || contactTypes[0]
  const set = patch => { setItem(old => ({ ...old, ...patch })); setError('') }
  return <Dialog open onOpenChange={open => { if (!open) onClose() }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>{editing.add ? '添加客服条目' : '编辑客服条目'}</DialogTitle><DialogDescription>选择联系方式，链接格式会自动处理。应用后仍需保存头部配置。</DialogDescription></DialogHeader>
    <div className="space-y-5">
      <div><Label htmlFor="support-contact-type">联系方式</Label><Select id="support-contact-type" value={item.type} onChange={e => { const next=contactTypes.find(t=>t.id===e.target.value);set({type:next.id,icon:next.icon,value:'',url:''}) }}>{contactTypes.map(t=><option value={t.id} key={t.id}>{t.name}</option>)}</Select><p className="mt-1 text-xs text-muted-foreground">{type.hint}</p></div>
      {!['link','text'].includes(item.type) && <div><Label htmlFor="support-contact-account">{item.type==='phone'?'电话号码':item.type==='email'?'邮箱地址':'账号'}</Label><Input id="support-contact-account" value={item.value} autoComplete="off" inputMode={['phone','qq','whatsapp','weibo'].includes(item.type)?'tel':item.type==='email'?'email':'text'} onChange={e=>set({value:e.target.value})}/></div>}
      <div><Label htmlFor="support-contact-text">显示文字</Label><Input id="support-contact-text" value={item.text} maxLength={120} placeholder={['link','text'].includes(item.type)?'例如：售前咨询':'留空时显示上面的联系方式或账号'} onChange={e=>set({text:e.target.value})}/></div>
      {item.type==='link' ? <div><Label>跳转链接</Label><LinkPicker label="客服跳转链接" value={item.url} onChange={url=>set({url})}/></div> : item.type!=='text' && <details className="advanced-details"><summary>指定其他跳转链接（可选）</summary><div className="py-3"><p className="mb-2 text-xs text-muted-foreground">未设置时自动拨号、发送邮件、打开社交主页或复制账号。</p><LinkPicker label="客服自定义跳转链接" value={item.url} onChange={url=>set({url})}/></div></details>}
      <div className="flex flex-wrap gap-x-6 gap-y-3"><label className="flex items-center gap-2 text-sm"><Switch label="显示文字" checked={item.showText} onCheckedChange={showText=>set({showText})}/>显示文字</label><label className="flex items-center gap-2 text-sm"><Switch label="显示图标" checked={item.showIcon} onCheckedChange={showIcon=>set({showIcon})}/>显示图标</label></div>
      {item.showIcon && <div><Label>图标</Label><IconPicker label="客服条目图标" value={item.icon} iconStyle={item.icon_style} tile={false} onChange={(icon,icon_style)=>set({icon,icon_style})}/></div>}
      <p className="break-all text-xs text-muted-foreground">点击后的操作：{contactPreview(item)}</p>
      <label className="flex items-center gap-2 text-sm"><Switch label="显示这条客服信息" checked={item.enabled} onCheckedChange={enabled=>set({enabled})}/>显示这条客服信息</label>
      {item.type==='link'||item.url||['qq','telegram','whatsapp','x','instagram','weibo'].includes(item.type)?<label className="flex items-center gap-2 text-sm"><Switch label="在新窗口打开网页" checked={item.newWindow} onCheckedChange={newWindow=>set({newWindow})}/>在新窗口打开网页</label>:null}
      {error&&<Alert tone="error">{error}</Alert>}
    </div><DialogFooter><Button variant="ghost" onClick={onClose}>取消</Button><Button onClick={()=>{const message=contactError(item);if(message){setError(message);return}onApply({...item,text:item.text.trim(),value:item.value.trim(),url:item.url.trim()})}}>应用到草稿</Button></DialogFooter>
  </DialogContent></Dialog>
}

function GroupDialog({ editing, onApply, onClose }) {
  const [group, setGroup] = useState(() => ({ ...editing.group }))
  return <Dialog open onOpenChange={open => { if (!open) onClose() }}>
    <DialogContent><DialogHeader>
      <DialogTitle>{editing.add ? '添加客服分组' : '编辑客服分组'}</DialogTitle>
      <DialogDescription>分组标题留空时不显示标题。应用后仍需保存头部配置。</DialogDescription>
    </DialogHeader>
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); onApply({ ...group, title: group.title.trim() }) }}>
        <div><Label htmlFor="support-group-title">分组标题</Label><Input id="support-group-title" maxLength={60} value={group.title} onChange={e => setGroup(old => ({ ...old, title: e.target.value }))}/></div>
        <label className="flex items-center gap-2 text-sm"><Switch label="显示此分组" checked={group.enabled} onCheckedChange={enabled => setGroup(old => ({ ...old, enabled }))}/>显示此分组</label>
        <DialogFooter><Button type="button" variant="outline" onClick={onClose}>取消</Button><Button type="submit">应用到草稿</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}

export default function SupportContacts({ value, onChange }) {
  const parsed = useMemo(() => {
    try { const doc = parseSupport(value); return { doc, tree: supportToTree(doc) } }
    catch (error) { return { error: error.message } }
  }, [value])
  const [editing, setEditing] = useState(null), [groupEditing, setGroupEditing] = useState(null)
  const [deleting, setDeleting] = useState(null), [notice, setNotice] = useState('')
  if (parsed.error) return <Alert tone="error">{parsed.error}</Alert>
  const { doc, tree } = parsed, groups = doc.groups
  const total = groups.reduce((count, group) => count + group.items.length, 0)
  const write = next => { setNotice(''); onChange(JSON.stringify(next)) }
  const updateGroup = (id, update) => write({ ...doc, groups: groups.map(group => group.id === id ? update(group) : group) })
  const groupOf = node => groups.find(group => group.items.some(item => item.id === node.id))
  const itemLabel = item => item.text || item.value || '未命名条目'

  return <div className="space-y-4" data-support-editor>
    <label className="flex items-center gap-3 text-sm font-medium"><Switch label="显示顶栏客服图标" checked={doc.enabled} onCheckedChange={enabled => write({ ...doc, enabled })}/>显示顶栏客服图标</label>
    <p className="text-xs leading-5 text-muted-foreground">拖拽左侧手柄调整顺序，客服条目可拖入其他分组。点击分组右侧的“＋”添加客服条目。</p>
    {!doc.enabled && <Alert tone="info">客服入口已在草稿中关闭，保存后官网顶栏将隐藏客服图标。</Alert>}
    {notice && <Alert tone="error">{notice}</Alert>}
    <TreeSortEditor
      tree={tree}
      setTree={next => { try { write(supportFromTree(doc, next)) } catch (error) { setNotice(error.message) } }}
      maxLevel={2}
      isBranch={node => node.kind === 'group'}
      levelLabels={{ 1: '分组', 2: '条目' }}
      dropPositions={supportDropPositions}
      getLabel={node => node.kind === 'group' ? node.group.title || '未命名分组' : itemLabel(node.item)}
      renderMeta={node => node.kind === 'group' ? `${node.children.length} 条客服信息` : [contactTypes.find(type => type.id === node.item.type)?.name, node.item.value || node.item.url].filter(Boolean).join(' · ')}
      hiddenOf={node => node.kind === 'group' ? !node.group.enabled : !node.item.enabled}
      onToggleHidden={node => node.kind === 'group'
        ? updateGroup(node.id, group => ({ ...group, enabled: !group.enabled }))
        : updateGroup(groupOf(node).id, group => ({ ...group, items: group.items.map(item => item.id === node.id ? { ...item, enabled: !item.enabled } : item) }))}
      onEdit={node => node.kind === 'group'
        ? setGroupEditing({ group: node.group, add: false })
        : setEditing({ groupId: groupOf(node).id, item: node.item, add: false })}
      onAddChild={node => {
        if (!node) {
          if (groups.length >= 8) { setNotice('客服分组最多 8 个'); return }
          setGroupEditing({ group: { id: supportId(), title: '', enabled: true, items: [] }, add: true })
        } else {
          if (total >= 60) { setNotice('客服条目最多 60 条'); return }
          setEditing({ groupId: node.id, item: emptyContact(), add: true })
        }
      }}
      onDelete={node => node.kind === 'group'
        ? setDeleting(node.group)
        : updateGroup(groupOf(node).id, group => ({ ...group, items: group.items.filter(item => item.id !== node.id) }))}
      addLabel="添加分组"
      headerMeta={`${groups.length} 个分组 · ${total} 条客服信息`}
      onReject={setNotice}
    />
    {editing && <ContactDialog key={editing.item.id} editing={editing} onClose={() => setEditing(null)} onApply={item => {
      updateGroup(editing.groupId, group => ({ ...group, items: editing.add ? [...group.items, item] : group.items.map(old => old.id === item.id ? item : old) }))
      setEditing(null)
    }}/>} 
    {groupEditing && <GroupDialog key={groupEditing.group.id} editing={groupEditing} onClose={() => setGroupEditing(null)} onApply={group => {
      write({ ...doc, groups: groupEditing.add ? [...groups, group] : groups.map(old => old.id === group.id ? { ...old, title: group.title, enabled: group.enabled } : old) })
      setGroupEditing(null)
    }}/>} 
    <ConfirmDialog open={!!deleting} title="删除客服分组" confirmText="删除分组" tone="danger"
      description={`将从草稿中删除“${deleting?.title || '未命名分组'}”及其中的 ${deleting?.items.length || 0} 个条目。保存头部配置后生效。`}
      onCancel={() => setDeleting(null)} onConfirm={() => { write({ ...doc, groups: groups.filter(group => group.id !== deleting.id) }); setDeleting(null) }}/>
  </div>
}
