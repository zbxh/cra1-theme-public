import { useState, useMemo, useEffect, useRef } from 'react'
import { Save, RotateCcw, AlertTriangle, FileText, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, PageHeader } from '@ui/card'
import { Button } from '@ui/button'
import { Badge, Alert, EmptyState, Skeleton } from '@ui/feedback'
import { ConfirmDialog } from '@ui/dialog'
import { useToast } from '@ui/toast'
import { websiteApi } from '../lib/api'
import schema from '../schema.json'
import Field, { fieldKeysOf } from './FieldWidget'
import { FloatingActions } from '../ui/FloatingActions'

/**
 * 官网主题控制（迁移自旧版 Alpine 管理台）
 *
 * 关键：字段 key、序列化格式、保存接口与旧版【完全一致】
 *   - schema 由 admin.js 的 SECTIONS 原样导出到 schema.json（见构建说明），
 *     因此不会出现「新版少了某个字段」。
 *   - rows/cards 类型沿用「行式文本」存储格式（含 ! 隐藏、> 子级 前缀），
 *     解析/序列化逻辑与旧版一致，保证前台读取不变。
 *   - 保存走同一个 api.save（写 config.json），不加任何新字段。
 *
 * 界面改为 shadcn 风格：左侧分组导航由 App 承担，这里用 Tabs 呈现组内配置项。
 */

const { sections, footerMenuSeed } = schema

/* -------------------------------------------------------------------------- */
/* rows 行式文本：解析 / 序列化（与旧版 admin.js 保持一致）                      */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */

/**
 * 官网主题配置（受控）
 *
 * 当前展示哪一组、哪一项**由外部传入**（侧栏负责导航），
 * 本组件只渲染该项的字段。
 *
 * 为什么把导航搬出去：
 *   配置分组与配置项原本在页面内又画一层「分组 + 项」卡片，
 *   与左侧栏形成两层重复导航、点击路径也长。
 *   现在侧栏统一承担，本页只保留字段区（整宽），层级不再重复。
 *
 * 保存仍是「按项」提交（只提交当前项字段），因此切页不会丢其他项的改动。
 */
