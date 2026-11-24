import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { Button } from '@ui/button'
import { Alert } from '@ui/feedback'
import { Input } from '@ui/input'
import { api } from '../lib/api'

const presentation = value => value === 'official' ? '完整官方页面' : '酷锐A1外壳'

export default function ModuleVerification({ moduleKey, changed, cart, panel }) {
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [host, setHost] = useState('')
  const [page, setPage] = useState(1)
  const [retry, setRetry] = useState(0)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const controller = new AbortController()
    setError('')
    setLoading(true)
    api('api.release.modules.verify.get', { key: moduleKey, search, page }, { reauth:false, signal:controller.signal })
      .then(response => {
        if (controller.signal.aborted) return
        if (response.status !== 200) throw new Error(response.msg || '模块商品目录暂时无法读取')
        setData(response.data)
      })
      .catch(failure => { if (!controller.signal.aborted) { setData(null); setError(failure.message || '模块商品目录暂时无法读取，请重试。') } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [moduleKey, search, page, retry])

  const hostId = host.trim()
  const panelUrl = /^[1-9]\d{0,14}$/.test(hostId) ? '/productdetail.htm?' + new URLSearchParams({ id: hostId, cra1_verify_module: moduleKey }) : ''
  return <section className="space-y-4 border-t border-line px-3 pb-4 pt-4" aria-label="模块快速验证">
    <p className="text-sm">已保存的设置 · 购物车：{presentation(cart)} · 产品控制面板：{presentation(panel)}</p>
    {changed && <Alert tone="warning">有未保存的展示设置，下面的入口使用已保存的设置。</Alert>}
    <section className="space-y-2" aria-label="验证购物车">
      <h3 className="text-sm font-medium">验证购物车选配</h3>
      <form className="flex flex-wrap items-center gap-2" onSubmit={event => {
        event.preventDefault()
        setSearch(query.trim())
        setPage(1)
        if (page === 1 && search === query.trim()) setRetry(value => value + 1)
      }}>
        <Input className="w-full max-w-xs" aria-label="关联商品名称或编号" placeholder="输入商品名称或编号" value={query} maxLength={70} onChange={event => setQuery(event.target.value)} />
        <Button variant="outline" type="submit" disabled={loading}>查询</Button>
      </form>
      {loading ? <p role="status" className="text-sm text-muted-foreground">正在读取关联商品…</p> : error ? <Alert tone="warning">{error} <Button variant="ghost" size="sm" onClick={() => setRetry(value => value + 1)}>重试</Button></Alert> : data && <>
        {!data.enabled && <Alert tone="warning">V10 中未启用此模块。启用后可验证对应购物车入口。</Alert>}
        {data.products.length ? <ul className="divide-y divide-line rounded-md border border-line">
          {data.products.map(product => <li key={product.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            <div className="min-w-0"><p className="break-words text-sm font-medium">{product.name}</p><p className="break-words text-xs text-muted-foreground">#{product.id} { [product.parent, product.group].filter(Boolean).join(' / ') }</p></div>
            {product.url ? <Button asChild variant="outline" size="sm"><a href={product.url+'&cra1_verify_module='+encodeURIComponent(moduleKey)} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-4" />打开选配页</a></Button>
              : <span className="text-xs text-muted-foreground">{product.hidden ? '商品或分组已隐藏' : '模块未启用'}</span>}
          </li>)}
        </ul> : <p className="text-sm text-muted-foreground">{search ? '没有匹配的关联商品。' : '此模块暂无关联商品。'}</p>}
        {data.pages > 1 && <div className="flex flex-wrap items-center gap-2 text-sm">
          <Button size="sm" variant="outline" disabled={data.page <= 1} onClick={() => setPage(data.page - 1)}>上一页</Button>
          <span>第 {data.page} / {data.pages} 页，共 {data.total} 项</span>
          <Button size="sm" variant="outline" disabled={data.page >= data.pages} onClick={() => setPage(data.page + 1)}>下一页</Button>
        </div>}
      </>}
    </section>
    <section className="space-y-2" aria-label="验证产品控制面板">
      <h3 className="text-sm font-medium">验证产品控制面板</h3>
      <p className="text-sm text-muted-foreground">请先在当前浏览器登录测试会员，再输入该会员的实例编号。打开面板后核对实际模块、展示方式和手机回退。</p>
      <div className="flex flex-wrap items-center gap-2">
        <Input className="w-full max-w-xs" aria-label="测试会员的实例编号" placeholder="输入实例编号" inputMode="numeric" value={host} maxLength={15} onChange={event => setHost(event.target.value)} />
        {panelUrl ? <Button asChild size="sm" variant="outline"><a href={panelUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-4" />打开面板验证</a></Button>
          : <Button size="sm" variant="outline" disabled>打开面板验证</Button>}
      </div>
      {hostId && !panelUrl && <p className="text-sm text-muted-foreground">请输入有效的数字编号。</p>}
    </section>
  </section>
}
