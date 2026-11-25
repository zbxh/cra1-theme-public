import { useState, useEffect, useMemo } from 'react'
import { Link2, Package, FileText, Pencil, Search, Phone } from 'lucide-react'
import { Input, Label, Select } from '@ui/input'
import { MenuSelect } from '@ui/select'
import { Button } from '@ui/button'
import { Badge } from '@ui/feedback'
import { cn } from '@ui/utils'
import { websiteApi } from '../lib/api'

/**
 * 链接选择器（供 rows 字段的 url 列使用）
 *
 * 三种来源：
 *   1. 主题页面：由服务端 manifest 提供（`api.link-options`，含 41 个真实页面 + 系统常用入口）
 *   2. v10 商品：按一级/二级分组列出商品，直接选到 /cart/goods.htm?id=N（`api.product-options`）
 *   3. 自定义：手写任意链接（含 #、/、https://、tel:、mailto:）
 *
 * 只负责「选出链接字符串」，写回仍走原有 cols 的 url 列，存储格式不变。
 */

const TABS = [
  { key: 'page', label: '主题页面', icon: FileText },
  { key: 'product', label: '商品', icon: Package },
  { key: 'contact', label: '联系方式', icon: Phone },
  { key: 'custom', label: '自定义', icon: Pencil },
]

function useLinkSource(open, request, validate) {
  const [result, setResult] = useState({ loading: true })
  const [attempt, setAttempt] = useState(0)
  const cached = result.data !== undefined

  useEffect(() => {
    if (!open || cached) return
    let active = true
    setResult({ loading: true })
    request().then(response => {
      if (response.status !== 200) throw new Error(response.msg || '暂时无法读取链接列表')
      if (!validate(response.data)) throw new Error('链接列表未能完整读取')
      if (active) setResult({ data: response.data })
    }).catch(error => {
      if (active) setResult({ error: error.message || '暂时无法读取链接列表' })
    })
    return () => { active = false }
  }, [open, request, validate, cached, attempt])

  return { ...result, retry: () => setAttempt(n => n + 1) }
}

const isPageList = data => Array.isArray(data?.pages)
const isProductList = data => Array.isArray(data?.products) && Array.isArray(data?.groups)

function LinkChoice({ name, url, group, onPick }) {
  return (
    <button type="button" onClick={() => onPick(url)}
            className="grid w-full gap-y-1 rounded-md px-2.5 py-1.5 text-left text-[13px] text-body transition-colors duration-150 hover:bg-surface-alt">
      <span className="min-w-0 [overflow-wrap:anywhere]">{name}</span>
      <span className="flex min-w-0 flex-wrap gap-x-2 text-[11px] text-muted-foreground">
        {group && <span className="min-w-0 [overflow-wrap:anywhere]">{group}</span>}
        <code className="min-w-0 font-mono [overflow-wrap:anywhere]">{url}</code>
      </span>
    </button>
  )
}

