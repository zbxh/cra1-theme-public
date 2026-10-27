import { useScopedState, clone } from '../lib/workspace'
import cartDefaults from '../cart.defaults.json'
import { useState, useEffect, useRef } from 'react'
import { Save, RotateCcw, Plus, Trash2, Pencil, Power } from 'lucide-react'
import { Badge, Alert } from '@ui/feedback'
import { PageHeader, Card, CardContent, CardHeader, CardTitle } from '@ui/card'
import { Button } from '@ui/button'
import { Input, Label, Select, Textarea } from '@ui/input'
import { useToast } from '@ui/toast'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
  ConfirmDialog,
} from '@ui/dialog'
import SwitchControl from '../ui/Switch'
import { FloatingActions } from '../ui/FloatingActions'
import { DragHandle, DropBadge, DRAG_LIST_BASE, RowIconBtn, dragRowClass, useFlatDrag, DragAnnouncer } from '../ui/dragSort'
import { cn } from '@ui/utils'
import { cartApi } from '../lib/api'
import LinkPicker from './LinkPicker'
import IconPicker from '../ui/IconPicker'
import headingDefinitions from '../cart.headings.json'

function HeadingIconsForm({ value, onChange }) {
  const icons = value?.icons || {}, styles = value?.styles || {}
  return <div className="space-y-3">
    <p className="text-sm leading-6 text-muted-foreground">分别设置 16 个栏目图标与配色。未修改的栏目保留当前默认图形；桌面、手机和商品选配窗口共用设置。</p>
    {Object.entries(headingDefinitions).map(([key,definition]) => <section key={key} data-cart-heading-setting={key} aria-label={definition.label+'标题图标'} className="space-y-3 rounded-lg border border-line p-4">
      <h3 className="text-sm font-medium">{definition.label}</h3>
      <IconPicker label={definition.label+'图标'} value={icons[key] || ''} iconStyle={styles[key] || null} defaultKey={'default:cart:'+key} context="cart" onChange={(icon,style)=>onChange({icons:{...icons,[key]:icon},styles:{...styles,[key]:style}})}/>
    </section>)}
  </div>
}

/**
 * 购物车主题内容设置（schema v2）
 *
 * §4：每组相关文案 = 一条记录（行内摘要 + 编辑弹窗）；多条同类数据 = rows 三件套。
 * 记录：
 *   - 商品列表页文案（标题/副标题/卡片按钮/已选中按钮/分组简介）
 *   - 商品卡网格与密度（桌面/平板/手机列数、每批行数、描述行数）
 *   - 商品卡展示区块（rows：desc 恒含；顺序即展示顺序）
 *   - 购物车空态（标题/描述/按钮文字/目标）
 *   - 空态推荐位（开关+标题+商品 rows，商品用真实 product_id）
 *   - 结算页文案 / 订单结果页文案
 * v10 一级/二级导航名称由 /console/v1/common 下发，不在此配置（单一真相）。
 */

const SECTION_LABELS = {
  desc: '商品描述',
  tags: '专属标签',
  stock: '库存状态',
  promo: '活动信息',
  price: '价格/周期',
}

function Text({ label, desc, value, onChange, placeholder, max }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {desc && <p className="text-xs leading-5 text-muted">{desc}</p>}
      <Input aria-label={label} value={value ?? ''} maxLength={max} onChange={(e) => onChange(e.target.value)} placeholder={placeholder || '留空使用默认文案'} />
    </div>
  )
}

function Toggle({ label, desc, on, onChange }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-line bg-surface px-4 py-3">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-ink">{label}</p>
        {desc && <p className="mt-0.5 text-xs leading-5 text-muted">{desc}</p>}
      </div>
      <SwitchControl label={label} checked={!!on} onCheckedChange={onChange} />
    </div>
  )
}

function RowSummary({ fields }) {
  const filled = fields.filter(([, v]) => v !== '' && v !== undefined && v !== null && v !== false)
  if (!filled.length) return <div className="text-xs text-muted">未配置（前台使用默认文案/默认值）</div>
  return (
    <div className="min-w-0 text-xs text-muted">
      {filled.slice(0, 2).map(([k, v]) => (
        <div key={k} className="truncate">{k}：{String(v)}</div>
      ))}
      {filled.length > 2 && <div>等 {filled.length} 项</div>}
    </div>
  )
}

