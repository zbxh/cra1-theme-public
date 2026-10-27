import { useState, useEffect } from 'react'
import { api } from '../lib'

/**
 * 账户信息页（React 内容区）
 *
 * 定位：本组件只负责「内容区」，外层导航（侧边栏 + 顶栏）由 Vue 主题组件提供。
 * 之所以能共存：外壳在 .template 里由 Vue 挂载，本组件挂载到外壳内部一个
 * v-pre 标记的空容器（Vue 跳过编译），两者互不接管对方的 DOM。
 */
export default function AccountPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    api('/account')
      .then((res) => { if (alive) setData(res.data?.account || {}) })
      .catch((e) => { if (alive) setError(e.message || '加载失败') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-7 w-40 animate-pulse rounded bg-line/60"></div>
        <div className="rounded-xl border border-line bg-surface p-6">
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-5 w-full animate-pulse rounded bg-line/50"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div role="alert" className="rounded-xl border border-danger/20 bg-danger/5 px-5 py-4 text-sm text-danger">
        {error}
      </div>
    )
  }

  const fields = [
    { label: '用户名', value: data.username },
    { label: '邮箱', value: data.email },
    { label: '手机号', value: data.phone ? `+${data.phone_code} ${data.phone}` : '' },
    { label: '公司', value: data.company },
    { label: '地址', value: data.address },
  ]

  return (
    <div>
      <h1 className="text-xl font-semibold text-ink">账户信息</h1>
      <p className="mt-1 text-sm text-muted">查看与维护你的账户资料</p>

      <div className="mt-5 rounded-xl border border-line bg-surface">
        <dl className="divide-y divide-line">
          {fields.map((f) => (
            <div key={f.label} className="flex gap-4 px-6 py-4">
              <dt className="w-24 shrink-0 text-sm text-muted">{f.label}</dt>
              <dd className="min-w-0 flex-1 text-sm text-ink break-all">{f.value || '—'}</dd>
            </div>
          ))}
        </dl>
      </div>

      <p className="mt-4 text-xs text-muted">
        该页面主体由 React 渲染，外层导航由主题的 Vue 组件提供 —— A2 方案验证。
      </p>
    </div>
  )
}