export default function LinkPicker({ value, onChange, placeholder, label='跳转链接', styledSelect=false }) {
  const Choice = styledSelect ? MenuSelect : Select
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('page')
  const pageSource = useLinkSource(open, websiteApi.linkOptions, isPageList)
  const productSource = useLinkSource(open, websiteApi.productOptions, isProductList)
  const source = tab === 'page' ? pageSource : tab === 'product' ? productSource : null
  const pages = pageSource.data?.pages
  const products = productSource.data
  const [q, setQ] = useState('')
  const [groupId, setGroupId] = useState('')
  const [contactType, setContactType] = useState(/^mailto:/.test(value||'')?'mailto':'tel')

  const filteredPages = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return pages || []
    return (pages || []).filter((p) => p.label.toLowerCase().includes(s) || p.url.toLowerCase().includes(s))
  }, [pages, q])

  const filteredProducts = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (products?.products || []).filter((p) => {
      if (groupId && String(p.group) !== String(groupId)) return false
      if (!s) return true
      return p.name.toLowerCase().includes(s) || String(p.sub||'').toLowerCase().includes(s)
    })
  }, [products, q, groupId])

  const pick = (url) => { onChange(url); setOpen(false); setQ('') }

  return (
    <div>
      <div className="flex items-center gap-2">
        <Input aria-label={label} value={value ?? ''} placeholder={placeholder||'选择链接或填写网址'}
               onChange={(e) => onChange(e.target.value)} />
        <Button type="button" size="sm" variant="outline" className="shrink-0"
                onClick={() => setOpen((v) => !v)}>
          <Link2 className="size-3.5" />选择链接
        </Button>
      </div>

      {open && (
        <div className="mt-2 overflow-hidden rounded-lg border border-line bg-surface">
          <div className="flex flex-wrap items-center gap-1 border-b border-line bg-surface-alt/60 p-2">
            {TABS.map((t) => {
              const Icon = t.icon
              return (
                <button key={t.key} type="button" onClick={() => { setTab(t.key); setQ('') }}
                        className={cn('inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[12px] transition-colors duration-150',
                                      tab === t.key ? 'bg-brand text-white' : 'text-body hover:bg-surface')}>
                  <Icon className="size-3.5" />{t.label}
                </button>
              )
            })}
            {['page','product'].includes(tab) && (
              <div className="relative ml-auto min-w-[10rem] flex-1 sm:flex-none">
                <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索…"
                       className="h-8 pl-7 text-[12px]" aria-label="搜索链接" />
              </div>
            )}
          </div>

          <div className="max-h-64 overflow-y-auto p-2">
            {source?.loading && <p role="status" className="px-2 py-3 text-[12px] text-muted-foreground">加载中…</p>}
            {source?.error && <div role="alert" className="flex flex-wrap items-center gap-2 p-2 text-xs text-danger">
              {source.error}<Button type="button" size="sm" variant="outline" onClick={source.retry}>重新读取</Button>
            </div>}

            {pages && tab === 'page' && (
              filteredPages.length === 0
                ? <p className="px-2 py-3 text-[12px] text-muted-foreground">没有匹配的页面</p>
                : filteredPages.map((p) => (
                  <LinkChoice key={p.url} name={p.label} url={p.url} onPick={pick} />
                ))
            )}

            {products && tab === 'product' && (
              <>
                <div className="mb-2 flex flex-wrap items-center gap-2 px-1">
                  <Label className="text-[11px] text-muted-foreground">分组</Label>
                  <Choice aria-label="商品分组" value={groupId} onChange={(e) => setGroupId(e.target.value)} className="h-8 w-40 text-[12px]">
                    <option value="">全部分组</option>
                    {(products.groups || []).map((g) => <option key={g.id} value={g.name}>{g.name}</option>)}
                  </Choice>
                  <Badge tone="muted">{filteredProducts.length} 个商品</Badge>
                </div>
                {filteredProducts.length === 0
                  ? <p className="px-2 py-3 text-[12px] text-muted-foreground">没有匹配的商品</p>
                  : filteredProducts.map((p) => (
                    <LinkChoice key={p.id} name={p.name} url={p.url}
                                group={[p.group, p.sub].filter(Boolean).join(' / ')} onPick={pick} />
                  ))}
              </>
            )}

            {tab === 'contact' && <div className="space-y-3 p-2"><Choice aria-label="联系方式类型" value={contactType} onChange={e=>setContactType(e.target.value)}><option value="tel">拨打电话</option><option value="mailto">发送邮件</option></Choice><Input aria-label={contactType==='tel'?'电话号码':'邮箱地址'} value={String(value||'').startsWith(contactType+':')?String(value).slice(contactType.length+1):''} placeholder={contactType==='tel'?'填写电话号码':'填写邮箱地址'} onChange={e=>onChange(e.target.value?contactType+':'+e.target.value:'')}/><Button variant="outline" size="sm" onClick={()=>setOpen(false)}>完成</Button></div>}
            {tab === 'custom' && (
              <div className="space-y-2 p-1">
                <p className="text-[12px] leading-5 text-muted-foreground">
                  直接在上方输入框填写链接。支持站内路径（<code className="font-mono">/about.html</code>）、
                  锚点（<code className="font-mono">/#pricing</code>）、外链（<code className="font-mono">https://…</code>）、
                  电话与邮箱（<code className="font-mono">tel:</code> / <code className="font-mono">mailto:</code>）。
                </p>
                <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>完成</Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
