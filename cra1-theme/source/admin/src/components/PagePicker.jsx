import { useState } from 'react'
import { ChevronDown, Search, Check } from 'lucide-react'
import { Button } from '@ui/button'
import { Input } from '@ui/input'
import { Badge } from '@ui/feedback'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@ui/dialog'
import { useWorkspaces, equal } from '../lib/workspace'

export default function PagePicker({ entries, value, onChange, label = '选择页面' }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const { records } = useWorkspaces()
  const selected = entries.find((e) => e.id === value)
  return <><Button variant="outline" className="max-w-full justify-between" aria-label={label} onClick={() => setOpen(true)}><span className="truncate">{selected?.label || label}</span><ChevronDown className="size-4" /></Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-[580px]"><DialogHeader><DialogTitle>{label}</DialogTitle><DialogDescription>搜索页面名称，选择后保留当前草稿。</DialogDescription></DialogHeader><Input autoFocus aria-label="搜索页面" placeholder="搜索页面名称…" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="max-h-[55vh] overflow-y-auto" role="list">{entries.filter((e) => `${e.label} ${e.id} ${e.category || ''}`.toLowerCase().includes(query.toLowerCase())).map((e) => <button type="button" className="picker-row" role="listitem" key={e.id} onClick={() => { onChange(e.id); setOpen(false); setQuery('') }}>
        <div className="min-w-0 flex-1 text-left"><span className="text-sm font-medium">{e.label}</span>{e.category && <p className="text-xs text-muted-foreground">{e.category}</p>}</div>
        {Object.entries(records).some(([id,r]) => e.scopes?.includes(id) && r.values && !equal(r.values,r.original)) && <Badge tone="warning">草稿</Badge>}{e.id === value && <Check className="size-4 text-brand" />}
      </button>)}{!entries.some((e) => `${e.label} ${e.id} ${e.category || ''}`.toLowerCase().includes(query.toLowerCase())) && <p className="p-5 text-center text-muted-foreground">没有匹配的页面</p>}</div>
    </DialogContent></Dialog>
  </>
}
