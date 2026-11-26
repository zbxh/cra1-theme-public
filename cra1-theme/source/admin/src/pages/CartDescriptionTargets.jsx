import { useRef, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@ui/button'
import { Checkbox, Input } from '@ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@ui/dialog'
import { Alert } from '@ui/feedback'
import { globalTarget, isConfigured, ruleAt, bindingAt, targetKey } from './cart-description-rules'

function searchTerms(value) {
  return value.normalize('NFKC').trim().toLowerCase().split(/\s+/u).filter(Boolean)
}

function findRows(rows, terms, allowProduct, productsOnly) {
  return rows.flatMap(row => {
    const haystack = (row.path + ' #' + row.id).normalize('NFKC').toLowerCase()
    const matches = terms.every(term => haystack.includes(term))
    if (!row.children) return matches && (!allowProduct || allowProduct(row)) ? [row] : []
    const children = findRows(row.children, terms, allowProduct, productsOnly)
    return children.length || (matches && !productsOnly) ? [{ ...row, children }] : []
  })
}

export function CatalogRows({ catalog, index, rules, orphans = [], query, current, onChoose,
  checked, onCheck, productsOnly = false, allowProduct, error, onRetry }) {
  const [expanded, setExpanded] = useState({})
  const terms = searchTerms(query)
  const rows = findRows(index.roots, terms, allowProduct, productsOnly)
  const missing = findRows(orphans, terms)
  const activeKey = targetKey(current)
  const bulk = Boolean(onCheck)

  function render(row) {
    const key = targetKey(row)
    const active = key === activeKey
    const open = expanded[query]?.[key] ?? terms.length > 0
    const rule = ruleAt(rules, row)
    const binding = bindingAt(rules, row)
    const status = rule.mode === 'hide' ? '隐藏' : binding?.ref ? '共用' : isConfigured(binding) ? '自定义' : ''
    const labels = <><span className="cart-desc-name" title={row.path}>{row.name}</span>
      {row.hidden && <small title="V10 未公开">未公开</small>}
      {status && <small>{status}</small>}
      {active && bulk && <small>当前编辑</small>}</>
    return <li key={key}>
      <div className="cart-desc-row">
        {row.children?.length ? <Button type="button" size="icon" variant="ghost" className="cart-desc-branch-toggle"
          aria-expanded={open} aria-label={(open ? '收起' : '展开') + row.name}
          onClick={() => setExpanded(items => ({ ...items, [query]: { ...items[query], [key]: !open } }))}>
          <ChevronRight size={15} aria-hidden="true" />
        </Button> : <span className="cart-desc-branch-space" aria-hidden="true" />}
        {bulk ? <label className="cart-desc-item">
          <Checkbox checked={active || checked.has(key)} onChange={event => onCheck(key, event.target.checked)}
            disabled={active} aria-label={row.path} />{labels}
        </label> : productsOnly && row.children ? <span className="cart-desc-item cart-desc-heading">{labels}</span>
          : <button type="button" className="cart-desc-item" aria-current={active ? 'true' : undefined}
            aria-label={row.path} onClick={() => onChoose(row)}>{labels}</button>}
      </div>
      {open && !!row.children?.length && <ul className="cart-desc-children">{row.children.map(render)}</ul>}
    </li>
  }

  return <div className="cart-desc-directory" aria-label="V10 商品与分组">
    {error && <div className="space-y-2"><Alert tone="error">{error}</Alert>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>重新读取商品</Button></div>}
    {!catalog && !error && <p className="cart-desc-note" role="status">正在读取 V10 商品目录…</p>}
    {catalog && !rows.length && <p className="cart-desc-note" role="status">{terms.length ? '没有匹配的商品或分组' : '此范围暂无可选商品或分组'}</p>}
    <ul>{rows.map(render)}</ul>
    {missing.length > 0 && <div className="cart-desc-missing">
      <p className="cart-desc-note">未匹配的已保存规则</p>
      <ul>{missing.map(render)}</ul>
    </div>}
  </div>
}

export function TargetPicker({ title, description, current, onChoose, productsOnly, ...props }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const input = useRef(null)
  const trigger = useRef(null)
  const choose = row => { onChoose(row); setOpen(false) }
  const defaultTarget = productsOnly ? null : globalTarget
  const hint = productsOnly ? '搜索范围内的商品' : '搜索分组、商品或完整分类路径'
  return <Dialog open={open} onOpenChange={next => { setOpen(next); if (next) setQuery('') }}>
    <DialogTrigger asChild>
      <Button ref={trigger} type="button" variant="outline" className="cart-desc-trigger" title={current.path}
        aria-label={title + '，当前为' + current.path}>
        <span>{current.path}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </Button>
    </DialogTrigger>
    <DialogContent className="cart-desc-dialog" onOpenAutoFocus={event => { event.preventDefault(); input.current?.focus() }}
      onCloseAutoFocus={event => { if (trigger.current) { event.preventDefault(); trigger.current.focus() } }}>
      <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
      <div className="cart-desc-dialog-body">
        <Input ref={input} type="search" value={query} onChange={event => setQuery(event.target.value)}
          aria-label={hint} placeholder={hint} />
        <Button type="button" variant="ghost" className="cart-desc-default"
          aria-current={productsOnly ? (current.scope === 'product' ? undefined : 'true')
            : (current.scope === 'global' ? 'true' : undefined)} onClick={() => choose(defaultTarget)}>
          {productsOnly ? '按当前对象预览' : '全局说明'}
        </Button>
        <CatalogRows {...props} query={query} current={current} productsOnly={productsOnly} onChoose={choose} />
      </div>
    </DialogContent>
  </Dialog>
}