function NumberPick({ label, desc, value, options, onChange }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {desc && <p className="text-xs leading-5 text-muted">{desc}</p>}
      <Select aria-label={label} value={String(value)} onChange={(e) => onChange(Number(e.target.value))}>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </Select>
    </div>
  )
}

/** 推荐条目编辑弹窗（rows 单条：真实商品 + 可选标题/描述覆盖） */
function ItemForm({ item, products, onSubmit, onCancel }) {
  const [form, setForm] = useState(item)
  const set = (patch) => setForm({ ...form, ...patch })
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onCancel() }}>
      <DialogContent className="w-[min(94vw,520px)]">
        <DialogHeader>
          <DialogTitle>编辑推荐条目</DialogTitle>
          <DialogDescription>商品必须从真实商品清单选择；标题/描述留空则使用商品自带信息</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>商品</Label>
            <ProductSelect value={form.product_id} products={products} onChange={(v) => set({ product_id: v })} />
          </div>
          <Text label="标题覆盖" value={form.title_override} onChange={(v) => set({ title_override: v })} placeholder="留空使用商品名称" />
          <div className="space-y-1.5">
            <Label>描述覆盖</Label>
            <Textarea rows={2} value={form.desc_override ?? ''} onChange={(e) => set({ desc_override: e.target.value })} placeholder="留空使用商品描述" />
          </div>
          <Toggle label="启用" on={form.enabled !== false} onChange={(v) => set({ enabled: v })} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>取消</Button>
          <Button onClick={() => { if (form.product_id > 0) onSubmit(form) }}>应用到草稿</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** 商品选择器：真实商品（api.product-options），按分组分组展示 */
function ProductSelect({ value, onChange, products }) {
  if (!products.length) {
    return <div className="text-xs text-muted">商品清单加载中…</div>
  }
  const byGroup = {}
  products.forEach((p) => {
    const g = `${p.group} / ${p.sub}`.replace(/^ \/ $/, '未分组');
    (byGroup[g] = byGroup[g] || []).push(p)
  })
  return (
    <Select aria-label="推荐商品" value={String(value || '')} onChange={(e) => onChange(Number(e.target.value))}>
      <option value="">选择商品…</option>
      {Object.entries(byGroup).map(([g, list]) => (
        <optgroup key={g} label={g}>
          {list.map((p) => (
            <option key={p.id} value={p.id}>{p.name}（¥{p.price}/{p.cycle}）</option>
          ))}
        </optgroup>
      ))}
    </Select>
  )
}