export default function WebsiteTheme({
  group,
  itemKey,
  config, original, setConfig, setOriginal, loading, error, reload,
}) {
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  // 页脚菜单空态预填（与旧版一致，保证所见即所得）。
  // 注意：必须同时写进 original 作为基线，否则会被当成「用户未保存修改」，
  // 一进页面就提示「有 1 项未保存」并在离开时弹确认框。
  useEffect(() => {
    if (loading) return
    setConfig((c) => {
      if (!c || String(c.footer_menu_text || '').trim()) return c
      return { ...c, footer_menu_text: footerMenuSeed }
    })
    setOriginal((o) => {
      if (!o || String(o.footer_menu_text || '').trim()) return o
      return { ...o, footer_menu_text: footerMenuSeed }
    })
    // 仅在首次加载完成时执行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  const activeGroup = sections.find((s) => s.key === group) || sections[0]
  const activeItem = activeGroup?.items.find((i) => i.key === itemKey) || activeGroup?.items?.[0]

  // 当前项的未保存字段数（用于按钮文案与提示）。按「实际配置键」计，
  // cards 字段会展开成多个键，改了几处就报几处。
  //
  // ⚠️ 必须放在下面的 loading/error 提前返回之前：Hook 的调用数量不能随渲染变化，
  // 放到提前返回之后会让「加载中 → 加载完成」多出一个 Hook，触发 React #300。
  const itemDirtyCount = useMemo(() => {
    if (!activeItem || !config || !original) return 0
    let n = 0
    ;(activeItem.fields || []).forEach((f) => {
      fieldKeysOf(f).forEach((k) => { if (config[k] !== original[k]) n += 1 })
    })
    return n
  }, [activeItem, config, original])

  /* 页头操作区引用：悬浮操作条观察它是否滚出视野。
     必须声明在**所有提前 return 之前**——放在条件 return 之后会导致
     渲染路径不同时 Hook 数量变化（React #300：Rendered more hooks than during the previous render）。 */
  const actionsRef = useRef(null)

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }
  if (error) return <Alert tone="error">官网配置加载失败：{error}</Alert>
  if (!config) return <EmptyState title="没有可显示的配置" description="请刷新页面重试" />

  function setField(key, value) {
    setConfig((c) => ({ ...c, [key]: value }))
  }

  /** 只放弃当前项的改动（不动其他项已改内容） */
  function revertItem() {
    if (!activeItem || !original) return
    setConfig((c) => {
      const next = { ...c }
      // cards 字段实际占用的是一组扁平键，必须逐个还原
      ;(activeItem.fields || []).forEach((f) => fieldKeysOf(f).forEach((k) => { next[k] = original[k] }))
      return next
    })
    toast('已放弃本项修改')
  }

  async function saveCurrent() {
    const payload = {}
    if (activeItem) {
      (activeItem.fields || []).forEach((f) => {
        fieldKeysOf(f).forEach((k) => { if (config[k] !== original[k]) payload[k] = config[k] })
      })
    }
    if (!Object.keys(payload).length) {
      toast('当前页面没有需要保存的修改')
      return
    }
    setSaving(true)
    try {
      const r = await websiteApi.save(payload)
      if (r.status === 200) {
        // 响应契约统一：完整 resolved 配置在 data.config（服务端同时兼容顶层 config）。
        // 用响应重建基线后不再依赖 reload 兜底（reload 仍执行，保证与下一次 GET 一致）。
        const resolved = r.data?.config || r.config
        if (resolved && typeof resolved === 'object') {
          setConfig({ ...resolved })
          setOriginal(JSON.parse(JSON.stringify(resolved)))
        }
        reload()
        toast(r.msg || '保存成功，前台已生效')
      } else {
        toast(r.msg || '保存失败', 'error')
      }
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function doReset() {
    setSaving(true)
    try {
      const r = await websiteApi.reset()
      setConfirmReset(false)
      toast(r.msg || '已恢复默认', r.status === 200 ? 'success' : 'error')
      if (r.status === 200) reload()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }


  // 当前项的未保存字段数见上方 useMemo（必须位于提前返回之前）

  return (
    <div className="space-y-4">
      <PageHeader
        title={activeItem?.label || '官网主题配置'}
        description={activeItem?.hint || '仅影响 CRA1 官网（public/web/cra1），不会改动会员中心'}
        actions={
          /* data-page-actions：悬浮操作条据此判断"页头按钮是否滚出视野" */
          <div ref={actionsRef} data-page-actions className="flex flex-wrap items-center gap-2">
            {itemDirtyCount > 0 && <Badge tone="warning">本项有 {itemDirtyCount} 处未保存</Badge>}
            <Button variant="outline" size="sm" disabled={!itemDirtyCount}
                    onClick={revertItem}>
              <RotateCcw className="size-3.5" />还原本项
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmReset(true)}>恢复默认</Button>
            <Button size="sm" onClick={saveCurrent} disabled={saving}>
              <Save className="size-3.5" />{saving ? '保存中…' : '保存本项'}
            </Button>
          </div>
        }
      />

      {/* 字段区：导航已由左侧栏承担，这里占满宽度 */}
      <Card>
        <CardHeader>
          <CardTitle>{activeItem?.label}</CardTitle>
          {activeItem?.hint && <CardDescription>{activeItem.hint}</CardDescription>}
        </CardHeader>
        <CardContent className="space-y-4">
          {(activeItem?.fields || []).map((f) => (
            <Field key={f.key} field={f} value={config[f.key]}
                   onChange={(v) => setField(f.key, v)}
                   config={config} setField={setField} />
          ))}
        </CardContent>
      </Card>

      {/* 悬浮操作条：页头按钮滚出视野后出现，承载同一组操作 */}
      <FloatingActions
        anchorRef={actionsRef}
        saving={saving}
        dirtyCount={itemDirtyCount}
        dirtyLabel={`本项有 ${itemDirtyCount} 处未保存`}
        onSave={saveCurrent}
        saveLabel="保存本项"
        onRevert={revertItem}
        revertLabel="还原本项"
        revertDisabled={!itemDirtyCount}
        onReset={() => setConfirmReset(true)}
      />

      <ConfirmDialog
        open={confirmReset}
        title="恢复官网主题默认配置"
        description="将清空 runtime/cra1_theme/config.json 中的自定义值，官网回到默认内容。此操作不影响会员中心主题配置。"
        confirmText="确认恢复"
        tone="danger"
        busy={saving}
        onConfirm={doReset}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  )
}

