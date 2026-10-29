import {pluginLink} from '../lib'
import {useAccess} from '../ui/access'
import { PaymentLogo } from '../ui/payment-logo'
import { sharedReady } from '../shared'
import { useState, useEffect, useRef } from 'react'
import { Wallet, ShieldCheck, ArrowRight, RefreshCw, Check, Banknote, Smartphone, Landmark, CircleDollarSign } from 'lucide-react'
import { PageHeader, Card, CardContent } from '../ui/card'
import { Button } from '../ui/button'
import { Input, Field } from '../ui/input'
import { Alert, EmptyState, Skeleton } from '../ui/feedback'
import { useToast } from '../ui/toast'
import { cn } from '../ui/utils'
import { get, post, put, formatMoney, featureFlags, featureFlagsReady, commonData } from '../lib'

/**
 * 余额充值（/recharge.htm，专门页面）· 大厂费用中心式双栏布局
 *
 * 左栏（主操作）：
 *   - 充值金额：预设金额大卡（100/500/1000/5000）+ 自定义金额输入；
 *     选中态品牌描边 + 角标对勾（阿里云/腾讯云充值页式样）
 *   - 支付方式：卡片单选（图标 + 名称 + 选中对勾），不用下拉框
 * 右栏（订单摘要，桌面 sticky）：应付金额大字 + 支付方式回显 + 立即充值
 *
 * 后台限制（数据源 = 主题后台快照 features 投影，服务端二次校验）：
 *   recharge_open 总开关 / recharge_min,max 单笔限额 / 充值需实名（插件钩子）
 *   / recharge_money_notice 充值说明富文本
 */

const PRESET_AMOUNTS = [100, 500, 1000, 5000]

