import { useScopedState } from '../lib/workspace'
import { useState, useEffect, useRef } from 'react'
import { Save, RotateCcw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, PageHeader } from '@ui/card'
import { Button } from '@ui/button'
import { Input, Label, Select } from '@ui/input'
import { Badge, Alert, Skeleton } from '@ui/feedback'
import { useToast } from '@ui/toast'
import { cn } from '@ui/utils'
import SwitchControl from '../ui/Switch'
import { FloatingActions } from '../ui/FloatingActions'
import { memberApi } from '../lib/api'

/**
 * 会员中心外观
 *
 * 只写 member_center.json 的 appearance 段。
 * 这里配置的是【会员中心】的展示，与官网主题无关；
 * 保存后前台 asideMenu/topMenu 通过快照读取。
 */
const TOGGLES = [
  { key: 'show_cart', label: '显示购物车', desc: '顶栏右侧购物车图标与数量角标' },
  { key: 'show_language', label: '显示语言切换', desc: '多语言站点切换入口' },
  { key: 'show_message', label: '显示消息中心', desc: '需安装 ClientCare 插件才生效' },
  { key: 'sidebar_default_open', label: '侧边栏默认展开', desc: '控制主导航打开后的默认宽度；会员手动折叠的选择优先' },
]

/* v20 手机端二级菜单折叠档位（仅手机端；PC 侧栏恒展开） */
const MOBILE_EXPAND_TIERS = [
  { value: 'one', label: '展开一个（默认）' },
  { value: 'all', label: '全部展开' },
  { value: 'none', label: '全部关闭' },
]

export default function MemberAppearance({ member, loading, error, reload, workspace }) {
  const toast = useToast()
  /* 页头操作区引用：悬浮操作条观察它是否滚出视野（Hook 顺序需稳定，故在所有提前 return 之前声明） */
  const actionsRef = useRef(null)
  const [form, setForm] = useScopedState(workspace, 'appearance', null)
  const [original, setOriginal] = useScopedState(workspace, 'appearance', null, true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!workspace && member?.appearance) {
      setForm({ aside_mobile_expand: 'one', ...member.appearance })
      setOriginal({ aside_mobile_expand: 'one', ...member.appearance })
    }
  }, [member])

  if (error) return <Alert tone="error">加载失败：{error}</Alert>
  if (loading || !form) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }
  if (error) return <Alert tone="error">加载失败：{error}</Alert>

  const dirty = Object.keys(form).filter((k) => form[k] !== original?.[k])

  async function save() {
    if (workspace) return workspace.save()
    setSaving(true)
    try {
      const r = await memberApi.saveAppearance({
        appearance: form,
        version: member.version,
      })
      if (r.status === 200) {
        toast(r.msg || '已保存，会员中心前台已生效')
        reload()
      } else if (r.status === 409) {
        toast(r.msg || '配置已被其他会话修改，请刷新后重试', 'error')
      } else {
        toast(r.msg || '保存失败', 'error')
      }
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="外观设置"
        description="会员中心外壳的展示开关；主题选择由系统后台「主题设置」控制"
        actions={
          <div ref={actionsRef} data-page-actions className="flex items-center gap-2">
            {dirty.length > 0 && <Badge tone="warning">{dirty.length} 项未保存</Badge>}
            <Button variant="outline" size="sm" onClick={() => setForm({ ...original })}>
              <RotateCcw className="size-3.5" />撤销
            </Button>
            <Button size="sm" onClick={save} disabled={saving || !dirty.length}>
              <Save className="size-3.5" />{saving ? '保存中…' : '保存'}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>顶栏与侧栏</CardTitle>
            <CardDescription>控制会员中心外壳上展示的元素</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {TOGGLES.map((t) => {
              const on = Number(form[t.key]) === 1
              return (
                <div key={t.key}
                     className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 rounded-lg border border-line bg-surface px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-ink">{t.label}</p>
                    <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{t.desc}</p>
                  </div>
                  <SwitchControl label={t.label} checked={on}
                                 onCheckedChange={(next) => setForm((f) => ({ ...f, [t.key]: next ? 1 : 0 }))} />
                </div>
              )
            })}
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3">
              <div className="min-w-0 flex-1 basis-48">
                <p className="text-[13px] font-medium text-ink">手机端二级菜单展开</p>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                  仅手机端：侧栏抽屉内二级分组菜单的默认展开档位；会员仍可手动展开更多或收起
                </p>
              </div>
              <Select
                value={form.aside_mobile_expand || 'one'}
                onChange={(e) => setForm((f) => ({ ...f, aside_mobile_expand: e.target.value }))}
                className="w-44 max-w-full shrink-0"
                aria-label="手机端二级菜单展开档位"
              >
                {MOBILE_EXPAND_TIERS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      <Alert tone="info">
        本页管理会员中心的展示与响应式设置。切换会员中心主题请前往系统后台“系统设置 → 主题设置”。
      </Alert>

      {/* 悬浮操作条：页头按钮滚出视野后出现，承载同一组操作 */}
      {!workspace && (<FloatingActions
        anchorRef={actionsRef}
        saving={saving}
        dirtyCount={dirty.length}
        dirtyLabel={`${dirty.length} 项未保存`}
        onSave={save}
        onRevert={() => setForm({ ...original })}
        revertLabel="撤销"
        revertDisabled={!dirty.length}
      />)}
    </div>
  )
}