export default function CartContent({ workspace, scope = 'goodslist', block }) {
  const toast = useToast()
  const actionsRef = useRef(null)
  const [loading, setLoading] = useState(!workspace)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useScopedState(workspace, '', null)
  const [original, setOriginal] = useScopedState(workspace, '', null, true)
  const [version, setVersion] = useState(0)
  const [error, setError] = useState('')
  const [liveMsg, setLiveMsg] = useState('')
  const [products, setProducts] = useState([])
  const [productError, setProductError] = useState('')
  const [productAttempt, setProductAttempt] = useState(0)
  // 编辑中：groupEditing = 组 key；rowDraft = {group, sub, index?} 弹窗暂存
  const [groupEditing, setGroupEditing] = useState(null)
  const [groupDraft, setGroupDraft] = useState(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [itemEditing, setItemEditing] = useState(null) // {index, draft} 推荐条目编辑弹窗

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [res, pr] = await Promise.all([cartApi.get(), cartApi.products().catch(() => null)])
      if (res.status !== 200) throw new Error(res.msg || '加载失败')
      setConfig(res.data.config)
      setOriginal(JSON.parse(JSON.stringify(res.data.config)))
      setVersion(res.data.config.version || 0)
      if (pr && pr.status === 200) setProducts(pr.data.products || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (workspace) {
    setProductError('')
    cartApi.products().then((r) => { if (r.status !== 200) throw new Error(r.msg || '商品清单读取失败'); setProducts(r.data.products || r.data.list || []) }).catch((e) => setProductError(e.message)); return
  } load() }, [productAttempt])

  // 未保存切换提醒（registerDomainDirty 精神：不让静默丢改动）
  useEffect(() => {
    const dirty = config && original && JSON.stringify(config.content) !== JSON.stringify(original.content)
    const handler = (e) => { if (dirty) e.preventDefault() }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [config, original])

  const setPath = (group, sub, patch) => {
    setConfig((c) => ({
      ...c,
      content: {
        ...c.content,
        [group]: { ...c.content[group], [sub]: { ...c.content[group][sub], ...patch } },
      },
    }))
  }

  const dirtyCount = config && original
    ? Object.keys(config.content).filter(
        (g) => JSON.stringify(config.content[g]) !== JSON.stringify(original.content[g]),
      ).length
    : 0

  /* ---- rows 拖拽 hooks（必须在提前 return 之前调用，保证 hooks 顺序稳定） ---- */
  const recItems = config?.content?.shoppingcar?.recommendations?.items || []
  const secItems = config?.content?.goodslist?.card_sections || []
  const recName = (pid) => products.find((x) => x.id === pid)?.name || `商品 #${pid}`
  const recDrag = useFlatDrag({
    count: () => recItems.length,
    onMove: (from, to) => {
      if (from === to || from < 0 || to < 0 || from >= recItems.length || to >= recItems.length) return
      const next = recItems.slice()
      const [it] = next.splice(from, 1)
      next.splice(to, 0, it)
      setPath('shoppingcar', 'recommendations', { items: next })
    },
    keyOf: (it) => it?.id,
    onAnnounce: setLiveMsg,
  })
  const secDrag = useFlatDrag({
    count: () => secItems.length,
    onMove: (from, to) => {
      if (from === to || from < 0 || to < 0 || from >= secItems.length || to >= secItems.length) return
      const next = secItems.slice()
      const [it] = next.splice(from, 1)
      next.splice(to, 0, it)
      setConfig((cfg) => ({
        ...cfg,
        content: { ...cfg.content, goodslist: { ...cfg.content.goodslist, card_sections: next } },
      }))
    },
    keyOf: (it) => it?.key,
    onAnnounce: setLiveMsg,
  })

  const save = async () => {
    if (workspace) return workspace.save()
    setSaving(true)
    try {
      const res = await cartApi.save({ version, content: config.content })
      if (res.status === 409) {
        toast('配置已被其他会话修改，请刷新后重试', 'error')
        return
      }
      if (res.status !== 200) throw new Error(res.msg || '保存失败')
      setConfig(res.data.config)
      setOriginal(JSON.parse(JSON.stringify(res.data.config)))
      setVersion(res.data.config.version || 0)
      toast(res.data?.snapshot_ok === false ? '已保存，但前台快照写入失败' : '已保存，购物车前台已生效')
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const doReset = async () => {
    setConfirmReset(false)
    try {
      const res = await cartApi.reset()
      if (res.status !== 200) throw new Error(res.msg || '重置失败')
      setConfig(res.data.config)
      setOriginal(JSON.parse(JSON.stringify(res.data.config)))
      setVersion(res.data.config.version || 0)
      toast('已恢复默认')
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-muted">加载中…</div>
  }
  if (error || !config) {
    return (
      <div className="space-y-4 p-6">
        <div className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">{error || '配置加载失败'}</div>
        <Button variant="outline" onClick={load}>重试</Button>
      </div>
    )
  }

  const c = { ...cartDefaults.content, ...config.content }
  const gl = c.goodslist

  /* ---- 记录行（§4 一条记录 + 编辑弹窗） ---- */
  const RECORDS = [
    {
      key: 'goodslist.copy',
      group: 'goodslist', sub: 'copy',
      label: '商品列表页文案',
      fields: [['标题', gl.copy.title], ['副标题', gl.copy.subtitle], ['卡片列表标题', gl.copy.card_title], ['选配方式标题', gl.copy.tabs_title], ['分组简介', gl.copy.show_desc === false ? '已关闭' : '']],
    },
    {
      key: 'goodslist.grid',
      group: 'goodslist', sub: 'grid',
      label: '商品卡网格与密度',
      fields: [['桌面列数', gl.grid.desktop_columns], ['平板列数', gl.grid.tablet_columns], ['手机列数', gl.grid.mobile_columns], ['每批行数', gl.grid.rows_per_load], ['描述行数', gl.grid.desc_max_lines]],
    },
    {
      key: 'goodslist.card_sections',
      group: 'goodslist', sub: 'card_sections',
      label: '商品卡展示区块',
      fields: [['启用区块', gl.card_sections.filter((s) => s.enabled).map((s) => SECTION_LABELS[s.key] || s.key).join('、') || '（名称恒显）']],
    },
    { key:'goodslist.default_selection', group:'goodslist', sub:'default_selection', label:'默认商品选择', fields:[['默认商品',products.find(p=>String(p.id)===String(gl.default_selection.product_id))?.name || (gl.default_selection.product_id?'原有商品':'首个可售商品')]] },
    { key:'goodslist.config_panel', group:'goodslist', sub:'config_panel', label:'配置区行为', fields:[['默认展开',gl.config_panel.default_open ? '是' : '否']] },
    { key:'goodslist.heading_icons', group:'goodslist', sub:'heading_icons', label:'标题图标', fields:[['自定义图标',Object.values(gl.heading_icons || {}).filter(Boolean).length+' 个']] },
    {
      key: 'shoppingcar.empty',
      group: 'shoppingcar', sub: 'empty',
      label: '购物车空态文案',
      fields: [['标题', c.shoppingcar.empty.title], ['描述', c.shoppingcar.empty.description], ['按钮', c.shoppingcar.empty.button_text], ['目标', c.shoppingcar.empty.button_target]],
    },
    {
      key: 'shoppingcar.recommendations',
      group: 'shoppingcar', sub: 'recommendations',
      label: '空态推荐位',
      fields: [['启用', c.shoppingcar.recommendations.enabled], ['标题', c.shoppingcar.recommendations.title], ['条目', c.shoppingcar.recommendations.items.length ? `${c.shoppingcar.recommendations.items.length} 个商品` : '']],
    },
    {
      key: 'settlement.copy',
      group: 'settlement', sub: 'copy',
      label: '结算页文案',
      fields: [['标题', c.settlement.copy.title], ['协议勾选文案', c.settlement.copy.agree_text]],
    },
    {
      key: 'orderresult.copy',
      group: 'orderresult', sub: 'copy',
      label: '订单结果页文案',
      fields: [['支付成功标题', c.orderresult.copy.success_title], ['未完成支付标题', c.orderresult.copy.cancel_title], ['待处理标题', c.orderresult.copy.pending_title]],
    },
  ]



  const openGroup = (rec) => { setGroupDraft(rec.sub==='heading_icons' ? {icons:clone(c.goodslist.heading_icons||{}),styles:clone(c.goodslist.heading_icon_styles||{})} : clone(c[rec.group][rec.sub])); setGroupEditing(rec) }
  const submitGroup = (next) => {
    setConfig((cfg) => ({
      ...cfg,
      content: { ...cfg.content, [groupEditing.group]: { ...cfg.content[groupEditing.group], ...(groupEditing.sub==='heading_icons'?{heading_icons:next.icons,heading_icon_styles:next.styles}:{[groupEditing.sub]: next}) } },
    }))
    setGroupEditing(null)
  }

  const hotOn = !!c.shoppingcar.recommendations.enabled

  /* ---- 记录编辑弹窗内容 ---- */
  function GroupFormBody(directRec) {
    const g = directRec?.group||groupEditing.group, sub = directRec?.sub||groupEditing.sub
    const cur = directRec?c[g][sub]:groupDraft
    const setDraft=directRec?(fn)=>setConfig(old=>({...old,content:{...old.content,[g]:{...old.content[g],[sub]:typeof fn==='function'?fn(old.content[g][sub]):fn}}})):setGroupDraft
    if (g==='goodslist' && sub==='heading_icons') return <HeadingIconsForm value={directRec?{icons:c.goodslist.heading_icons||{},styles:c.goodslist.heading_icon_styles||{}}:cur} onChange={directRec ? next=>setConfig(old=>({...old,content:{...old.content,goodslist:{...old.content.goodslist,heading_icons:next.icons,heading_icon_styles:next.styles}}})) : setGroupDraft}/>
    if (g === 'goodslist' && sub === 'copy') {
      return (
        <>
          <Text label="页面标题" desc="替代默认的「订购产品」" value={cur.title} onChange={(v) => setDraft((old) => ({ ...old, title: v }))} />
          <Text label="副标题" desc="标题下方的一行说明" value={cur.subtitle} onChange={(v) => setDraft((old) => ({ ...old, subtitle: v }))} />
          <Text label="卡片列表标题" desc="商品卡片区上方的区块标题；留空则不显示" value={cur.card_title} onChange={(v) => setDraft((old) => ({ ...old, card_title: v }))} placeholder="产品型号" />
          <Text label="选配方式标题" desc="「快速配置/自定义配置」切换区上方的区块标题" value={cur.tabs_title} onChange={(v) => setDraft((old) => ({ ...old, tabs_title: v }))} placeholder="选配方式" />
          <Toggle label="显示分组简介" desc="二级分组的说明文字（超出滚动）" on={cur.show_desc !== false} onChange={(v) => setDraft((old) => ({ ...old, show_desc: v }))} />
        </>
      )
    }
    if (g === 'goodslist' && sub === 'grid') {
      return (
        <>
          <div aria-label="商品卡片排列示意" className="grid gap-2 rounded border border-line p-3" style={{gridTemplateColumns:`repeat(${cur.desktop_columns},minmax(0,1fr))`}}>{Array.from({length:cur.desktop_columns}).map((_,i)=><div key={i} className="rounded border border-line bg-surface-alt p-2 text-center text-xs">商品卡片</div>)}</div><NumberPick label="桌面端每行卡片数" desc="≥1280px 屏幕；2–4 列" value={cur.desktop_columns} options={[2, 3, 4]} onChange={(v) => setDraft((old) => ({ ...old, desktop_columns: v }))} />
          <NumberPick label="平板端每行卡片数" desc="768–1279px；1–3 列" value={cur.tablet_columns} options={[1, 2, 3]} onChange={(v) => setDraft((old) => ({ ...old, tablet_columns: v }))} />
          <NumberPick label="手机端每行卡片数" desc="<768px；1–2 列（360px 窄屏强制 1 列防溢出）" value={cur.mobile_columns} options={[1, 2]} onChange={(v) => setDraft((old) => ({ ...old, mobile_columns: v }))} />
          <NumberPick label="每次滚动加载行数" desc="每批加载 = 行数 × 当前列数（1–6 行）" value={cur.rows_per_load} options={[1, 2, 3, 4, 5, 6]} onChange={(v) => setDraft((old) => ({ ...old, rows_per_load: v }))} />
          <NumberPick label="描述最大行数" desc="卡片描述超出后折叠（1–12 行）" value={cur.desc_max_lines} options={[1, 2, 3, 4, 5, 6, 8, 10, 12]} onChange={(v) => setDraft((old) => ({ ...old, desc_max_lines: v }))} />
        </>
      )
    }
    if (g === 'goodslist' && sub === 'default_selection') return <div className="space-y-2"><Label>默认商品</Label><Select aria-label="默认商品" value={String(cur.product_id || 0)} onChange={(e) => setDraft({ product_id:Number(e.target.value) })}><option value="0">首个可售商品</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select><p className="text-xs text-muted-foreground">指定商品不在当前分组或不可售时，前台使用首个可售商品。</p></div>
    if (g === 'goodslist' && sub === 'config_panel') return <Toggle label="默认展开配置区" on={cur.default_open} onChange={(v) => setDraft({ default_open:v })} />
    if (g === 'shoppingcar' && sub === 'empty') {
      return (
        <>
          <Text label="空态标题" value={cur.title} onChange={(v) => setDraft((old) => ({ ...old, title: v }))} />
          <Text label="空态描述" value={cur.description} onChange={(v) => setDraft((old) => ({ ...old, description: v }))} />
          <Text label="按钮文案" desc="留空则不显示按钮" value={cur.button_text} onChange={(v) => setDraft((old) => ({ ...old, button_text: v }))} />
          <div className="space-y-2"><Label>按钮跳转目标</Label><LinkPicker label="按钮跳转目标" value={cur.button_target} onChange={v=>setDraft(old=>({...old,button_target:v}))}/></div>
        </>
      )
    }
    if (g === 'settlement' && sub === 'copy') {
      return (
        <>
          <Text label="页面标题" desc="替代默认的「请核对商品信息」" value={cur.title} onChange={(v) => setDraft((old) => ({ ...old, title: v }))} />
          <Text label="协议勾选文案" desc="勾选框后的文字前缀；《服务协议》《隐私协议》链接由系统术语设置提供" value={cur.agree_text} onChange={(v) => setDraft((old) => ({ ...old, agree_text: v }))} />
        </>
      )
    }
    if (g === 'orderresult' && sub === 'copy') {
      return (
        <>
          <Text label="支付成功标题" value={cur.success_title} onChange={(v) => setDraft((old) => ({ ...old, success_title: v }))} />
          <Text label="未完成支付标题" desc="取消支付 / 待支付时显示" value={cur.cancel_title} onChange={(v) => setDraft((old) => ({ ...old, cancel_title: v }))} />
          <Text label="待处理标题" desc="无法确认支付状态时显示" value={cur.pending_title} onChange={(v) => setDraft((old) => ({ ...old, pending_title: v }))} />
        </>
      )
    }
    return null
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="购物车主题"
        description="商品列表 / 购物车 / 结算 / 订单结果页面的文案与布局；与官网、会员中心配置完全独立。一级/二级导航名称读取系统设置（常规设置 → 主题设置）。"
        actions={
          <div ref={actionsRef} data-page-actions className="flex items-center gap-2">
            {dirtyCount > 0 && <Badge tone="warning">{dirtyCount} 组未保存</Badge>}
            <Button variant="outline" size="sm" disabled={!dirtyCount}
                    onClick={() => setConfig(JSON.parse(JSON.stringify(original)))}>
              <RotateCcw className="size-3.5" />撤销
            </Button>
            <Button size="sm" onClick={save} disabled={saving || !dirtyCount}>
              <Save className="size-3.5" />{saving ? '保存中…' : '保存'}
            </Button>
          </div>
        }
      />

      {productError && <Alert tone="warning">{productError}<Button className="ml-3" variant="outline" onClick={() => setProductAttempt((n) => n+1)}>重试商品清单</Button></Alert>}
      {block && !['card_sections','recommendations'].includes(block)?<Card><CardHeader><CardTitle>{RECORDS.find(r=>r.group===scope&&r.sub===block)?.label}</CardTitle></CardHeader><CardContent className="space-y-5">{GroupFormBody({group:scope,sub:block})}</CardContent></Card>:!block&&(<>
      {/* 页面文案记录（一条记录 + 编辑弹窗） */}
      <Card>
        <CardHeader>
          <CardTitle>页面文案与布局</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {RECORDS.filter((rec) => rec.group === scope).map((rec) => (
            <div key={rec.key} className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface px-4 py-2.5">
              <div className="w-full shrink-0 sm:w-[150px] text-[13px] font-medium text-ink">{rec.label}</div>
              <div className="min-w-0 flex-1"><RowSummary fields={rec.fields} /></div>
              <RowIconBtn label="编辑" onClick={() => openGroup(rec)}>
                <Pencil className="size-4" />
              </RowIconBtn>
            </div>
          ))}
        </CardContent>
      </Card>

      </>)}
      {/* 商品卡展示区块 rows（三件套） */}
      {scope === 'goodslist' && (!block||block==='card_sections') && (
      <Card>
        <CardHeader>
          <CardTitle>商品卡展示区块</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted">卡片名称固定展示；以下区块可拖拽排序、逐条显隐。拖拽或键盘（空格抓取 → 方向键 → 空格放置）操作。</p>
          <div className={cn('rounded-lg border border-line', DRAG_LIST_BASE)} role="list" aria-label="展示区块">
            <DragAnnouncer message={liveMsg} />
            {secItems.map((sec, i) => (
              <div
                key={sec.key}
                role="listitem"
                draggable
                {...secDrag.itemProps(i)}
                className={dragRowClass({ isDragging: secDrag.isDragging(i), isOver: secDrag.isOver(i) })}
              >
                <DragHandle {...secDrag.handleProps(i, '拖拽排序：' + (SECTION_LABELS[sec.key] || sec.key))} />
                {secDrag.isOver(i) && <DropBadge pos={secDrag.dropPos} />}
                <div className="min-w-0 flex-1 text-[13px] font-medium text-ink">
                  {SECTION_LABELS[sec.key] || sec.key}
                  {sec.key === 'desc' && <span className="ml-2 text-xs text-muted"></span>}
                </div>
                <RowIconBtn label={sec.enabled === false ? '显示' : '隐藏'} onClick={() => {
                  const list = secItems.map((x, xi) => xi === i ? { ...x, enabled: x.enabled === false } : x)
                  setConfig((cfg) => ({ ...cfg, content: { ...cfg.content, goodslist: { ...cfg.content.goodslist, card_sections: list } } }))
                }}>
                  <Power className="size-4" />
                </RowIconBtn>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      )}

      {/* 空态推荐位（rows：真实商品选择器） */}
      {scope === 'shoppingcar' && (!block||block==='recommendations') && (
      <Card>
        <CardHeader>
          <CardTitle>购物车空态热门推荐位</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Toggle label="启用推荐位" desc="购物车为空时展示推荐商品（使用真实商品数据，不可重复）" on={hotOn} onChange={(v) => setPath('shoppingcar', 'recommendations', { enabled: v })} />
          {hotOn && (
            <div className="space-y-2">
              <Text label="推荐位标题" value={c.shoppingcar.recommendations.title} onChange={(v) => setPath('shoppingcar', 'recommendations', { title: v })} />
              <div className={cn('rounded-lg border border-line', DRAG_LIST_BASE)} role="list" aria-label="推荐商品">
                <DragAnnouncer message={liveMsg} />
                {recItems.length === 0 && (
                  <div className="px-4 py-6 text-center text-xs text-muted">暂无条目，点击下方「添加商品」</div>
                )}
                {recItems.map((item, i) => (
                  <div
                    key={item.id || i}
                    role="listitem"
                    draggable
                    {...recDrag.itemProps(i)}
                    className={dragRowClass({ isDragging: recDrag.isDragging(i), isOver: recDrag.isOver(i) })}
                  >
                    <DragHandle {...recDrag.handleProps(i, '拖拽排序：' + recName(item.product_id))} />
                    {recDrag.isOver(i) && <DropBadge pos={recDrag.dropPos} />}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium text-ink">
                        {item.title_override || recName(item.product_id)}
                        {item.enabled === false && <span className="ml-2 text-xs text-muted">已隐藏</span>}
                      </div>
                    </div>
                    <RowIconBtn label={item.enabled === false ? '显示' : '隐藏'} onClick={() => {
                      const list = recItems.map((x, xi) => xi === i ? { ...x, enabled: x.enabled === false } : x)
                      setPath('shoppingcar', 'recommendations', { items: list })
                    }}>
                      <Power className="size-4" />
                    </RowIconBtn>
                    <RowIconBtn label="编辑" onClick={() => setItemEditing({ index: i, draft: { ...item } })}>
                      <Pencil className="size-4" />
                    </RowIconBtn>
                    <RowIconBtn label="删除" danger onClick={() => {
                      setPath('shoppingcar', 'recommendations', { items: recItems.filter((_, x) => x !== i) })
                    }}>
                      <Trash2 className="size-4" />
                    </RowIconBtn>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={() => {
                setPath('shoppingcar', 'recommendations', { items: [...recItems, { id: `h${Date.now().toString(36)}`, product_id: 0, title_override: '', desc_override: '', enabled: true }] })
              }}>
                <Plus className="size-3.5" /> 添加商品
              </Button>
              {recItems.some((x) => !x.product_id) && (
                <p className="text-xs text-warning">存在未选择商品的条目，保存时会被忽略。</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {!workspace && (<FloatingActions
        anchorRef={actionsRef}
        saving={saving}
        dirtyCount={dirtyCount}
        dirtyLabel={`${dirtyCount} 组未保存`}
        onSave={save}
        onRevert={() => setConfig(JSON.parse(JSON.stringify(original)))}
        revertLabel="撤销"
        revertDisabled={!dirtyCount}
        onReset={() => setConfirmReset(true)}
      />)}

      {/* 组级编辑弹窗（§4 一条记录） */}
      <Dialog open={!!groupEditing} onOpenChange={(o) => { if (!o) setGroupEditing(null) }}>
        <DialogContent className="w-[min(94vw,560px)]">
          <DialogHeader>
            <DialogTitle>{groupEditing ? RECORDS.find((r) => r.key === `${groupEditing.group}.${groupEditing.sub}`)?.label : ''}</DialogTitle>
            <DialogDescription>修改后应用到当前页草稿，点击页面保存后生效。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">{groupEditing && GroupFormBody()}</div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupEditing(null)}>取消</Button>
            <Button onClick={() => submitGroup(groupDraft)}>应用到草稿</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {itemEditing && (
        <ItemForm
          item={itemEditing.draft}
          products={products}
          onSubmit={(form) => {
            const list = recItems.map((x, xi) => xi === itemEditing.index ? { ...x, ...form } : x)
            setPath('shoppingcar', 'recommendations', { items: list })
            setItemEditing(null)
          }}
          onCancel={() => setItemEditing(null)}
        />
      )}

      <ConfirmDialog
        open={confirmReset}
        title="恢复默认设置"
        description="将清空全部购物车主题自定义配置（文案、列数、推荐位等），此操作不可撤销。"
        confirmText="确认恢复"
        tone="danger"
        onConfirm={doReset}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  )
}
