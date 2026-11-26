import { useEffect, useRef, useState } from 'react'
import { Button } from '@ui/button'
import { Checkbox, Input } from '@ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@ui/dialog'
import { api } from '../lib/api'
import { CatalogRows } from './CartDescriptionTargets'
import { bindingAt, covers, globalTarget, isConfigured, newReference, shareRule, targetKey } from './cart-description-rules'

function useImpact(before, after, active) {
  const [estimate, setEstimate] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const request = active ? JSON.stringify({ before, after }) : ''
  useEffect(() => {
    if (!request) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const response = await api('api.cart.descriptions.impact', JSON.parse(request), { signal: controller.signal })
        if (response.status !== 200) throw new Error('计算受影响商品失败')
        if (!controller.signal.aborted) setEstimate({ request, attempt, affected: response.data.affected })
      } catch {
        if (!controller.signal.aborted) setEstimate({ request, attempt, error: true })
      }
    }, 180)
    return () => { clearTimeout(timer); controller.abort() }
  }, [request, attempt])
  return {
    estimate: estimate?.request === request && estimate.attempt === attempt ? estimate : null,
    retry: () => setAttempt(value => value + 1),
  }
}

function BulkForm({ current, rules, index, catalog, orphans, linked, onClose, onApply }) {
  const [query, setQuery] = useState('')
  const [checked, setChecked] = useState(() => new Set(linked.map(targetKey)))
  const [replaced, setReplaced] = useState(new Set())
  const [review, setReview] = useState(false)
  const [ref] = useState(() => bindingAt(rules, current)?.ref || newReference())
  const reviewHeading = useRef(null)
  const search = useRef(null)
  const currentKey = targetKey(current)
  const linkedKeys = new Set(linked.map(targetKey))
  const chosen = [...index.targets.values()].filter(row => row.scope !== 'global' && targetKey(row) !== currentKey
    && checked.has(targetKey(row)) && !linkedKeys.has(targetKey(row)))
  const conflicts = chosen.filter(row => isConfigured(bindingAt(rules, row)))
  const skipped = conflicts.filter(row => !replaced.has(targetKey(row)))
  const added = chosen.filter(row => !isConfigured(bindingAt(rules, row)) || replaced.has(targetKey(row)))
  const removed = linked.filter(row => !checked.has(targetKey(row)))
  const changes = [...added, ...removed]
  const changedKeys = new Set(changes.map(targetKey))
  const covered = index.products.filter(row => changedKeys.has('global:0')
    || Object.entries(row.selection).some(([scope, id]) => changedKeys.has(targetKey({ scope, id })))).length
  const valid = changes.length > 0
  const next = review && valid ? shareRule(rules, current, added, removed, ref) : null
  const { estimate, retry } = useImpact(rules, next, next !== null)

  useEffect(() => {
    if (review) reviewHeading.current?.focus()
    else search.current?.focus()
  }, [review])

  function setCheckedKey(key, selected) {
    setChecked(previous => {
      const next = new Set(previous)
      if (selected) next.add(key)
      else next.delete(key)
      return next
    })
    if (!selected) setReplaceKey(key, false)
  }

  function setReplaceKey(key, selected) {
    setReplaced(previous => {
      const next = new Set(previous)
      if (selected) next.add(key)
      else next.delete(key)
      return next
    })
  }

  return <>
    <DialogHeader>
      <DialogTitle>{review ? '确认应用范围' : linked.length ? '管理共用位置' : '应用到多个位置'}</DialogTitle>
      <DialogDescription>{review ? '确认新增、取消共用和需要替换的规则。应用后请保存商品列表。'
        : '勾选分组会设置分组规则，覆盖符合条件的现有及新增商品。修改共用说明会同步到所有关联位置。'}</DialogDescription>
    </DialogHeader>
    {review ? <div className="cart-desc-dialog-body">
      <p className="cart-desc-review-count" tabIndex={-1} ref={reviewHeading}>
        新增 {added.length} 处 · 取消共用 {removed.length} 处 · 跳过 {skipped.length} 处
      </p>
      <p className="cart-desc-note" aria-live="polite">
        涉及 {covered} 个商品（已去重）。
        {next && (estimate?.error ? <>暂时无法计算前台变化。 <Button size="sm" variant="ghost" onClick={retry}>重新计算</Button></>
          : estimate ? '相较当前草稿，' + estimate.affected + ' 个已公开商品的说明会变化。' : '正在计算前台变化…')}
      </p>
      <div className="cart-desc-review">
        {added.filter(row => !isConfigured(bindingAt(rules, row))).map(row => <p key={targetKey(row)}>新增 · {row.path}</p>)}
        {removed.map(row => <p key={targetKey(row)}>取消共用 · {row.path}</p>)}
        {conflicts.length > 0 && <p className="cart-desc-note">已有说明的对象默认跳过。勾选后才替换原规则。</p>}
        {conflicts.map(row => <label key={targetKey(row)} className="cart-desc-conflict">
          <Checkbox aria-label={'替换' + row.path} checked={replaced.has(targetKey(row))}
            onChange={event => setReplaceKey(targetKey(row), event.target.checked)} />
          <span>{row.path} <small>{replaced.has(targetKey(row)) ? '替换' : '跳过'}</small></span>
        </label>)}
      </div>
    </div> : <div className="cart-desc-dialog-body">
      <Input ref={search} type="search" aria-label="筛选应用对象" placeholder="搜索分组或商品"
        value={query} onChange={event => setQuery(event.target.value)} />
      {linkedKeys.has('global:0') && <label className="cart-desc-existing-global">
        <Checkbox checked={checked.has('global:0')} onChange={event => setCheckedKey('global:0', event.target.checked)} />
        {globalTarget.name}
      </label>}
      <CatalogRows catalog={catalog} index={index} rules={rules} orphans={orphans.filter(row => linkedKeys.has(targetKey(row)))}
        query={query} current={current} checked={checked} onCheck={setCheckedKey} />
      <div className="cart-desc-bulk-count">
        <span aria-live="polite">已选 {checked.size} 处，另含当前编辑对象</span>
        {checked.size > 0 && <Button type="button" size="sm" variant="ghost" onClick={() => {
          setChecked(new Set())
          setReplaced(new Set())
        }}>清空选择</Button>}
      </div>
    </div>}
    <DialogFooter>
      <Button type="button" variant="outline" onClick={review ? () => setReview(false) : onClose}>{review ? '返回选择' : '取消'}</Button>
      {review
        ? <Button type="button" disabled={!valid} onClick={() => { onApply(next); onClose() }}>应用到草稿</Button>
        : <Button type="button" disabled={!chosen.length && !removed.length} onClick={() => setReview(true)}>核对应用范围</Button>}
    </DialogFooter>
  </>
}

export default function CartDescriptionBulk({ disabled, linked, ...props }) {
  const [open, setOpen] = useState(false)
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild>
      <Button type="button" variant="outline" className="cart-desc-bulk-button" disabled={disabled}>
        {linked.length ? '管理共用位置' : '应用到多个'}
      </Button>
    </DialogTrigger>
    <DialogContent className="cart-desc-dialog">
      {open && <BulkForm {...props} linked={linked} onClose={() => setOpen(false)} />}
    </DialogContent>
  </Dialog>
}
