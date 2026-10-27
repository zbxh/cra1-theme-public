import { useEffect, useMemo, useState } from 'react'
import { Package, Search, Loader2, Check } from 'lucide-react'
import { Button } from '@ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@ui/dialog'
import { cn } from '@ui/utils'

/**
 * 商品导入选择器（后台「产品与价格 → 指定商品」用）
 *
 * 为什么需要它：原先「指定商品」要手工填商品 ID（`商品ID|排序|标签`），
 * 运营得先去商品列表查 ID 再回来输入，既慢又容易填错。
 * 改为从商品库**多选导入**：按「一级 / 二级分组」分组展示，勾选后一次性写入，
 * 分组信息一并带出，避免再次手填。
 *
 * 数据来源：后台 `?r=api.products`（直连数据库读取，只读）。
 * 已导入的商品会标记「已导入」并禁用勾选，防止重复。
 */
export function ProductImporter({ open, onOpenChange, importedIds = [], onImport }) {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [picked, setPicked] = useState([])   // 勾选的商品 id
  const [kw, setKw] = useState('')
  const [attempt, setAttempt] = useState(0)

  /* 打开时拉取商品清单（只拉一次，关掉不清空，便于反复微调选择） */
  useEffect(() => {
    if (!open || list.length) return
    setLoading(true)
    setError('')
    fetch(`${location.pathname}?r=api.products`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window.__CRA1_ADMIN__?.csrf || '' },
      body: '{}',
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.status === 200) setList(d.data?.list || [])
        else setError(d.msg || '读取商品失败')
      })
      .catch(() => setError('读取商品失败，请稍后重试'))
      .then(() => setLoading(false))
  }, [open, list.length, attempt])

  const imported = useMemo(() => new Set(importedIds.map(String)), [importedIds])

  /* 按「一级 → 二级」分组，保留后台排序 */
  const groups = useMemo(() => {
    const map = new Map()
    for (const p of list) {
      const k1 = p.g1 || '未分组'
      if (!map.has(k1)) map.set(k1, new Map())
      const sub = map.get(k1)
      const k2 = p.g2 || '未分组'
      if (!sub.has(k2)) sub.set(k2, [])
      sub.get(k2).push(p)
    }
    // 关键词过滤：命中商品名或其所属分组名
    if (kw.trim()) {
      const q = kw.trim().toLowerCase()
      for (const [k1, sub] of [...map]) {
        for (const [k2, items] of [...sub]) {
          const hit = items.filter(
            (p) => p.name.toLowerCase().includes(q) || k1.toLowerCase().includes(q) || k2.toLowerCase().includes(q),
          )
          if (hit.length) sub.set(k2, hit)
          else sub.delete(k2)
        }
        if (!sub.size) map.delete(k1)
      }
    }
    return map
  }, [list, kw])

  const toggle = (id) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  const submit = () => {
    const chosen = list.filter((p) => picked.includes(p.id))
    if (chosen.length) onImport?.(chosen)
    setPicked([])
    onOpenChange(false)
  }

  const total = [...groups.values()].reduce((n, sub) => n + [...sub.values()].reduce((m, a) => m + a.length, 0), 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="size-4" />导入商品
          </DialogTitle>
          <DialogDescription>从系统商品库选择条目，应用后由当前工作区保存。</DialogDescription>
        </DialogHeader>

        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text" value={kw} onChange={(e) => setKw(e.target.value)}
            placeholder="搜索商品名或分组…"
            className="h-9 w-full rounded-md border border-line bg-surface pl-8 pr-3 text-[13px] outline-none focus:border-brand focus:ring-[3px] focus:ring-brand/15"
          />
        </div>

        <div className="max-h-[22rem] overflow-y-auto rounded-md border border-line">
          {loading && (
            <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />正在读取商品…
            </p>
          )}
          {!loading && error && <div className="py-10 text-center text-sm text-danger"><p>{error}</p><Button className="mt-3" variant="outline" onClick={() => setAttempt((n) => n+1)}>重试读取</Button></div>}
          {!loading && !error && total === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {list.length ? '没有匹配的商品' : '商品库为空'}
            </p>
          )}
          {!loading && !error && [...groups].map(([k1, sub]) => (
            <div key={k1}>
              <p className="sticky top-0 border-b border-line bg-surface-alt px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
                {k1}
              </p>
              {[...sub].map(([k2, items]) => (
                <div key={k2}>
                  <p className="border-b border-line/60 bg-surface px-3 py-1 text-[11px] text-muted-foreground">
                    {k2} · {items.length} 个
                  </p>
                  {items.map((p) => {
                    const isIn = imported.has(String(p.id))
                    const on = picked.includes(p.id)
                    return (
                      <button
                        key={p.id} type="button" disabled={isIn}
                        onClick={() => toggle(p.id)}
                        className={cn(
                          'flex w-full items-center gap-3 border-b border-line/60 px-3 py-2 text-left transition-colors duration-150 last:border-b-0',
                          isIn ? 'cursor-not-allowed opacity-50' : 'hover:bg-surface-alt',
                        )}
                      >
                        <span className={cn(
                          'flex size-4 shrink-0 items-center justify-center rounded border',
                          on ? 'border-brand bg-brand text-white' : 'border-line',
                        )}>
                          {on && <Check className="size-3" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] text-ink">{p.name}</span>
                          <span className="block text-[11px] text-muted-foreground">
                            #{p.id}{p.cycle ? ` · ${p.cycle}` : ''}{isIn ? ' · 已导入' : ''}
                          </span>
                        </span>
                        <span className="shrink-0 text-[12px] tabular-nums text-body">
                          {p.price === '' || p.price === null ? '咨询' : '￥' + p.price}
                        </span>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            已选 {picked.length} 个{total ? ` · 共 ${total} 个可选` : ''}
          </span>
          <span className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>取消</Button>
            <Button size="sm" disabled={!picked.length} onClick={submit}>
              导入{picked.length ? ` (${picked.length})` : ''}
            </Button>
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
