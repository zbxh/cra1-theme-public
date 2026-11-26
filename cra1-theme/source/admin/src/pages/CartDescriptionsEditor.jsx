import { useEffect, useMemo, useState } from 'react'
import { Button } from '@ui/button'
import { Alert } from '@ui/feedback'
import { api } from '../lib/api'
import ContentEditor from '../components/ContentEditor'
import CartDescriptionBulk from './CartDescriptionBulk'
import { TargetPicker } from './CartDescriptionTargets'
import {
  bindingAt, changeBindings, covers, globalTarget, indexCatalog, isConfigured, missingTargets, previewRules,
  pruneShared, ruleAt, scopeNames, targetKey,
} from './cart-description-rules'

function selectionOf({ scope, id, name, path, selection, missing }) {
  return { scope, id, name, path, selection, missing }
}

export default function CartDescriptionsEditor({ rules, onChange, selected, onSelect }) {
  const [catalog, setCatalog] = useState(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setError('')
    api('api.cart.descriptions.catalog', {}, { signal: controller.signal }).then(result => {
      if (controller.signal.aborted) return
      if (result.status !== 200) throw new Error(result.msg || 'V10 商品目录暂时无法读取')
      setCatalog(result.data)
    }).catch(error => { if (!controller.signal.aborted) setError(error.message) })
    return () => controller.abort()
  }, [attempt])

  const index = useMemo(() => indexCatalog(catalog), [catalog])
  const orphans = catalog ? missingTargets(rules, index.targets) : []
  const target = selected || globalTarget
  const activeKey = targetKey(target)
  const current = index.targets.get(activeKey) || { ...target, missing: Boolean(catalog) || target.missing }
  const binding = bindingAt(rules, current)
  const ref = binding?.ref
  const rule = ruleAt(rules, current)
  const linked = ref ? [...index.targets.values(), ...orphans].filter(row =>
    targetKey(row) !== activeKey && bindingAt(rules, row)?.ref === ref) : []
  const retry = () => setAttempt(value => value + 1)
  const picker = { catalog, index, rules, error, onRetry: retry }
  const previewProduct = selected?.previewProduct && index.targets.get(targetKey(selected.previewProduct))
  const previewTarget = previewProduct && covers(current, previewProduct) ? previewProduct : current
  const previewSelection = previewTarget.selection || {}

  function update(patch) {
    const next = { ...rule, ...patch }
    if (ref) onChange({ ...rules, shared: { ...rules.shared, [ref]: next } })
    else onChange(changeBindings(rules, [current], next))
  }

  function replaceCurrent(value) {
    onChange(pruneShared(changeBindings(rules, [current], value)))
  }

  function sourceLabel(result) {
    if (result.mode === 'none') return '当前没有符合条件的主题说明'
    const row = index.targets.get(result.scope + ':' + result.id)
    const label = result.scope === 'global' ? globalTarget.name
      : scopeNames[result.scope] + ' · ' + (row?.name || '#' + result.id)
    return (result.mode === 'hide' ? '当前隐藏 · ' : '生效来源 · ') + label
  }

  const previewControls = current.scope !== 'product' && <div className="cart-desc-preview-picker">
    <span>预览商品</span>
    <TargetPicker {...picker} title="选择预览商品" description="查看所选商品的最终说明及生效来源。"
      current={previewTarget.scope === 'product' ? previewTarget : { ...current, path: '按当前对象预览' }}
      productsOnly allowProduct={row => covers(current, row)}
      onChoose={row => onSelect({ ...selectionOf(current), previewProduct: row ? selectionOf(row) : null })} />
  </div>

  return <div className="cart-desc-editor">
    <div className="cart-desc-filter">
      <TargetPicker {...picker} title="选择编辑对象" description="点击名称编辑说明。点击左侧箭头展开下级。"
        current={current} orphans={orphans} onChoose={row => onSelect(selectionOf(row))} />
      <CartDescriptionBulk disabled={!catalog || current.missing || (!isConfigured(binding))}
        current={current} rules={rules} index={index} catalog={catalog} orphans={orphans} linked={linked} onApply={onChange} />
    </div>
    <div className="cart-desc-mode">
      {current.scope !== 'global' && <span className="cart-desc-note">{scopeNames[current.scope]}</span>}
      {!current.missing && <div className="flex gap-1" role="group" aria-label="说明显示方式">
        <Button type="button" variant={rule.mode === 'custom' ? 'outline' : 'ghost'} size="sm" aria-pressed={rule.mode === 'custom'} onClick={() => update({ mode: 'custom' })}>自定义</Button>
        <Button type="button" variant={rule.mode === 'hide' ? 'outline' : 'ghost'} size="sm" aria-pressed={rule.mode === 'hide'} onClick={() => update({ mode: 'hide' })}>隐藏</Button>
      </div>}
      {isConfigured(binding) && <Button type="button" variant="ghost" size="sm" onClick={() => replaceCurrent(null)}>
        {ref ? '移除此处的规则' : '清除规则'}
      </Button>}
    </div>
    {!!linked.length && <div className="cart-desc-linked">
      <p>当前说明共用于 {linked.length + 1} 个位置，修改后同步生效。</p>
      {!current.missing && <Button type="button" variant="outline" size="sm" onClick={() => replaceCurrent(rule)}>复制并仅修改此处</Button>}
    </div>}
    {current.hidden && <p className="cart-desc-note">此对象在 V10 中未公开，开放后按规则显示。</p>}
    {current.missing ? <Alert>该对象已不在 V10 商品目录中。此处的规则不再生效。</Alert>
      : <ContentEditor key={activeKey + ':' + rule.mode} label="顶部说明内容" value={rule.html} onChange={html => update({ html })}
        editEnabled={rule.mode !== 'hide'} previewLayout="below" previewControls={previewControls}
        cartPreview={{ scope: current.scope, id: current.id, mode: rule.mode,
          selection: previewSelection, rules: previewRules(rules, current, previewSelection) }} describeSource={sourceLabel} />}
    <p className="cart-desc-note">匹配顺序为商品、二级分组、一级分组、全局。空内容继续匹配上级，隐藏规则会停止匹配。</p>
  </div>
}