export default function RechargePage() {
  const toast = useToast()
  const {can} = useAccess()
  const permitted=can('Pay::recharge')
  const [feat, setFeat] = useState(() => featureFlags())
  const [account, setAccount] = useState(null)
  const [certError,setCertError]=useState(''),[loadError,setLoadError]=useState('')
  const submitLock=useRef(false)
  const [cert, setCert] = useState(null)          // /certification/info（登录态实名状态）
  const [gateways, setGateways] = useState([])
  const [gateway, setGateway] = useState('')
  const [amount, setAmount] = useState('')
  const [customFocus, setCustomFocus] = useState(false) // 自定义输入激活时预设卡退选
  const [orderId, setOrderId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [creationUnknown, setCreationUnknown] = useState(false)

  useEffect(() => {
    let alive = true
    featureFlagsReady().then(() => { if (alive) setFeat({ ...featureFlags() }) })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!permitted || !feat.ready || !feat.recharge_open) return
    get(can('Account::index') ? '/account' : '/index')
      .then((res) => setAccount(res.data?.account || null))
      .catch(e => setLoadError(e.message))
    get('/gateway')
      .then((res) => {
        const list = (res.data?.list || []).filter((g) => g.name && g.name !== 'credit')
        setGateways(list)
        setGateway((g) => g || list[0]?.name || '')
      })
      .catch(e => setLoadError(e.message))
  }, [feat.ready, feat.recharge_open])

  // 充值需实名：拉用户实时实名状态（仅在后台要求实名时才有意义）
  const needCertRule = !!(feat.certification?.recharge_need)
  useEffect(() => {
    if (!permitted || !feat.ready || !feat.recharge_open || !needCertRule) return
    get('/certification/info')
      .then((res) => setCert(res.data || null))
      .catch(e => {setCertError(e.message);setCert(null)})
  }, [feat.ready, needCertRule])

  const needCert = !!(needCertRule && cert && !cert.is_certification)
  const certChecking = !!(needCertRule && cert === null && !certError)

  const min = Number(feat.recharge_min) || 0
  const max = Number(feat.recharge_max) || 0
  const payAmount = Number(amount) || 0
  const selGateway = gateways.find((g) => g.name === gateway) || null
  const limitHint = min || max
    ? `单笔限额：${min ? `${formatMoney(min)}` : '无'} ~ ${max ? `${formatMoney(max)}` : '无'}`
    : ''

  function pickPreset(v) {
    setAmount(String(v))
    setCustomFocus(false)
  }

  async function submit() {
    if(orderId){try{(await sharedReady()).Payments.navigate({orderId,operation:'recharge',gateway})}catch(e){toast('订单已创建，请从财务中心继续支付','warning')}return}
    if (submitLock.current || busy || creationUnknown || loadError || certError || !feat.ready || !feat.recharge_open || certChecking || needCert) return
    const amt = Number(amount)
    if (!Number.isFinite(amt) || amt <= 0 || !/^\d+(?:\.\d{1,2})?$/.test(amount.trim())) return toast('请输入正确的充值金额', 'error')
    if (min && amt < min) return toast(`单笔最低充值 ${formatMoney(min)}`, 'error')
    if (max && amt > max) return toast(`单笔最高充值 ${formatMoney(max)}`, 'error')
    if (!gateway) return toast('请选择支付方式', 'error')
    submitLock.current=true;setBusy(true)
    let created = false
    try {
      const res = await post('/recharge', { amount: amt, gateway })
      const id = res.data?.id
      if (!id) throw new Error(res.msg || '创建充值订单失败')
      setOrderId(id)
      created = true
      ;(await sharedReady()).Payments.navigate({orderId:id,operation:'recharge',gateway})
    } catch (err) {
      if(!created && (!err.status || err.status >= 500 || err.code === 'BAD_RESPONSE'))setCreationUnknown(true)
      else toast(created ? '充值订单已创建，请继续支付当前订单' : err.message, 'error')
    } finally {
      submitLock.current=false;setBusy(false)
    }
  }

  if(!permitted)return <EmptyState title="当前页面暂不可用"/>
  return (
    <div className="space-y-4">
      {orderId&&<Alert>充值订单已创建。若未打开收银台，可点击下方按钮继续支付。</Alert>}
      {creationUnknown&&<Alert tone="warning">暂时无法确认充值订单是否已创建。请先查看订单列表，避免重复充值。<Button variant="link" onClick={()=>location.assign('/finance.htm')}>查看订单</Button></Alert>}
      {(loadError||certError)&&<Alert tone="error">页面错误，请刷新重试</Alert>}
      <PageHeader
        title="余额充值"
        description="为账户余额充值，可用于支付订单与续费"
      />

      {!feat.ready ? (
        <Card><CardContent className="p-5 space-y-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
        </CardContent></Card>
      ) : !feat.recharge_open ? (
        <Card>
          <CardContent className="p-5">
            <EmptyState
              icon={Wallet}
              title="当前页面暂不可用"
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 实名认证引导（后台要求充值实名且当前未实名） */}
          {needCert && (
            <Alert tone="warning">
              <div className="flex flex-wrap items-center gap-2">
                <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
                <span>根据平台规定，充值前需先完成实名认证。</span>
                <Button size="sm" variant="outline"
                        onClick={() => { window.location.href = pluginLink('certification') }}>
                  去实名认证<ArrowRight className="size-3.5" />
                </Button>
              </div>
            </Alert>
          )}
          {certChecking && (
            <Alert tone="default">
              <span className="inline-flex items-center gap-2">
                <RefreshCw className="size-3.5 animate-spin" aria-hidden="true" />正在校验实名状态…
              </span>
            </Alert>
          )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              {/* 左栏：金额 + 支付方式 */}
              <div className="space-y-4">
                <Card>
                  <CardContent className="p-5">
                    <p className="text-[14px] font-semibold text-ink">充值金额</p>
                    {limitHint && <p className="mt-1 text-xs text-muted-foreground">{limitHint}</p>}

                    {/* 预设金额大卡（选中态品牌描边 + 角标对勾） */}
                    <div className="mt-3.5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {PRESET_AMOUNTS.map((v) => {
                        const inRange = (!min || v >= min) && (!max || v <= max)
                        const active = amount === String(v)
                        return (
                          <button key={v} type="button" disabled={needCert || certChecking || !inRange}
                                  onClick={() => pickPreset(v)}
                                  aria-pressed={active}
                                  className={cn(
                                    'relative rounded-xl border px-4 py-3.5 text-left transition-all duration-150',
                                    'disabled:cursor-not-allowed disabled:opacity-40',
                                    active
                                      ? 'border-brand bg-brand/5 shadow-[0_0_0_1px_var(--brand)]'
                                      : 'border-line bg-surface hover:border-brand/60'
                                  )}>
                            <span className={cn('text-lg font-semibold tabular-nums', active ? 'text-brand' : 'text-ink')}>
                              {formatMoney(v)}
                            </span>
                            {active && (
                              <span className="absolute right-1.5 top-1.5 flex size-4.5 items-center justify-center rounded-full bg-brand text-white"
                                    aria-hidden="true">
                                <Check className="size-3" strokeWidth={3} />
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>

                    {/* 自定义金额 */}
                    <div className="mt-3 max-w-sm">
                      <Field label="自定义金额" required
                             hint={undefined}>
                        <Input value={amount} inputMode="decimal"
                               placeholder={`请输入金额（${formatMoney(min || 0.01)} 起）`}
                               disabled={needCert || certChecking}
                               onFocus={() => setCustomFocus(true)}
                               onChange={(e) => setAmount(e.target.value)} />
                      </Field>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-5">
                    <p className="text-[14px] font-semibold text-ink">支付方式</p>
                    {gateways.length === 0 ? (
                      <p className="mt-3 text-[13px] text-muted-foreground">暂无可用支付方式，请联系管理员配置支付网关</p>
                    ) : (
                      <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" role="radiogroup" aria-label="支付方式">
                        {gateways.map((g) => {
                          const active = gateway === g.name
                          return (
                            <button key={g.name} type="button" role="radio" aria-checked={active}
                                    disabled={needCert || certChecking}
                                    onClick={() => setGateway(g.name)}
                                    className={cn(
                                      'flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-150',
                                      'disabled:cursor-not-allowed disabled:opacity-40',
                                      active
                                        ? 'border-brand bg-brand/5 shadow-[0_0_0_1px_var(--brand)]'
                                        : 'border-line bg-surface hover:border-brand/60'
                                    )}>
                              <span className={cn(
                                'flex size-9 shrink-0 items-center justify-center rounded-lg',
                                active ? 'bg-brand/10 text-brand' : 'bg-surface-alt text-body'
                              )} aria-hidden="true">
                                <PaymentLogo gateway={g} />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className={cn('block truncate text-[13.5px] font-medium', active ? 'text-brand' : 'text-ink')}>
                                  {g.title || g.name}
                                </span>
                                {g.name === 'UserCustom' && (
                                  <span className="block truncate text-xs text-muted-foreground">提交后按平台指引付款</span>
                                )}
                              </span>
                              <span className={cn(
                                'flex size-4.5 shrink-0 items-center justify-center rounded-full border transition-colors duration-150',
                                active ? 'border-brand bg-brand text-white' : 'border-line'
                              )} aria-hidden="true">
                                {active && <Check className="size-3" strokeWidth={3} />}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* 右栏：订单摘要（桌面 sticky） */}
              <div>
                <Card className="lg:sticky lg:top-4">
                  <CardContent className="p-5">
                    <p className="text-[14px] font-semibold text-ink">充值信息</p>
                    <dl className="mt-4 space-y-3 text-[13px]">
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-muted-foreground">当前余额</dt>
                        <dd className="font-medium tabular-nums text-ink">{formatMoney(account?.credit)}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-muted-foreground">支付方式</dt>
                        <dd className={cn('max-w-[60%] truncate text-right font-medium', selGateway ? 'text-ink' : 'text-muted-foreground')}>
                          {selGateway ? (selGateway.title || selGateway.name) : '未选择'}
                        </dd>
                      </div>
                      <div className="border-t border-line pt-3">
                        <div className="flex items-end justify-between gap-3">
                          <dt className="text-muted-foreground">应付金额</dt>
                          <dd className="text-2xl font-semibold tabular-nums tracking-tight text-brand">
                            {formatMoney(payAmount)}
                          </dd>
                        </div>
                      </div>
                    </dl>
                    <Button className="mt-4 w-full" permission="Pay::recharge" disabled={busy || creationUnknown || !!loadError || !!certError || needCert || certChecking || !payAmount || !gateway}
                            onClick={submit}>
                      {busy ? '创建中…' : orderId ? '继续支付当前订单' : (needCert ? '实名认证后可充值' : '立即充值')}
                    </Button>
                    <p className="mt-3 text-xs leading-5 text-muted-foreground">
                      充值实时到账，可用于支付订单、续费与升级；支付遇到问题可联系客服处理。
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>

          {/* 后台提示文案（系统设置→货币与充值 的富文本） */}
          {feat.recharge_money_notice ? (
            <Card>
              <CardContent className="p-5">
                <p className="mb-2 text-[13px] font-medium text-ink">充值说明</p>
                <div className="cra1-rich-text text-[13px]"
                     dangerouslySetInnerHTML={{ __html: feat.recharge_money_notice }} />
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  )
}

/* 支付步骤：网关 HTML（二维码/自动提交表单）+ 状态轮询（完成自动刷新） */
