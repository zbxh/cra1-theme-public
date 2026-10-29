import {useReinstallPreset} from './app-presets'
import Cashier from '../../ui/cashier'
import { refundState } from '../../compat'
import { ChoiceButton } from '../../ui/choice'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, RefreshCw, ShieldQuestion, Trash2, Copy, Eye, EyeOff, Plus } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
  ConfirmDialog,
} from '../../ui/dialog'
import { Button } from '../../ui/button'
import { Badge, Alert, EmptyState, Skeleton } from '../../ui/feedback'
import { Input, Field, Label, Textarea, Checkbox } from '../../ui/input'
import { Select } from '../../ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../ui/tabs'
import { DateTimePicker } from '../../ui/date-time-picker'
import { useCaptcha } from '../../ui/captcha'
import { useToast } from '../../ui/toast'
import { get, api as requestApi, post, put, del, formatDate, formatMoney, commonData } from '../../lib'
import { cn } from '../../ui/utils'
import { formatBytes } from './format'
import { copyToClipboard } from './clipboard'
import { useDowngradeGate, DowngradeNotice, DowngradeAwareSubmit } from './DowngradeNotice'
import { filterItemsByResultWithMeta } from './limitRule'
import { preserveCurrentUpgradeOption, upgradeOptionValue } from './upgrade-options'
import { changedUpgradeResources } from './refresh-policy'
import { createPaymentPoller, isPaymentPaid } from './payment-status'
import { normalizeFlowPackets, defaultFlowPacketType, flowPacketDisabled, flowPacketOrderBody } from './flow-packets'
import { reinstallImages } from '../../lib/product-operations'
import { randomPassword } from './password'
import { useDialogRead } from './use-dialog-read'
import { createDiskOrderGuard, definiteOrderRejection, diskOrderScope, validQuoteAmount } from './order-guard'
import { releaseLocalValue, releaseTimestamp, releaseTimeText } from './auto-release-time'

/**
 * 服务器控制面板弹窗集。
 * 通用约定：
 * - 需要操作密码的写接口：服务端返回 data.operate_password===1 时弹出密码输入并重试
 * - 弹窗内下单（磁盘/备份/流量包/IP/升降级/续费）成功后统一打开 PayDialog 支付
 * - onDone 回调驱动卡片刷新
 */

/* ====================================================================== */
/* 通用片段                                                                */
/* ====================================================================== */

/** 操作密码输入（服务端要求时出现） */
/** 内联错误文案：挂在字段下方（替代一闪而过的 toast，用户可对照修改） */
function FieldError({ msg }) {
  if (!msg) return null
  return <p className="mt-1 text-xs text-danger" role="alert">{msg}</p>
}

function DialogReadError({ onRetry }) {
  return <Alert tone="error">
    页面错误，请刷新重试
  </Alert>
}

function OpPassField({ pass, setPass }) {
  return (
    <div className="mt-3">
      <Label htmlFor="op-pass">操作密码</Label>
      <Input
        id="op-pass"
        type="password"
        value={pass}
        onChange={(e) => setPass(e.target.value)}
        placeholder="请输入操作密码"
        autoComplete="off"
      />
    </div>
  )
}

/** 写操作提交 hook：自动处理「需要操作密码」错误并重试 */
function useOpSubmit() {
  const [needPass, setNeedPass] = useState(false)
  const [pass, setPass] = useState('')
  const submit = async (fn, body = {}) => {
    const payload = needPass && pass ? { ...body, client_operate_password: pass } : body
    try {
      const r = await fn(payload)
      setNeedPass(false)
      setPass('')
      return r
    } catch (e) {
      if (e?.data?.data?.operate_password === 1) {
        setNeedPass(true)
        const err = new Error('该操作需要验证操作密码')
        err.needOpPass = true  // 调用方据此以 warning 提示而非报错
        throw err
      }
      throw e
    }
  }
  return { needPass, pass, setPass, submit }
}

/** 手机验证码（POST /phone/code，{action:'verify'}；按需先过图形验证码） */
function SmsCodeField({ code, setCode, toast, error, onInput }) {
  const [countdown, setCountdown] = useState(0)
  const [sending, setSending] = useState(false)
  const captcha = useCaptcha()
  const timerRef = useRef(null)

  useEffect(() => () => window.clearInterval(timerRef.current), [])

  const send = async () => {
    if (countdown || sending) return
    setSending(true)
    try {
      const need = Number(commonData()?.captcha_client_verify) === 1
      let captchaParams = {}
      if (need) {
        const c = await captcha.open()
        if (!c) {
          setSending(false)
          return
        }
        captchaParams = { captcha: c.code, token: c.token }
      }
      await post('/phone/code', { action: 'verify', ...captchaParams })
      toast('验证码已发送', 'success')
      setCountdown(60)
      timerRef.current = window.setInterval(() => {
        setCountdown((n) => {
          if (n <= 1) {
            window.clearInterval(timerRef.current)
            return 0
          }
          return n - 1
        })
      }, 1000)
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      <Label htmlFor="sms-code">短信验证码</Label>
      <div className="flex gap-2">
        <Input
          id="sms-code"
          value={code}
          onChange={(e) => { setCode(e.target.value); onInput?.() }}
          placeholder="请输入验证码"
          className={cn('flex-1', error && 'border-danger')}
          autoComplete="off"
        />
        <Button type="button" variant="outline" disabled={countdown > 0 || sending} onClick={send} className="w-28">
          {sending ? <Loader2 className="size-4 animate-spin" /> : countdown > 0 ? `${countdown}s 后重发` : '发送验证码'}
        </Button>
      </div>
      <FieldError msg={error} />
    </div>
  )
}

/** 随机密码（与旧面板规则一致：12 位字母数字） */
/* ====================================================================== */
/* 统一支付弹窗（对齐 orderDetail 的支付契约）                                */
/* ====================================================================== */
export function PayDialog(props) { return <Cashier {...props}/> }

export function ServerPanelDialogs(incoming) {
  const { dlg, setDlg, host, cloud, module, caps, api, runPower, openVnc } = incoming
  const done = (context = {}) => incoming.onOperation?.(dlg?.type, { ...dlg, ...context })
  const props = { ...incoming, dlg: dlg ? { ...dlg, onDone: undefined } : null,
    onOpDone: done, onChanged: done, refreshStatus: done, reloadHost: done, reloadCloud: done, reloadAll: done,
    onOpenPay: (id, context = {}) => incoming.onOpenPay?.(id, dlg?.type, { ...dlg, onDone: undefined, ...context }),
  }
  const close = () => setDlg(null)

  if (!dlg) return null

  switch (dlg.type) {
    case 'power':
      return (
        <PowerActionDialog
          dlg={dlg} close={close} runPower={runPower} host={host}
        />
      )
    case 'notes':
      return <NotesDialog {...props} close={close} />
    case 'resetPass':
      return <ResetPassDialog {...props} close={close} />
    case 'rescue':
      return <RescueDialog {...props} close={close} mode="enter" />
    case 'rescueExit':
      return <RescueDialog {...props} close={close} mode="exit" />
    case 'renew':
      return <RenewDialog {...props} close={close} />
    case 'reinstall':
      return <ReinstallDialog {...props} close={close} />
    case 'upgradePackage':
      return <PackageUpgradeDialog {...props} close={close} />
    case 'upgradeElastic':
      return <ElasticUpgradeDialog {...props} close={close} />
    case 'upgrade':
      return <UpgradeDialog {...props} close={close} />
    case 'securityGroup':
      return <SecurityGroupDialog {...props} close={close} />
    case 'loginInfo':
      return <LoginInfoDialog {...props} close={close} />
    case 'diskOrder':
      return <DiskOrderDialog {...props} close={close} />
    case 'diskResize':
      return <DiskResizeDialog {...props} close={close} />
    case 'bsCreate':
      return <BsCreateDialog {...props} close={close} />
    case 'bsRestore':
      return <BsRestoreDialog {...props} close={close} />
    case 'bsDelete':
      return <BsDeleteDialog {...props} close={close} />
    case 'bsConfig':
      return <BsConfigDialog {...props} close={close} />
    case 'flowPacket':
      return <FlowPacketDialog {...props} close={close} />
    case 'vpc':
      return <VpcDialog {...props} close={close} />
    case 'nat':
      return <NatDialog {...props} close={close} />
    case 'defence':
      return <DefenceDialog {...props} close={close} />
    case 'billingConvert':
      return <BillingConvertDialog {...props} close={close} />
    case 'simulate':
      return <SimulateDialog {...props} close={close} />
    case 'autoRelease':
      return <AutoReleaseDialog {...props} close={close} />
    case 'unsubscribe':
      return <UnsubscribeDialog {...props} close={close} />
    default:
      return null
  }
}

/* ---------------- 电源动作确认（含操作密码） ---------------- */
function PowerActionDialog({ dlg, close, runPower, host }) {
  /* 操作密码回触统一由 runPower 处理：成功返回 true（并已 setDlg(null)），
     需要密码返回 false 且置 dlg.needPassword —— 本弹窗据此显示密码输入框并保留 */
  const [pass, setPass] = useState('')
  const [busy, setBusy] = useState(false)
  const needPass = !!dlg.needPassword
  const danger = !!dlg.danger

  const go = async () => {
    setBusy(true)
    try {
      const ok = await runPower(dlg.action, needPass && pass ? { client_operate_password: pass } : {})
      if (ok) close()
    } finally {
      setBusy(false)
    }
  }

  const desc = {
    powerOn: '确认开机？实例将启动并开始计费运行。',
    powerOff: '确认关机？将执行正常关机流程（等同于系统 shutdown）。',
    reboot: '确认重启？将执行正常重启流程。',
    hardReboot: '强制重启将模拟物理断电再通电，可能丢失未保存数据，确认继续？',
    hardOff: '强制关机将模拟物理断电，可能丢失未保存数据，确认继续？',
  }[dlg.action]

  return (
    <Dialog open onOpenChange={(v) => !v && close()}>
      <DialogContent className="w-[min(92vw,400px)]">
        <DialogHeader>
          <DialogTitle>{dlg.title || '电源操作'}</DialogTitle>
          <DialogDescription>{host?.name && <span className="mb-1 block font-mono">{host.name}</span>}{desc}</DialogDescription>
        </DialogHeader>
        {needPass ? <OpPassField pass={pass} setPass={setPass} /> : null}
        <DialogFooter>
          <Button variant="outline" onClick={close}>取消</Button>
          <Button
            variant={danger ? 'danger' : 'default'}
            onClick={go}
            disabled={busy}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            确认{dlg.title || ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ---------------- 编辑备注 ---------------- */
function NotesDialog({ api, host, close, reloadHost }) {
  const toast = useToast()
  // 备注存于 client_notes 列，但 /host/:id 以 notes 字段名返回（后端字段名不一致）
  const [text, setText] = useState(host?.notes || host?.client_notes || '')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    try {
      await api.notes({ notes: text })
      toast('备注已保存', 'success')
      reloadHost?.()
      close()
    } catch (e) {
      toast(e.message, e.needOpPass ? 'warning' : 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && close()}>
      <DialogContent className="w-[min(92vw,420px)]">
        <DialogHeader>
          <DialogTitle>编辑备注</DialogTitle>
          <DialogDescription>备注仅自己可见，方便识别实例用途。</DialogDescription>
        </DialogHeader>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={200}
          rows={3}
          aria-label="实例备注"
          placeholder="填写实例备注（最多 200 字）"
        />
        <DialogFooter>
          <Button variant="outline" onClick={close}>取消</Button>
          <Button onClick={save} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ---------------- 重置密码 ---------------- */
function ResetPassDialog({ api, cloud, host, close, refreshStatus, power }) {
  const toast = useToast()
  const cfg = cloud?.config || {}
  const { needPass, pass, setPass, submit } = useOpSubmit()
  const [pwd, setPwd] = useState(() => randomPassword())
  const [code, setCode] = useState('')
  const [forceOffChecked, setForceOffChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  /* 内联校验错误（字段旁显示，替代一闪而过的 toast） */
  const [errs, setErrs] = useState({})
  const setErr = (k, v) => setErrs((e) => ({ ...e, [k]: v }))
  /* A6：关机状态下改密需确认会强制关机（原版 cloudDetail.js:5548-5552） */
  const isOff = power?.status === 'off'

  const save = async () => {
    const next = {}
    if (!pwd) next.pwd = '请输入密码'
    // 后端密码规则：7~65 位且含大小写字母与数字（ToolLogic::checkPassword）
    else if (pwd.length < 7 || pwd.length > 65 || !/[a-z]/.test(pwd) || !/[A-Z]/.test(pwd) || !/\d/.test(pwd)) {
      next.pwd = '密码需 7~65 位，且同时包含大小写字母与数字'
    }
    if (Number(cfg.reset_password_sms_verify) === 1 && !code) next.code = '请输入短信验证码'
    if (isOff && !forceOffChecked) next.forceOff = '请勾选确认（重置密码将强制关机）'
    setErrs(next)
    if (Object.keys(next).length) return
    setBusy(true)
    try {
      await submit(api.resetPassword, { password: pwd, code: code || undefined })
      toast('重置密码指令已下发', 'success')
      refreshStatus?.()
      close()
    } catch (e) {
      // 需要操作密码：保持弹窗并提示（useOpSubmit 已置 needPass 显示输入框）
      toast(e.message, e.message.includes('操作密码') ? 'warning' : 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && close()}>
      <DialogContent className="w-[min(92vw,420px)]">
        <DialogHeader>
          <DialogTitle>重置密码</DialogTitle>
          <DialogDescription>{host?.name && <span className="mb-1 block font-mono">{host.name}</span>}重置实例操作系统密码，重置后请用新密码登录。</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="new-pass">新密码</Label>
            <div className="flex gap-2">
              <Input
                id="new-pass" value={pwd} autoComplete="off"
                onChange={(e) => { setPwd(e.target.value); setErr('pwd', '') }}
                className={cn('flex-1 font-mono', errs.pwd && 'border-danger')}
              />
              <Button type="button" variant="outline" onClick={() => { setPwd(randomPassword()); setErr('pwd', '') }}>随机</Button>
            </div>
            <FieldError msg={errs.pwd} />
          </div>
          {Number(cfg.reset_password_sms_verify) === 1 ? (
            <SmsCodeField code={code} setCode={setCode} toast={toast} error={errs.code} onInput={() => setErr('code', '')} />
          ) : null}
          {isOff ? (
            <div>
              <div className={cn('flex items-start gap-2 rounded-lg border px-3 py-2', errs.forceOff ? 'border-danger/50 bg-danger/5' : 'border-warning/40 bg-warning/5')}>
                <Checkbox id="force-off" checked={forceOffChecked} onChange={(e) => { setForceOffChecked(e.target.checked); setErr('forceOff', '') }} className="mt-0.5" />
                <label htmlFor="force-off" className="cursor-pointer text-xs leading-5 text-body">
                  实例当前处于关机状态，重置密码将同时执行强制关机操作，请确认。
                </label>
              </div>
              <FieldError msg={errs.forceOff} />
            </div>
          ) : null}
          {needPass ? <OpPassField pass={pass} setPass={setPass} /> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close}>取消</Button>
          <Button onClick={save} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            确认重置
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ---------------- 救援模式（进入/退出） ---------------- */
function RescueDialog({ api, close, mode, refreshStatus }) {
  const toast = useToast()
  const { needPass, pass, setPass, submit } = useOpSubmit()
  const [busy, setBusy] = useState(false)
  const isEnter = mode === 'enter'
  /* A5：救援需 {type(1=windows,2=linux), password}（后端 validate:required，原版 rescueSub:5615） */
  const [sysType, setSysType] = useState('1')
  const [rescuePwd, setRescuePwd] = useState('')

  useEffect(() => {
    if (isEnter && !rescuePwd) setRescuePwd(randomPassword())
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const go = async () => {
    if (isEnter && !rescuePwd) {
      toast('请输入救援系统临时密码', 'warning')
      return
    }
    setBusy(true)
    try {
      await submit(
        isEnter ? api.rescue : api.exitRescue,
        isEnter ? { type: Number(sysType), password: rescuePwd } : {}
      )
      toast(isEnter ? '已进入救援模式' : '已退出救援模式', 'success')
      refreshStatus?.()
      close()
    } catch (e) {
      // 操作密码回触：useOpSubmit 已置 needPass 显示输入框
      toast(e.message, e.needOpPass ? 'warning' : 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && close()}>
      <DialogContent className="w-[min(92vw,420px)]">
        <DialogHeader>
          <DialogTitle>
            <ShieldQuestion className="mr-1 inline size-4 text-warning" />
            {isEnter ? '进入救援模式' : '退出救援模式'}
          </DialogTitle>
          <DialogDescription>
            {isEnter
              ? '救援模式使用独立的临时系统启动实例，便于修复原系统问题。进入期间原系统不可访问。'
              : '退出后将重启回原系统。'}
          </DialogDescription>
        </DialogHeader>
        {isEnter ? (
          <div className="space-y-3">
            <div>
              <Label htmlFor="rescue-sys">救援系统</Label>
              <Select id="rescue-sys" value={sysType} onChange={(e) => setSysType(e.target.value)}>
                <option value="1">Windows</option>
                <option value="2">Linux</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="rescue-pwd">临时密码</Label>
              <div className="flex gap-2">
                <Input
                  id="rescue-pwd"
                  value={rescuePwd}
                  onChange={(e) => setRescuePwd(e.target.value)}
                  className="flex-1 font-mono"
                  autoComplete="off"
                />
                <Button type="button" variant="outline" onClick={() => setRescuePwd(randomPassword())}>随机</Button>
              </div>
            </div>
          </div>
        ) : null}
        {needPass ? <OpPassField pass={pass} setPass={setPass} /> : null}
        <DialogFooter>
          <Button variant="outline" onClick={close}>取消</Button>
          <Button onClick={go} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            确认
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ---------------- 手动续费（自动续费由面板内的状态开关负责） ---------------- */
function RenewDialog({ api, close, onOpenPay, onOpDone, renewData }) {
  const toast = useToast()
  const [cycles, setCycles] = useState(null)
  const [sel, setSel] = useState('')
  const [promo, setPromo] = useState('')
  const [busy, setBusy] = useState(false)

  const [forbidden, setForbidden] = useState(false)

  useEffect(() => {
    const request = renewData ? Promise.resolve({ data: renewData }) : api.renewPage()
    request.then((r) => {
      /* C1：renew_forbidden=1 禁止续费（原版 renewDialog.js:205/364 弹窗内拦截） */
      setForbidden(Number(r.data?.renew_forbidden || 0) === 1)
      const list = r.data?.host || []
      setCycles(list)
      const cur = list.find((c) => c.max_renew) || list[0]
      if (cur) setSel(cur.billing_cycle)
    }).catch((e) => toast(e.message, 'error'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async () => {
    if (forbidden) {
      toast('该实例当前不允许续费，请联系客服了解详情', 'warning')
      return
    }
    setBusy(true)
    try {
      const body = { billing_cycle: sel }
      if (promo) body.customfield = { promo_code: [promo] }
      const r = await api.renew(body)
      const orderId = r.data?.id || r.data?.order_id
      if (orderId && !isPaymentPaid(r)) {
        close()
        onOpenPay?.(orderId)
      } else {
        onOpDone?.()
        toast('续费操作已提交', 'success')
        close()
      }
    } catch (e) {
      toast(e.message, e.needOpPass ? 'warning' : 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && close()}>
      <DialogContent className="w-[min(92vw,420px)]">
        <DialogHeader>
          <DialogTitle>续费实例</DialogTitle>
          <DialogDescription>
            选择续费周期，提交后生成续费订单。
          </DialogDescription>
        </DialogHeader>
        {forbidden ? (
          <Alert tone="warning" className="text-xs">该实例当前不允许续费，请联系客服了解详情。</Alert>
        ) : null}

        {cycles === null ? (
          <Skeleton className="h-24 w-full" />
        ) : cycles.length === 0 ? (
          <EmptyState title="该实例暂不可续费" />
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              {cycles.map((c) => (
                <ChoiceButton
                  key={c.billing_cycle}
                  type="button"
                  onClick={() => setSel(c.billing_cycle)}
                  selected={sel === c.billing_cycle} className="flex w-full items-center justify-between"
                >
                  <span className="text-ink">
                    {c.name_show || c.billing_cycle}
                    {c.max_renew ? <Badge tone="default" className="ml-2">当前</Badge> : null}
                  </span>
                  <span className="tabular-nums text-ink">{formatMoney(c.price)}</span>
                </ChoiceButton>
              ))}
            </div>
            <div>
              <Label htmlFor="promo">优惠码（可选）</Label>
              <Input
                id="promo"
                value={promo}
                onChange={(e) => setPromo(e.target.value)}
                placeholder="输入优惠码"
                autoComplete="off"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={close}>取消</Button>
          <Button onClick={submit} disabled={busy || forbidden || !sel || !cycles?.length}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            提交续费
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ---------------- 重装系统（三步向导） ---------------- */
function ReinstallDialog({ api, cloud, host, module, caps, close, refreshStatus, toast: parentToast }) {
  const toast = useToast()
  const cfg = cloud?.config || {}
  const { needPass, pass, setPass, submit } = useOpSubmit()
  const [step, setStep] = useState(1)
  const [imageType, setImageType] = useState('public') // public | market
  const [images, setImages] = useState(null)
  const [imageError, setImageError] = useState('')
  const [imageId, setImageId] = useState(cloud?.image?.id || 0)
  const [imageQuote, setImageQuote] = useState(null)
  const [quoteAttempt, setQuoteAttempt] = useState(0)
  const [imageBuying, setImageBuying] = useState(false)
  const [imagePayment, setImagePayment] = useState(null)
  const preset=useReinstallPreset({hostId:host.id,imageId,enabled:module==='mf_cloud' && !!window.__CRA1_RUNTIME__?.app_presets})
  const imageOrders = useRef(new Map())
  const imageRequest = useRef(0)
  /* 当前选中镜像（含初始镜像），用于判定 Windows 与端口默认值 */
  const selectedImage = useMemo(
    () => (images || []).find((im) => im.id === imageId) || cloud?.image || null,
    [images, imageId, cloud]
  )
  /* SSH 密钥可用性（对齐原版 product_detail.html:1100）：
     configObj.support_ssh_key === 1 && cra1Config.manual_manage === 0（caps.sshKey 已合并两条件）；
     后端另有约束：Windows 镜像不可用密钥（CloudLogic.php:1388 mf_cloud_windows_cannot_use_ssh_key） */
  const sshUsable = !!(caps?.sshKey) && !/win/i.test(selectedImage?.name || '')
  const [authType, setAuthType] = useState('password') // password | ssh
  const [pwd, setPwd] = useState(() => randomPassword())
  const [sshKeys, setSshKeys] = useState([])
  const [sshKeyId, setSshKeyId] = useState('')
  const [port, setPort] = useState('')
  const [fmtData, setFmtData] = useState(false)
  const [partType, setPartType] = useState('1')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  /* 内联校验错误（校验失败自动跳回对应步骤并高亮字段） */
  const [errs, setErrs] = useState({})
  const setErr = (k, v) => setErrs((e) => ({ ...e, [k]: v }))

  /* B6：端口规则对齐原版（cloudDetail.js:3278-3313）
     rand_ssh_port: 0=默认(Windows 3389/Linux 22)、1=随机(区间)、2=指定(按系统固定值，不可改)、3=下单可选
     来源：order_page config（caps.portMode/portCfg）—— mf_cloud detail config 不含这些字段 */
  const portMode = Number(caps?.portMode ?? 0)
  const isWinImage = /win/i.test((selectedImage?.name ?? cloud?.image?.name) || '')

  const defaultPortForSystem = (win) => (
    portMode === 2
      ? (win ? String(caps?.portCfg?.windows || 3389) : String(caps?.portCfg?.linux || 22))
      : (win ? '3389' : '22')
  )

  useEffect(() => {
    if (portMode === 1) {
      const min = Number(caps?.portCfg?.start || 1024)
      const max = Number(caps?.portCfg?.end || 65535)
      setPort(String(Math.floor(Math.random() * (max - min + 1)) + min))
    } else {
      setPort(defaultPortForSystem(isWinImage))
    }
  }, [portMode, isWinImage]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const controller = new AbortController()
    const reader = api.withSignal ? api.withSignal(controller.signal) : api
    setImages(null); setImageError('')
    reader.image(host.product_id, { is_market: imageType === 'market' ? 1 : 0, page: 1, limit: 100 })
      .then((r) => {
        if (!controller.signal.aborted) setImages(reinstallImages(r.data?.list))
      })
      .catch(err => { if (!controller.signal.aborted) { setImages([]); setImageError(err.message || '镜像读取失败，请重试') } })
    return () => controller.abort()
  }, [imageType, host.product_id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const controller = new AbortController(), request = ++imageRequest.current
    setImageQuote(null)
    if (images?.some(image => Number(image.id) === Number(imageId))) {
      const reader = api.withSignal ? api.withSignal(controller.signal) : api
      reader.imageCheck({ image_id: imageId, check_limit_rule: 1 }).then(response => {
        if (controller.signal.aborted || request !== imageRequest.current) return
        const raw = response.data?.price, price = Number(raw)
        if (raw === undefined || raw === null || raw === '' || !Number.isFinite(price) || price < 0) throw new Error('镜像费用信息不完整')
        setImageQuote({ imageId, price, error: '' })
      }).catch(error => {
        if (!controller.signal.aborted && request === imageRequest.current) setImageQuote({ imageId, error: error.message || '镜像购买状态读取失败' })
      })
    }
    return () => { controller.abort(); imageRequest.current++ }
  }, [api, imageId, images, quoteAttempt])

  const quoteCurrent = imageQuote && Number(imageQuote.imageId) === Number(imageId)
  const imageReady = quoteCurrent && !imageQuote.error && imageQuote.price === 0
  const buyImage = async () => {
    if (imageBuying || !quoteCurrent || imageQuote.error || imageQuote.price <= 0) return
    const request = imageRequest.current, selected = imageId
    setImageBuying(true)
    try {
      const response = await api.imageCheck({ image_id: selected, check_limit_rule: 1 })
      if (request !== imageRequest.current) return
      const raw = response.data?.price, price = Number(raw)
      if (raw == null || raw === '' || !Number.isFinite(price) || price < 0) throw new Error('镜像费用信息不完整')
      if (price !== imageQuote.price) {
        setImageQuote({ imageId: selected, price, error: '' })
        toast(price === 0 ? '此镜像已可使用，请继续确认重装' : '镜像费用已更新，请核对后重新购买', 'warning')
        return
      }
      const key = `${selected}:${price}`
      let order = imageOrders.current.get(key)
      if (!order) {
        const created = await api.imageOrder({ image_id: selected })
        if (!created.data?.id) throw new Error('未获取到镜像订单，请重试')
        order = { id: created.data.id, amount: created.data.amount ?? price }
        imageOrders.current.set(key, order)
      }
      if (request === imageRequest.current) setImagePayment(order)
    } catch (error) { if (request === imageRequest.current) toast(error.message || '镜像购买失败', 'error') }
    finally { setImageBuying(false) }
  }

  useEffect(() => {
    if (authType !== 'ssh') return
    api.sshKeyList({ page: 1, limit: 50 }).then((r) => setSshKeys(r.data?.list || [])).catch(() => {})
  }, [authType])

  /* 切换镜像/商品不支持时，SSH 选项即时失效 → 回退密码方式（避免提交必然 400） */
  useEffect(() => {
    if (authType === 'ssh' && !sshUsable) setAuthType('password')
  }, [authType, sshUsable])

  // 按镜像分组渲染
  const groups = useMemo(() => {
    if (!images) return []
    const map = new Map()
    for (const im of images) {
      const g = im.image_group_name || im.group_name || '其他'
      if (!map.has(g)) map.set(g, [])
      map.get(g).push(im)
    }
    return [...map.entries()]
  }, [images])

  const doReinstall = async () => {
    if (busy || !imageReady || !preset.ready || imageBuying) return
    const next = {}
    if (!images?.some(image => Number(image.id) === Number(imageId))) next.image = '请选择可用镜像'
    if (authType === 'password' && (pwd.length < 7 || pwd.length > 65 || !/[a-z]/.test(pwd) || !/[A-Z]/.test(pwd) || !/\d/.test(pwd))) {
      next.pwd = '密码需 7~65 位，且同时包含大小写字母与数字'
    }
    if (authType === 'ssh' && !sshKeyId) next.ssh = '请选择 SSH 密钥'
    // A6：开启短信验证时验证码必填（原版 cloudDetail.js:3391-3394）
    if (Number(cfg.reinstall_sms_verify) === 1 && !code) next.code = '请输入短信验证码'
    setErrs(next)
    if (Object.keys(next).length) {
      /* 校验失败时回到对应步骤，让用户直接看到出错字段 */
      if (next.image) setStep(1)
      else if (next.pwd || next.ssh || next.code) setStep(2)
      return
    }
    setBusy(true)
    try {
      // 支付完成后和执行前都以服务端为准，绝不因支付回调自动重装。
      const verified = await api.imageCheck({ image_id: imageId, check_limit_rule: 1 })
      if (verified.data?.price === undefined || verified.data?.price === null || verified.data?.price === '' || Number(verified.data.price) !== 0) {
        setImageQuote(null); setQuoteAttempt(value => value + 1); setStep(1)
        toast('镜像购买状态已变化，请重新确认', 'warning')
        return
      }
      const body = {
        image_id: imageId,
        port: port || undefined,
        ...(module === 'mf_dcim' ? { part_type: isWinImage ? Number(partType) : 0 } : { format_data_disk: fmtData ? 1 : 0 }),
        code: code || undefined,
      }
      if (authType === 'password') body.password = pwd
      else body.ssh_key_id = sshKeyId
      const selectedPreset=await preset.verify();if(module==='mf_cloud' && window.__CRA1_RUNTIME__?.app_presets)body.app_preset_id=selectedPreset
      await submit(api.reinstall, body)
      toast('重装指令已下发', 'success')
      refreshStatus?.()
      close()
    } catch (e) {
      toast(e.message, e.needOpPass ? 'warning' : 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
    <Dialog open={!imagePayment && !preset.payment} onOpenChange={(v) => !v && !imagePayment && !busy && !imageBuying && close()}>
      <DialogContent className="w-[min(94vw,560px)]">
        <DialogHeader>
          <DialogTitle>重装系统</DialogTitle>
          <DialogDescription>
            {host?.name && <span className="mb-1 block font-mono">{host.name}</span>}
            {module === 'mf_dcim' ? '物理服务器重装涉及磁盘格式化，请核对分区范围并提前备份重要数据。' : '重装将清空系统盘数据（选择格式化数据盘则连数据盘一并清空），请提前备份重要数据。'}
          </DialogDescription>
        </DialogHeader>

        {/* 步骤指示 */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {['选择镜像', '登录方式', '确认执行'].map((s, i) => (
            <span key={s} className="flex items-center gap-1.5">
              <span
                className={cn(
                  'inline-flex size-5 items-center justify-center rounded-full border text-[11px]',
                  step > i ? 'border-brand bg-brand text-white' : 'border-line text-muted'
                )}
              >
                {i + 1}
              </span>
              {s}
              {i < 2 ? <span className="mx-1 h-px w-6 bg-line" /> : null}
            </span>
          ))}
        </div>

        {images?.some(image => Number(image.id) === Number(imageId)) && <div aria-live="polite" className="rounded-lg border border-line p-3 text-sm">
          <p className="font-medium">{selectedImage?.name}</p>
          {!quoteCurrent ? <p className="text-muted-foreground">正在确认镜像费用与可用状态…</p>
            : imageQuote.error ? <><p className="text-danger">{imageQuote.error}</p><Button size="sm" variant="outline" onClick={() => setQuoteAttempt(value => value + 1)}>重新确认</Button></>
              : imageQuote.price > 0 ? <><p>此镜像需付费：{formatMoney(imageQuote.price)}</p><Button size="sm" disabled={imageBuying} onClick={buyImage}>{imageBuying ? '正在准备支付…' : '购买镜像'}</Button><p className="mt-1 text-xs text-muted-foreground">支付后仍需手动确认重装，不会自动清空数据。</p></>
                : <p className="text-muted-foreground">此镜像无需额外付费，可继续重装。</p>}
        </div>}

        {step === 1 ? (
          <div className="space-y-3">
            {module !== 'mf_dcim' && <div className="cui-tabs flex w-full">
              {[['public', '标准镜像'], ['market', '市场镜像']].map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  disabled={imageBuying || busy} onClick={() => { setImageType(k); setImageId(0) }}
                  aria-pressed={imageType === k} className="cui-tabs__trigger flex-1"
                >
                  {label}
                </button>
              ))}
            </div>}
            {imageError && <Alert tone="error">页面错误，请刷新重试</Alert>}
            {images === null ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <div className="max-h-64 space-y-3 overflow-y-auto rounded-lg border border-line p-2">
                {groups.length === 0 ? (
                  <p className="py-8 text-center text-xs text-muted-foreground">暂无可用镜像</p>
                ) : (
                  groups.map(([g, items]) => (
                    <div key={g}>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">{g}</p>
                      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                        {items.map((im) => (
                          <ChoiceButton
                            key={im.id}
                            type="button"
                            disabled={imageBuying || busy}
                            onClick={() => { setImageId(im.id); setErr('image', ''); setStep(2) }}
                            selected={imageId === im.id} className="truncate text-left"
                            title={im.name}
                          >
                            {im.name}
                          </ChoiceButton>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ) : step === 2 ? (
          <div className="space-y-3">
            <div className="cui-tabs flex w-full">
              {[...(sshUsable ? [['password', '密码'], ['ssh', 'SSH 密钥']] : [['password', '密码']])].map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setAuthType(k)}
                  aria-pressed={authType === k} className="cui-tabs__trigger flex-1"
                >
                  {label}
                </button>
              ))}
            </div>
            {authType === 'password' ? (
              <div>
                <Label htmlFor="ri-pass">初始密码</Label>
                <div className="flex gap-2">
                  <Input
                    id="ri-pass" value={pwd} autoComplete="off"
                    onChange={(e) => { setPwd(e.target.value); setErr('pwd', '') }}
                    className={cn('flex-1 font-mono', errs.pwd && 'border-danger')}
                  />
                  <Button type="button" variant="outline" onClick={() => { setPwd(randomPassword()); setErr('pwd', '') }}>随机</Button>
                </div>
                <FieldError msg={errs.pwd} />
              </div>
            ) : (
              <div>
                <Label htmlFor="ri-key">SSH 密钥</Label>
                <Select
                  id="ri-key" value={sshKeyId}
                  onChange={(e) => { setSshKeyId(e.target.value); setErr('ssh', '') }}
                  className={cn(errs.ssh && 'border-danger')}
                >
                  <option value="">请选择密钥</option>
                  {sshKeys.map((k) => (
                    <option key={k.id} value={k.id}>{k.name}</option>
                  ))}
                </Select>
                <FieldError msg={errs.ssh} />
              </div>
            )}
            {portMode === 1 ? (
              <div>
                <Label htmlFor="ri-port">SSH 端口（随机分配）</Label>
                <Input id="ri-port" value={port} onChange={(e) => setPort(e.target.value)} className="w-32 font-mono" />
              </div>
            ) : portMode === 2 ? (
              <div>
                <Label htmlFor="ri-port">SSH 端口（系统指定，不可修改）</Label>
                <Input id="ri-port" value={port} readOnly className="w-32 bg-surface-alt font-mono" />
              </div>
            ) : null}
            {Number(cfg.reinstall_sms_verify) === 1 ? (
              <SmsCodeField code={code} setCode={setCode} toast={toast} error={errs.code} onInput={() => setErr('code', '')} />
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            <Alert tone="warning" className="text-xs">
              {module === 'mf_dcim' ? isWinImage && partType === '1' ? '确认后将格式化第一分区并重装系统，该分区的数据将被清空，期间实例不可访问。' : '确认后将全盘格式化并重装系统，磁盘内所有分区的数据将被清空，期间实例不可访问。' : '确认后立即开始重装，系统盘将被清空并写入新镜像，期间实例不可访问。'}
            </Alert>
            {module === 'mf_dcim' ? isWinImage && <div className="space-y-1">
              <Label htmlFor="reinstall-part-type">系统分区方式</Label>
              <Select id="reinstall-part-type" value={partType} onChange={event => setPartType(event.target.value)}><option value="1">仅格式化第一分区</option><option value="0">全盘格式化（清空所有分区）</option></Select>
            </div> : <div className="flex items-center gap-2 text-xs">
              <Checkbox id="fmt-data" checked={fmtData} onChange={(e) => setFmtData(e.target.checked)} />
              <Label htmlFor="fmt-data" className="cursor-pointer">同时格式化所有数据盘（不可恢复）</Label>
            </div>}
            {needPass ? <OpPassField pass={pass} setPass={setPass} /> : null}
          </div>
        )}

        {step===1&&preset.view}
        <DialogFooter>
          {step > 1 ? <Button disabled={busy || imageBuying} variant="outline" onClick={() => setStep(step - 1)}>上一步</Button> : <Button disabled={busy || imageBuying} variant="outline" onClick={close}>取消</Button>}
          {step < 3 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!imageReady || !preset.ready || busy || imageBuying}>下一步</Button>
          ) : (
            <Button variant="danger" onClick={doReinstall} disabled={busy || !imageReady || !preset.ready || imageBuying}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              确认重装
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
    {preset.cashier}
    {imagePayment && <PayDialog orderId={imagePayment} hostId={host.id} operation="imageOrder" context={{imageId}} onClose={() => setImagePayment(null)} onPaid={() => { setImageQuote(null); setQuoteAttempt(value => value + 1) }} />}
    </>
  )
}

/**
 * 档位选择组：radio 型点选；range 型（阶段计费）才出现 min~max 数字输入。
 * labelOf：自定义按钮文案（如流量线路的带宽档位无 value，取 out_bw）；
 * 无有效值的候选项直接剔除（避免渲染空按钮 —— 真实流量线路 bw/flow 混合结构）。
 */
function OptionGroup({ label, options: available, value, currentValue, onChange, unit, labelOf }) {
  const options = preserveCurrentUpgradeOption(available, currentValue)
  if (!options.length) return null
  const toVal = upgradeOptionValue
  const items = options
    .filter((o) => o.type !== 'range' && o.type !== 'step')
    .filter((o) => {
      const v = toVal(o)
      return v !== undefined && v !== null && v !== ''
    })
  const nums = options.filter((o) => o.type === 'range' || o.type === 'step')
  const min = Math.min(...nums.map(o => Number(o.min_value ?? o.min ?? 0)))
  const max = Math.max(...nums.map(o => Number(o.max_value ?? o.max ?? 0)))
  return (
      <div role="group" aria-label={label}>
        <Label>{label}</Label>
        {items.length ? <div className="flex flex-wrap gap-1.5">
          {items.map((o) => {
            const v = toVal(o)
            return (
              <ChoiceButton
                key={String(v)}
                type="button"
                onClick={() => onChange(v)}
                selected={String(value) === String(v)}
              >
                {labelOf ? labelOf(o) : `${v}${unit || ''}`}
                {String(v) === String(currentValue) ? <span className="text-[11px]"> · 当前配置</span> : null}
              </ChoiceButton>
            )
          })}
        </div> : null}
        {nums.length ? <>
          <Label htmlFor={`upgrade-${label}`}>可选范围：{min} ~ {max}{unit || ''}{currentValue !== undefined ? `；当前：${currentValue}${unit || ''}` : ''}</Label>
          <Input id={`upgrade-${label}`}
        type="number"
        min={min}
        max={max}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        aria-label={label}
      />
        </> : null}
    </div>
  )
}

/* ---------------- 套餐升降级（recommend_config） ---------------- */
function UpgradeFrame({ embedded, close, children }) {
  if (embedded) return <>{children}</>
  return <Dialog open onOpenChange={value => { if (!value) close() }}><DialogContent className="w-[min(94vw,560px)]">{children}</DialogContent></Dialog>
}

function UpgradeDialog(props) {
  const [mode, setMode] = useState('elastic'), [submitting, setSubmitting] = useState(false)
  return <Dialog open onOpenChange={value => { if (!value && !submitting) props.close() }}>
    <DialogContent className="w-[min(94vw,560px)]" onEscapeKeyDown={event => { if (submitting) event.preventDefault() }} onPointerDownOutside={event => { if (submitting) event.preventDefault() }}>
      <DialogHeader><DialogTitle>升降级</DialogTitle><DialogDescription>{props.host.name || props.host.product_name} · 选择需要调整的配置方式</DialogDescription></DialogHeader>
      <Tabs value={mode} onValueChange={value => { if (!submitting) setMode(value) }}>
        <TabsList aria-label="升降级方式"><TabsTrigger value="elastic" disabled={submitting}>弹性升降级</TabsTrigger><TabsTrigger value="package" disabled={submitting}>套餐升降级</TabsTrigger></TabsList>
        <TabsContent value="elastic">{mode === 'elastic' && <ElasticUpgradeDialog {...props} embedded onSubmitting={setSubmitting} />}</TabsContent>
        <TabsContent value="package">{mode === 'package' && <PackageUpgradeDialog {...props} embedded onSubmitting={setSubmitting} />}</TabsContent>
      </Tabs>
    </DialogContent>
  </Dialog>
}

/* 契约：GET /mf_cloud/:id/recommend_config → list；GET recommend_config/price；POST recommend_config/order */
function PackageUpgradeDialog({ api, close, onOpenPay, onOpDone, embedded = false, onSubmitting }) {
  const toast = useToast()
  const [list, setList] = useState(null)
  const [sel, setSel] = useState(null)
  const [quote, setQuote] = useState(null)
  const [busy, setBusy] = useState(false)
  const [loadErr, setLoadErr] = useState(''), [loadKey, setLoadKey] = useState(0), [quoteErr, setQuoteErr] = useState('')
  const { submit, needPass, pass, setPass } = useOpSubmit()

  useEffect(() => {
    let alive = true
    setList(null); setSel(null); setLoadErr('')
    api.recommendConfig().then((r) => {
      if (!alive) return
      const l = r.data?.list
      if (!Array.isArray(l)) throw new Error('套餐信息不完整，请重试')
      setList(l)
      if (l.length) setSel(l[0])
    }).catch((e) => { if (alive) { setLoadErr(e.message); setList([]) } })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, loadKey])

  const [promoCode, setPromoCode] = useState('')  // B9：优惠码（原生 customfield.promo_code）

  useEffect(() => {
    let alive = true
    setQuote(null); setQuoteErr('')
    if (!sel) return
    const params = { recommend_config_id: sel.id }
    if (promoCode) params.customfield = { promo_code: [promoCode] }
    const timer = window.setTimeout(() => api.recommendConfigPrice(params)
      .then((r) => { if (alive) setQuote(r.data) })
      .catch((e) => { if (alive) setQuoteErr(e.message) }), 350)
    return () => { alive = false; window.clearTimeout(timer) }
  }, [sel, promoCode]) // eslint-disable-line react-hooks/exhaustive-deps

  const { isDowngrade, readSeconds, locked } = useDowngradeGate(quote)
  const go = async () => {
    if (busy || !quote || quoteErr) return
    if (!list || list.length === 0) {
      toast('当前商品暂无可升级的套餐', 'warning')
      return
    }
    if (!sel) {
      toast('请选择目标套餐', 'warning')
      return
    }
    setBusy(true); onSubmitting?.(true)
    try {
      const body = { recommend_config_id: sel.id }
      if (promoCode) body.customfield = { promo_code: [promoCode] }
      const r = await submit(api.recommendConfigOrder, body)
      const orderId = r.data?.id || r.data?.order_id
      const context = { upgradeKind: 'package', recommendConfigId: sel.id, configuration: { cpu: sel.cpu, memory: sel.memory, bw: sel.bw } }
      close()
      if (orderId && !isPaymentPaid(r)) onOpenPay?.(orderId, context)
      else { onOpDone?.(context); toast('操作已提交', 'success') }
    } catch (e) {
      toast(e.message, e.needOpPass ? 'warning' : 'error')
    } finally {
      setBusy(false); onSubmitting?.(false)
    }
  }

  return (
    <UpgradeFrame embedded={embedded} close={close}>
        {!embedded && <DialogHeader>
          <DialogTitle>套餐升降级</DialogTitle>
          <DialogDescription>切换到其他套餐，费用按比例结算。</DialogDescription>
        </DialogHeader>}
        {embedded && <p className="mb-3 text-xs text-muted-foreground">切换到其他套餐，费用按比例结算。</p>}
        {loadErr ? <div role="alert" className="space-y-2"><p className="text-sm text-danger">页面错误，请刷新重试</p></div> : list === null ? (
          <Skeleton className="h-40 w-full" />
        ) : list.length === 0 ? (
          <EmptyState title="暂无可升级的套餐" />
        ) : (
          <div className="max-h-[55vh] space-y-1.5 overflow-y-auto pr-1">
            {list.map((c) => (
              <ChoiceButton
                key={c.id}
                type="button"
                onClick={() => setSel(c)}
                selected={sel?.id === c.id} className="w-full text-left"
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-ink">{c.name || `套餐 #${c.id}`}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {[c.cpu && `${c.cpu}核`, c.memory && `${c.memory}G内存`, c.bw && `${c.bw}M带宽`, c.system_disk_size && `${c.system_disk_size}G系统盘`].filter(Boolean).join(' · ')}
                </p>
              </ChoiceButton>
            ))}
          </div>
        )}
        <div>
          <Label htmlFor="pkg-promo">优惠码（可选）</Label>
          <Input
            id="pkg-promo"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value)}
            placeholder="输入优惠码后自动重新询价"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1 rounded-lg border border-line bg-surface-alt px-3 py-2 text-xs text-body">
          <p>
            {quoteErr || (quote ? `补差价：${formatMoney(quote.price ?? quote.price_difference ?? 0)}${quote.description ? ` · ${quote.description}` : ''}` : (sel ? '询价中…' : '选择套餐后自动询价'))}
          </p>
          {quote && quote.renew_price !== undefined && quote.renew_price !== null ? (
            <p className="text-ink">
              升级后续费总额：<span className="font-semibold tabular-nums">{formatMoney(quote.renew_price)}</span>
              {quote.renew_price_difference ? <span className="text-muted-foreground">（续费差价 {formatMoney(quote.renew_price_difference)}）</span> : null}
            </p>
          ) : null}
        </div>
        {isDowngrade ? <DowngradeNotice readSeconds={readSeconds} className="mb-3" /> : null}
        {needPass && <OpPassField pass={pass} setPass={setPass} />}
        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={busy}>取消</Button>
          <DowngradeAwareSubmit onClick={go} disabled={busy || !quote || !!quoteErr || !!loadErr} locked={locked} readSeconds={readSeconds}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            提交升降级
          </DowngradeAwareSubmit>
        </DialogFooter>
    </UpgradeFrame>
  )
}

/* ---------------- 弹性升降级（order_page cpu/内存档位 + 线路 bw/flow/防御档位） ---------------- */
/* 契约（对齐原版 showUpgrade custom 分支）：
   GET  /product/:pid/mf_cloud/order_page → cpu/memory 档位 [{type:'radio'|'range',value,min_value,max_value}]
   GET  /product/:pid/mf_cloud/line/:line_id → {bill_type, bw:[...], flow:[...], defence:[...]}
   GET  /mf_cloud/:id/common_config（询价，cpu/memory 必填）→ POST common_config/order */
function ElasticUpgradeDialog({ api, cloud, host, close, onOpenPay, onOpDone, embedded = false, onSubmitting, preparedAt }) {
  const toast = useToast()
  const [pageCfg, setPageCfg] = useState(null)
  const [currentCloud, setCurrentCloud] = useState(cloud)
  const [loadErr, setLoadErr] = useState('')
  const [loadKey, setLoadKey] = useState(0)
  const [lineCfg, setLineCfg] = useState(null)
  const [form, setForm] = useState(null)
  const [quote, setQuote] = useState(null)
  const [quoteErr, setQuoteErr] = useState('')
  const [busy, setBusy] = useState(false)
  const { submit, needPass, pass, setPass } = useOpSubmit()
  const quoteTimer = useRef(null)

  useEffect(() => {
    let alive = true
    setLoadErr('')
    setPageCfg(null)
    setForm(null)
    const currentDetail = loadKey === 0 && preparedAt && Date.now() - preparedAt < 10000 ? Promise.resolve({ data: cloud }) : api.detail()
    Promise.all([api.orderPage(host.product_id), currentDetail]).then(async ([op, detail]) => {
      const current = detail.data
      if (current?.cpu === undefined || current?.memory === undefined) throw new Error('未能读取实例当前配置，请重试')
      const ln = current.line?.id ? await api.lineConfig(host.product_id, current.line.id) : { data: {} }
      if (!alive) return
      setCurrentCloud(current)
      setPageCfg(op.data || {})
      setLineCfg(ln.data || {})
      // 当前配置可能已经停售，也必须保留，不能自动换成现售档位。
      setForm({
        cpu: Number(current.cpu), memory: Number(current.memory),
        bw: current.bw ?? '', flow: current.flow ?? '',
        peak_defence: current.peak_defence ?? '', ip_num: current.ip_num ?? '',
        ipv6_num: current.ipv6_num ?? '', image_id: current.image?.id ?? '',
      })
    }).catch(e => { if (alive) setLoadErr(e.message || '配置读取失败') })
    return () => { alive = false }
  }, [api, host.product_id, loadKey])

  // 询价（防抖；cpu/memory 必填）
  useEffect(() => {
    let alive = true
    setQuote(null)
    setQuoteErr('')
    if (!form || !form.cpu || !form.memory) return
    window.clearTimeout(quoteTimer.current)
    quoteTimer.current = window.setTimeout(() => {
      setQuote(null)
      setQuoteErr('')
      api.commonConfig({
        cpu: Number(form.cpu),
        memory: Number(form.memory),
        bw: form.bw === '' ? undefined : Number(form.bw),
        flow: form.flow === '' ? undefined : Number(form.flow),
        peak_defence: form.peak_defence === '' ? undefined : form.peak_defence,
        ip_num: form.ip_num === '' ? undefined : Number(form.ip_num),
        ipv6_num: form.ipv6_num === '' ? undefined : Number(form.ipv6_num),
        image_id: form.image_id === '' || form.image_id == null ? undefined : Number(form.image_id),
      })
        .then((r) => { if (alive) setQuote(r.data) })
        .catch((e) => { if (alive) setQuoteErr(e.message) })
    }, 350)
    return () => { alive = false; window.clearTimeout(quoteTimer.current) }
  }, [form]) // eslint-disable-line react-hooks/exhaustive-deps

  const { isDowngrade, readSeconds, locked } = useDowngradeGate(quote)
  const go = async () => {
    if (busy) return
    // 未变更配置 / 无报价时给出明确反馈（而不是让按钮静默禁用）
    if (quoteErr) {
      toast(quoteErr.includes('未变更') ? '请先调整至少一项配置' : quoteErr, 'warning')
      return
    }
    if (!quote) {
      toast('正在询价，请稍候', 'warning')
      return
    }
    setBusy(true); onSubmitting?.(true)
    try {
      const body = {
        cpu: Number(form.cpu),
        memory: Number(form.memory),
        bw: form.bw === '' ? undefined : Number(form.bw),
        flow: form.flow === '' ? undefined : Number(form.flow),
        peak_defence: form.peak_defence === '' ? undefined : form.peak_defence,
        ip_num: form.ip_num === '' ? undefined : Number(form.ip_num),
        ipv6_num: form.ipv6_num === '' ? undefined : Number(form.ipv6_num),
        image_id: form.image_id === '' || form.image_id == null ? undefined : Number(form.image_id),
      }
      const context = { resources: changedUpgradeResources(currentCloud || cloud, body), configuration: body, upgradeKind: 'elastic' }
      const r = await submit(api.commonConfigOrder, body)
      const orderId = r.data?.id || r.data?.order_id
      close()
      if (orderId && !isPaymentPaid(r)) onOpenPay?.(orderId, context)
      else { onOpDone?.(context); toast('操作已提交', 'success') }
    } catch (e) {
      toast(e.message, e.needOpPass ? 'warning' : 'error')
    } finally {
      setBusy(false); onSubmitting?.(false)
    }
  }

  const memUnit = pageCfg?.config?.memory_unit || 'GB'
  const isFlow = lineCfg?.bill_type === 'flow'
  const selectedFlow = (lineCfg?.flow || []).find((o) => String(o.value) === String(form?.flow))

  /* 限制规则过滤（原版 mfCloudLimitRule 移植）：条件匹配当前选择的规则给出
     各维度允许值集合，命中的档位之外的选项不展示（不支持升降级即不可选）。
     过滤自身维度作为条件（ignoreRuleFields），避免「选了 2 核后 2 核被隐藏」。 */
  const rules = pageCfg?.limit_rule || []
  const limitParams = {
    data_center_id: currentCloud?.data_center?.id,
    line_id: currentCloud?.line?.id || form?.line_id,
    cpu: form?.cpu,
    memory: form?.memory,
    image_id: currentCloud?.image?.id,
    bw: form?.bw,
    flow: form?.flow,
    peak_defence: form?.peak_defence,
    ip_num: form?.ip_num ?? currentCloud?.ip_num,
    ipv4_num: form?.ip_num ?? currentCloud?.ip_num,
    ipv6_num: form?.ipv6_num ?? currentCloud?.ipv6_num,
    line_type: lineCfg?.bill_type || currentCloud?.line?.bill_type,
    system_disk: currentCloud?.system_disk || {},
  }
  const filterOpts = (key, items, ignore = [key]) =>
    filterItemsByResultWithMeta(rules, key, items, { params: limitParams, ignoreRuleFields: ignore, strictEmpty: false }).items
  const cpuOpts = filterOpts('cpu', pageCfg?.cpu || [])
  const memOpts = filterOpts('memory', pageCfg?.memory || [])
  const bwOpts = filterOpts('bw', (isFlow ? (selectedFlow?.bw || []) : (lineCfg?.bw || []))
    .filter((o) => (o.value !== undefined ? o.value !== '' : (o.out_bw !== undefined ? o.out_bw !== '' : false))))
  const flowOpts = filterOpts('flow', lineCfg?.flow || [])
  const defOpts = filterOpts('peak_defence', lineCfg?.defence || [], [])
  /* B5：IP 数量档位（expandTiers 展开 step 区间为离散值） */
  const ipOpts = (lineCfg?.ip || []).length
    ? filterOpts('ipv4_num', expandTiers(lineCfg.ip).map((v) => ({ value: v })))
    : []
  const ipv6Opts = (lineCfg?.ipv6 || []).length
    ? expandTiers(lineCfg.ipv6).map((v) => ({ value: v }))
    : []
  const cur = { cpu: currentCloud?.cpu, memory: currentCloud?.memory, bw: currentCloud?.bw, flow: currentCloud?.flow }

  return (
    <UpgradeFrame embedded={embedded} close={close}>
        {!embedded && <DialogHeader>
          <DialogTitle>弹性升降级</DialogTitle>
          <DialogDescription>
            当前：{[cur.cpu && `${cur.cpu}核`, cur.memory && `${cur.memory}${memUnit}`, cur.bw && `${cur.bw}M`].filter(Boolean).join(' · ') || '--'}；点选目标档位，差价按比例结算。
          </DialogDescription>
        </DialogHeader>}
        {embedded && <p className="mb-3 text-xs text-muted-foreground">当前：{[cur.cpu && `${cur.cpu}核`, cur.memory && `${cur.memory}${memUnit}`, cur.bw && `${cur.bw}M`].filter(Boolean).join(' · ') || '--'}；选择目标配置后自动询价。</p>}
        {loadErr ? (
          <div className="space-y-2" role="alert"><p className="text-sm text-danger">页面错误，请刷新重试</p></div>
        ) : pageCfg === null ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
            <OptionGroup label="CPU" options={cpuOpts} value={form?.cpu} currentValue={currentCloud?.cpu} onChange={(v) => setForm((f) => ({ ...f, cpu: v }))} unit="核" />
            <OptionGroup label="内存" options={memOpts} value={form?.memory} currentValue={currentCloud?.memory} onChange={(v) => setForm((f) => ({ ...f, memory: v }))} unit={memUnit} />
            {!isFlow && bwOpts.length ? (
              <OptionGroup label="带宽" options={bwOpts} value={form?.bw} currentValue={currentCloud?.bw} onChange={(v) => setForm((f) => ({ ...f, bw: v }))} unit="M" />
            ) : null}
            {isFlow && flowOpts.length ? (
              <>
                <OptionGroup label="月流量" options={flowOpts} value={form?.flow} currentValue={currentCloud?.flow} onChange={(v) => setForm((f) => ({ ...f, flow: v }))} unit="GB" />
                {bwOpts.length ? (
                  <OptionGroup
                    label="带宽" options={bwOpts} value={form?.bw} currentValue={currentCloud?.bw}
                    onChange={(v) => setForm((f) => ({ ...f, bw: v }))}
                    labelOf={(o) => (Number(o.out_bw ?? o.value) === 0 ? '不限' : `${o.out_bw ?? o.value}M`)}
                  />
                ) : null}
              </>
            ) : null}
            {defOpts.length ? (
              <OptionGroup
                label="防御峰值" options={defOpts} value={form?.peak_defence} currentValue={currentCloud?.peak_defence}
                onChange={(v) => setForm((f) => ({ ...f, peak_defence: v }))}
                labelOf={(o) => o.desc || `${o.value}G`}
              />
            ) : null}
            {/* B5：IPv4/IPv6 数量档位（线路有配置才显示；与升级档位一致） */}
            {ipOpts.length ? (
              <OptionGroup
                label="IPv4 数量" options={ipOpts} value={form?.ip_num} currentValue={currentCloud?.ip_num}
                onChange={(v) => setForm((f) => ({ ...f, ip_num: v }))}
                unit="个"
              />
            ) : null}
            {ipv6Opts.length && lineCfg?.bill_type !== 'vpc' ? (
              <OptionGroup
                label="IPv6 数量" options={ipv6Opts} value={form?.ipv6_num} currentValue={currentCloud?.ipv6_num}
                onChange={(v) => setForm((f) => ({ ...f, ipv6_num: v }))}
                unit="个"
              />
            ) : null}
          </div>
        )}
        <div className="space-y-1 rounded-lg border border-line bg-surface-alt px-3 py-2 text-xs text-body">
          <p>
            {quoteErr || (quote ? `补差价：${formatMoney(quote.price ?? quote.price_difference ?? 0)}${quote.description ? ` · ${quote.description}` : ''}` : (form?.cpu && form?.memory ? '询价中…' : '请先选择 CPU 与内存'))}
          </p>
          {quote && quote.renew_price !== undefined && quote.renew_price !== null ? (
            <p className="text-ink">
              升级后{host?.billing_cycle_name || '每周期'}续费总额：
              <span className="font-semibold tabular-nums">{formatMoney(quote.renew_price)}</span>
              {quote.renew_price_difference ? <span className="text-muted-foreground">（续费差价 {formatMoney(quote.renew_price_difference)}）</span> : null}
            </p>
          ) : null}
        </div>
        {isDowngrade ? <DowngradeNotice readSeconds={readSeconds} className="mb-3" /> : null}
        {needPass && <OpPassField pass={pass} setPass={setPass} />}
        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={busy}>取消</Button>
          <DowngradeAwareSubmit onClick={go} disabled={busy || !form || Boolean(loadErr)} locked={locked} readSeconds={readSeconds}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            提交升降级
          </DowngradeAwareSubmit>
        </DialogFooter>
    </UpgradeFrame>
  )
}

/* ---------------- 安全组绑定/解绑（参考原版 subAddSafe） ---------------- */
/* 契约：GET /security_group（会员安全组列表）；POST /security_group/:sgId/host/:hostId 绑定；
   DELETE /security_group/:sgId/host/:hostId 解绑；当前绑定来自 detail 的 security_group{id,name} */
function SecurityGroupDialog({ api, cloud, host, close, onChanged }) {
  const toast = useToast()
  const { data: list, error: loadError, retry } = useDialogRead(
    () => api.securityGroupList({ page: 1, limit: 100 }).then(r => r.data?.list || []), [api])
  const [sel, setSel] = useState('')
  const [busy, setBusy] = useState(false)
  const bound = cloud?.security_group?.id ? cloud.security_group : null

  useEffect(() => {
    const free = list?.find(s => String(s.id) !== String(bound?.id))
    setSel(free ? String(free.id) : '')
  }, [list, bound?.id])

  const bind = async () => {
    if (!sel) {
      toast('请选择安全组', 'error')
      return
    }
    setBusy(true)
    try {
      const r = await api.bindSecurityGroup(sel, { host_id: host.id })
      if (r.status === 200) {
        toast('安全组已绑定', 'success')
        onChanged?.({ securityGroupId: Number(sel) })
        close()
      } else {
        toast(r.msg || '绑定失败', 'error')
      }
    } catch (e) {
      toast(e.message, e.needOpPass ? 'warning' : 'error')
    } finally {
      setBusy(false)
    }
  }
  const unbind = async () => {
    setBusy(true)
    try {
      await api.unbindSecurityGroup(bound.id, { host_id: host.id })
      toast('已解绑安全组', 'success')
      onChanged?.({ securityGroupId: 0 })
      close()
    } catch (e) {
      toast(e.message, e.needOpPass ? 'warning' : 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && close()}>
      <DialogContent className="w-[min(92vw,420px)]">
        <DialogHeader>
          <DialogTitle>安全组</DialogTitle>
          <DialogDescription>安全组相当于虚拟防火墙，控制实例出入站规则。</DialogDescription>
        </DialogHeader>
        {loadError ? <DialogReadError onRetry={retry} /> : list === null ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border border-line bg-surface-alt px-3 py-2 text-xs">
              当前绑定：
              {bound ? (
                <span className="ml-1 font-medium text-ink">{bound.name || `安全组 #${bound.id}`}</span>
              ) : (
                <span className="ml-1 text-muted-foreground">未绑定</span>
              )}
            </div>
            <div>
              <Label htmlFor="sg-pick">{bound ? '更换为' : '选择安全组'}</Label>
              <Select id="sg-pick" value={sel} onChange={(e) => setSel(e.target.value)}>
                <option value="">请选择安全组</option>
                {list.filter((s) => String(s.id) !== String(bound?.id)).map((s) => (
                  <option key={s.id} value={s.id}>{s.name || `安全组 #${s.id}`}</option>
                ))}
              </Select>
              {list.length === 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  还没有安全组，前往 <a href="/security.htm" className="text-brand hover:underline">安全组管理</a> 创建。
                </p>
              ) : null}
            </div>
          </div>
        )}
        <DialogFooter>
          {bound ? (
            <Button variant="danger" onClick={unbind} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              解绑当前
            </Button>
          ) : null}
          <Button variant="outline" onClick={close}>取消</Button>
          <Button onClick={bind} disabled={busy || !sel || list?.length === 0}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            绑定
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ---------------- 登录信息弹窗：点文本复制单条；复制全部（含服务器 IP） ---------------- */
function LoginInfoDialog({ api, ips, cloud, close }) {
  const toast = useToast()
  const [show, setShow] = useState(false)
  const [remote, setRemote] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let alive = true, expires
    const controller = new AbortController()
    setRemote(null); setLoading(true); setError(''); setShow(false)
    api.withSignal(controller.signal).remoteInfo().then(response => {
      if (!alive) return
      setRemote(response.data)
      const until = Number(response.data?.verification_expires_at)
      if (until) expires = window.setTimeout(() => { if (alive) { setRemote(null); setShow(false); setError('安全验证已过期，请重新验证后查看') } }, Math.max(0, until * 1000 - Date.now()))
    }).catch(() => { if (alive) setError('页面错误，请刷新重试') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false; controller.abort(); window.clearTimeout(expires) }
  }, [api, attempt])
  const primaryIp = (Array.isArray(cloud?.ip) ? cloud.ip[0] : cloud?.ip)
    || (ips?.list?.[0]?.ip ?? '')

  const rows = [
    ['服务器 IP', primaryIp],
    ['用户名', remote?.username],
    ['密码', remote?.password],
    ['端口', remote?.port],
    ['面板密码', remote?.panel_pass],
  ].filter(([, v]) => v !== undefined && v !== null && v !== '')

  const copyText = async (label, val) => {
    if (!validRemote()) return
    const ok = await copyToClipboard(val)
    toast(ok ? `${label} 已复制` : '复制失败，请手动复制', ok ? 'success' : 'error')
  }
  const copyAll = async () => {
    if (!validRemote()) return
    if (!rows.length) {
      toast('暂无登录信息', 'error')
      return
    }
    const ok = await copyToClipboard(rows.map(([k, v]) => `${k}：${v}`).join('\n'))
    toast(ok ? '登录信息已全部复制' : '复制失败，请手动复制', ok ? 'success' : 'error')
  }

  const validRemote = () => {
    const until = Number(remote?.verification_expires_at)
    if (until && until * 1000 <= Date.now()) { setRemote(null); setShow(false); setError('安全验证已过期，请重新验证后查看'); return false }
    return !!remote && !loading && !error
  }

  return (
    <Dialog open onOpenChange={(v) => !v && close()}>
      <DialogContent className="w-[min(92vw,420px)]">
        <DialogHeader>
          <DialogTitle>登录信息</DialogTitle>
          <DialogDescription>点击信息文本可直接复制该项（敏感信息，请勿泄露）</DialogDescription>
        </DialogHeader>
        {loading ? <p role="status">正在读取登录信息…</p> : error ? <div role="alert"><p>{error}</p></div> : rows.length === 0 ? (
          <EmptyState title="暂无登录信息" description="实例可能未开通完成，稍后刷新重试。" />
        ) : (
          <div className="space-y-2">
            {rows.map(([label, val]) => (
              <div key={label} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-alt px-3 py-2">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => copyText(label, val)}
                  title={`点击复制${label}`}
                >
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className={cn('truncate font-mono text-sm text-ink transition-colors hover:text-brand', label === '密码' && !show && 'select-none blur-sm')}>{(label === '密码' || label === '面板密码') && !show ? '••••••••' : val}</p>
                </button>
                {label === '密码' ? (
                  <Button size="sm" variant="ghost" className="h-7 shrink-0 px-2" onClick={() => { if (validRemote()) setShow((v) => !v) }} aria-label={show ? '隐藏密码' : '显示密码'}>
                    {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={copyAll} disabled={!remote || loading || !!error} title="复制全部登录信息（含服务器 IP）">
            <Copy className="size-4" />
            复制全部
          </Button>
          <Button variant="outline" onClick={close}>关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ---------------- 购买磁盘（按大小直接计价） / 扩容 ---------------- */
/* 契约：GET /product/:pid/mf_cloud/order_page → data_disk:[{type:'step'|'radio',
   min_value,max_value,step,other_config:{disk_type}}] + config.disk_range_limit（步长）。
   起购数量 = 首档 min_value；上限 = 末档 max_value；大小直接询价（用户要求不展示档位）。
   POST /disk/order {id, add_disk:[{size,type}]}；扩容 {disk_id, size} */
function alignToStep(value, min, max, diskStep) {
  const step = Math.max(1, Number(diskStep || 1))
  const snapped = Math.round(value / step) * step
  return Math.min(Math.max(snapped, min), max)
}

function DiskOrderDialog({ api, host, module, close, onOpenPay, onOpDone }) {
  const toast = useToast()
  const [rows, setRows] = useState([])     // 新增行 [{size, type, disk_limit_id}]
  const [price, setPrice] = useState(null)
  const [priceErr, setPriceErr] = useState('')
  const [busy, setBusy] = useState(false)
  const submitLock = useRef(false)
  const session = window.CRA1Shared?.Request?.getToken?.() || ''
  const guard = useMemo(() => {
    try { return createDiskOrderGuard(window.localStorage, diskOrderScope(session, module, host.id)) }
    catch { return null }
  }, [session, module, host.id])
  const [receipt, setReceipt] = useState(null)
  const [receiptError, setReceiptError] = useState('')
  const [pricedKey, setPricedKey] = useState('')

  useEffect(() => {
    const sync = () => {
      try {
        if (!guard) throw Error('missing session')
        setReceipt(guard.read()); setReceiptError('')
      } catch { setReceiptError('订单记录暂时无法读取，请刷新页面或先到财务中心核对订单。') }
    }
    sync()
    const changed = event => { if (event.key === guard?.key || event.key === null) sync() }
    window.addEventListener('storage', changed)
    return () => window.removeEventListener('storage', changed)
  }, [guard])

  const { data: meta, error: loadError, retry } = useDialogRead(async () => {
      const [r, dl] = await Promise.all([api.orderPage(host.product_id), api.diskList()])
      const tiers = r.data?.data_disk || []
      const cfg = r.data?.config || {}
      const limitNum = Number(cfg.disk_limit_num || 16)
      const existing = (dl.data?.list || []).filter((d) => d.type2 === 'data').length
      if (!tiers.length) {
        return { tiers: [], none: true, limitNum, existing }
      }
      const step = cfg.disk_range_limit_switch && cfg.disk_range_limit ? Number(cfg.disk_range_limit) : 1
      const min = Math.min(...tiers.map((t) => Number(t.min_value ?? t.value ?? 0)))
      const max = Math.max(...tiers.map((t) => Number(t.max_value ?? t.value ?? 0)))
      const types = [...new Set(tiers.map((t) => t.other_config?.disk_type || ''))]
      return { tiers, min, max, step, types, limitNum, existing }
  }, [api, host.product_id], !receipt && !receiptError)

  useEffect(() => {
    // 默认一行（对齐原版 addMoreDisk 首次自动带一行）
    setRows(meta && !meta.none && meta.existing + 1 <= meta.limitNum
      ? [{ size: Number(meta.min), type: meta.types[0] || '', disk_limit_id: '' }] : [])
  }, [meta])

  /* 统一参数结构（A4，对齐原版 toCreateDisk:6134）：
     { remove_disk_id: [], add_disk: [{size, type, disk_limit_id}] } —— 询价与下单完全一致 */
  const buildBody = () => ({
    remove_disk_id: [],
    add_disk: rows.map((rw) => ({
      size: Number(rw.size),
      type: rw.type || '',
      disk_limit_id: rw.disk_limit_id || '',
    })),
  })
  const bodyKey = JSON.stringify(buildBody())
  const currentPrice = pricedKey === bodyKey ? price : null

  useEffect(() => {
    let active = true
    setPrice(null)
    setPriceErr('')
    setPricedKey('')
    if (!meta || meta.none || !rows.length || receipt || receiptError) return
    if (rows.some((rw) => rw.size === '' || rw.size == null)) return
    const t = window.setTimeout(() => {
      api.diskPrice(buildBody())
        .then(r => {
          if (!validQuoteAmount(r.data?.price ?? r.data?.total)) throw Error('invalid quote')
          if (active) { setPrice(r.data); setPricedKey(bodyKey) }
        })
        .catch(() => { if (active) setPriceErr('暂时无法获取价格，请稍后调整容量重试。') })
    }, 350)
    return () => { active = false; window.clearTimeout(t) }
  }, [rows, meta, api, bodyKey, receipt, receiptError]) // eslint-disable-line react-hooks/exhaustive-deps

  const diskLimitOptions = (row) => {
    // 若有档位带 disk_limit 配置，则提供性能档选项（对齐原版 calcDiskLimitList:2059）
    const hit = (meta?.tiers || []).find((t) => {
      const tType = t.other_config?.disk_type || ''
      if (tType !== (row.type || '')) return false
      const v = Number(t.value ?? t.min_value ?? 0)
      return t.type === 'radio' ? v === Number(row.size) : (Number(row.size) >= v && Number(row.size) <= Number(t.max_value ?? v))
    })
    return hit?.disk_limit || []
  }

  const go = async () => {
    if (submitLock.current || busy || receipt || receiptError || !guard || !meta || loadError) return
    if (!rows.length) {
      toast('请至少添加一块磁盘', 'warning')
      return
    }
    if (meta.existing + rows.length > meta.limitNum) {
      toast(`数据盘数量超出上限（最多 ${meta.limitNum} 块，现有 ${meta.existing} 块，本次新增 ${rows.length} 块）`, 'warning')
      return
    }
    if (rows.some(row => !Number.isFinite(Number(row.size)) || Number(row.size) < meta.min || Number(row.size) > meta.max)) {
      toast('请填写有效的磁盘容量', 'warning')
      return
    }
    if (!currentPrice) {
      toast('询价中，请稍候', 'warning')
      return
    }
    submitLock.current = true
    setBusy(true)
    let attempt
    try {
      const submit = async () => {
        if (session !== window.CRA1Shared?.Request?.getToken?.()) return
        attempt = guard.claim(window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`)
        if (!attempt) { setReceipt(guard.read()); return }
        setReceipt(attempt)
        const r = await api.diskOrder(buildBody())
        const orderId = r.data?.id || r.data?.order_id
        if (isPaymentPaid(r)) {
          guard.clear(attempt); setReceipt(null)
          onOpDone?.(); toast('操作已提交', 'success'); close()
        } else if (/^[1-9]\d*$/.test(String(orderId)) && Number.isSafeInteger(Number(orderId))) {
          const created = guard.update(attempt, 'created', orderId)
          setReceipt(created)
          if (session === window.CRA1Shared?.Request?.getToken?.()) {
            try {
              if (onOpenPay) await onOpenPay(created.orderId)
              else window.location.assign(`/cashier.htm?id=${created.orderId}`)
              close()
            } catch { toast('订单已创建，可继续支付，无需重新下单。', 'warning') }
          }
        } else setReceipt(guard.update(attempt, 'unknown'))
      }
      // Serialize the durable claim across tabs where the Web Locks API exists.
      if (window.navigator.locks?.request) await window.navigator.locks.request(guard.key, submit)
      else await submit()
    } catch (e) {
      if (!attempt) setReceiptError('无法保存本次订单记录，请检查浏览器存储设置后重试。')
      else if (definiteOrderRejection(e)) {
        try { guard.clear(attempt); setReceipt(null) } catch { setReceiptError('订单记录暂时无法更新，请先核对订单。') }
        toast(e.message, 'error')
      } else {
        try { setReceipt(guard.update(attempt, 'unknown')) } catch { /* Keep the pending receipt; never reopen submission. */ }
      }
    } finally {
      submitLock.current = false
      setBusy(false)
    }
  }

  const resumeOrder = async (checkOnly = false) => {
    if (submitLock.current || !receipt?.orderId) return
    submitLock.current = true; setBusy(true)
    try {
      const response = await api.orderDetail(receipt.orderId)
      const order = response.data?.order
      if (Number(order?.id) !== receipt.orderId) throw Error('missing order')
      if (['Paid', 'Cancelled', 'Refunded'].includes(order.status)) {
        guard.clear(receipt); setReceipt(null)
        if (order.status === 'Paid') onOpDone?.()
        toast(order.status === 'Paid' ? '订单已支付，正在更新磁盘信息' : '原订单已结束，可重新选择磁盘', 'success')
      } else if (!checkOnly) {
        if (onOpenPay) await onOpenPay(receipt.orderId)
        else window.location.assign(`/cashier.htm?id=${receipt.orderId}`)
        close()
      } else toast('原订单尚未结束，请继续处理原订单。', 'warning')
    } catch { toast('暂时无法读取订单，请稍后重试或到财务中心查看。', 'error') }
    finally { submitLock.current = false; setBusy(false) }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && !submitLock.current && close()}>
      <DialogContent className="w-[min(94vw,480px)]">
        <DialogHeader>
          <DialogTitle>购买数据盘</DialogTitle>
          <DialogDescription>
            {receipt || receiptError ? '请先核对上次提交的订单。' : meta?.min ? `起购 ${meta.min} GB${meta.step > 1 ? `，步长 ${meta.step} GB` : ''}；已有数据盘 ${meta.existing} 块，最多 ${meta.limitNum} 块。` : '输入容量后按价格直接计价。'}
          </DialogDescription>
        </DialogHeader>
        {receiptError ? <Alert tone="warning">{receiptError}</Alert> : receipt ? (
          <Alert tone="warning">
            {busy && receipt.state === 'pending' ? '正在提交订单，请稍候。' : receipt.state === 'created'
              ? '订单已创建，请继续处理原订单，无需重新下单。'
              : '本次提交结果尚未确认，请先查看订单记录，避免重复购买。若未找到对应订单，请联系客服核实。'}
            {receipt.orderId ? <p className="mt-2">订单 #{receipt.orderId}</p> : null}
          </Alert>
        ) : loadError ? <DialogReadError onRetry={retry} /> : meta === null ? (
          <Skeleton className="h-28 w-full" />
        ) : meta.none ? (
          <EmptyState title="当前商品未开放数据盘购买" />
        ) : meta.existing >= meta.limitNum ? (
          <EmptyState title="数据盘数量已达上限" description={`现有 ${meta.existing} 块，最多 ${meta.limitNum} 块。如需更多请先删除或联系客服。`} />
        ) : (
          <div className="space-y-3">
            {rows.map((rw, i) => (
              <div key={i} className="space-y-2 rounded-lg border border-line p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-body">新增磁盘 {i + 1}</span>
                  {rows.length > 1 ? (
                    <button
                      type="button"
                      className="text-xs text-danger"
                      onClick={() => setRows((list) => list.filter((_, k) => k !== i))}
                    >
                      移除
                    </button>
                  ) : null}
                </div>
                {meta.types.length > 1 ? (
                  <div>
                    <Label>磁盘类型</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {meta.types.map((tp) => (
                        <ChoiceButton
                          key={tp || '(默认)'}
                          type="button"
                          onClick={() => setRows((list) => list.map((x, k) => (k === i ? { ...x, type: tp, disk_limit_id: '' } : x)))}
                          selected={(rw.type || '') === tp}
                        >
                          {tp || '默认类型'}
                        </ChoiceButton>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div>
                  <Label htmlFor={`dk-size-${i}`}>
                    容量（GB，{meta.min} ~ {meta.max}{meta.step > 1 ? `，步长 ${meta.step} GB` : ''}）
                  </Label>
                  <Input
                    id={`dk-size-${i}`}
                    type="number"
                    min={meta.min}
                    max={meta.max}
                    step={meta.step}
                    value={rw.size}
                    onChange={(e) => setRows((list) => list.map((x, k) => (k === i ? { ...x, size: e.target.value } : x)))}
                    onBlur={() => setRows((list) => list.map((x, k) => (k === i ? { ...x, size: alignToStep(Number(x.size), meta.min, meta.max, meta.step) } : x)))}
                  />
                </div>
                {diskLimitOptions(rw).length ? (
                  <div>
                    <Label htmlFor={`dk-lim-${i}`}>性能档（可选）</Label>
                    <Select
                      id={`dk-lim-${i}`}
                      value={rw.disk_limit_id || ''}
                      onChange={(e) => setRows((list) => list.map((x, k) => (k === i ? { ...x, disk_limit_id: e.target.value } : x)))}
                    >
                      <option value="">默认</option>
                      {diskLimitOptions(rw).map((dl) => (
                        <option key={dl.id} value={dl.id}>
                          {`读 ${dl.read_bytes}/${dl.write_bytes} MB/s · ${dl.read_iops}/${dl.write_iops} IOPS`}
                        </option>
                      ))}
                    </Select>
                  </div>
                ) : null}
              </div>
            ))}
            {meta.existing + rows.length < meta.limitNum ? (
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => setRows((list) => [...list, { size: Number(meta.min), type: meta.types.length === 1 ? meta.types[0] : (meta.types[0] || ''), disk_limit_id: '' }])}
              >
                <Plus className="size-3.5" />
                再添加一块磁盘
              </Button>
            ) : (
              <p className="text-center text-xs text-muted-foreground">已达数量上限（{meta.limitNum} 块）</p>
            )}
            <p className={cn('rounded-lg border px-3 py-2 text-xs', priceErr ? 'border-danger/30 bg-danger/5 text-danger' : 'border-line bg-surface-alt text-body')}>
              {priceErr || (currentPrice
                ? `价格：${formatMoney(currentPrice.price ?? currentPrice.total)}${currentPrice.description ? ` · ${currentPrice.description}` : ''}`
                : '询价中…')}
            </p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={busy}>{receipt || receiptError ? '关闭' : '取消'}</Button>
          {receipt || receiptError ? <>
            <Button variant="outline" disabled={busy} onClick={() => window.location.assign('/finance.htm')}>查看订单记录</Button>
            {receipt?.orderId ? <Button disabled={busy} onClick={() => resumeOrder()}>继续处理订单</Button> : null}
            {receipt?.orderId ? <Button variant="outline" disabled={busy} onClick={() => resumeOrder(true)}>查询订单状态</Button> : null}
          </> : <Button onClick={go} disabled={busy || Boolean(loadError) || !meta || !currentPrice || !rows.length}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            提交订单
          </Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DiskResizeDialog({ api, host, close, onOpenPay, onOpDone }) {
  const toast = useToast()
  const [diskId, setDiskId] = useState('')
  const [size, setSize] = useState('')
  const [price, setPrice] = useState(null)
  const [priceErr, setPriceErr] = useState('')
  const [busy, setBusy] = useState(false)

  const { data, error: loadError, retry } = useDialogRead(async () => {
        const [dl, op] = await Promise.all([api.diskList(), api.orderPage(host.product_id)])
        // 后端仅允许扩容数据盘（type2==='data'，系统盘不可扩）
        const l = (dl.data?.list || []).filter((d) => d.type2 === 'data' && (d.status === 0 || d.status === 1))
        const tiers = op.data?.data_disk || []
        const cfg = op.data?.config || {}
        const step = cfg.disk_range_limit_switch && cfg.disk_range_limit ? Number(cfg.disk_range_limit) : 1
        return { disks: l, meta: tiers.length ? {
            min: Math.min(...tiers.map((t) => Number(t.min_value ?? t.value ?? 0))),
            max: Math.max(...tiers.map((t) => Number(t.max_value ?? t.value ?? 0))),
            step,
          } : null }
  }, [api, host.product_id])
  const disks = data?.disks ?? null
  const meta = data?.meta ?? null
  useEffect(() => {
    setDiskId(disks?.length ? String(disks[0].id) : '')
    setSize(disks?.length ? String((disks[0].size || 0) + 1) : '')
  }, [disks])

  const disk = (disks || []).find((d) => String(d.id) === diskId)

  /* 契约（对齐原版 subExpansion）：resize_data_disk = 全部数据盘的目标大小数组
     [{id, size, disk_limit_id}]；选中盘用新值，其余盘保持原值 */
  const resizePayload = () => {
    const rows = (disks || [])
      .filter((d) => d.type2 === 'data')
      .map((d) => ({
        id: Number(d.id),
        size: String(d.id) === diskId ? Number(size) : Number(d.size),
        disk_limit_id: d.disk_limit_id || '',
      }))
    return { resize_data_disk: rows }
  }

  useEffect(() => {
    let active = true
    setPrice(null)
    setPriceErr('')
    if (!diskId || !size || !meta) return
    const t = window.setTimeout(() => {
      api.diskResizePrice(resizePayload())
        .then(r => { if (active) setPrice(r.data) })
        .catch(e => { if (active) setPriceErr(e.message) })
    }, 350)
    return () => { active = false; window.clearTimeout(t) }
  }, [diskId, size, disks, meta]) // eslint-disable-line react-hooks/exhaustive-deps

  const go = async () => {
    /* B1：提交前显式校验（对齐原版三重保证：radio 过滤/step min/无档位提示） */
    if (!meta) {
      toast('配置加载中，请稍候', 'warning')
      return
    }
    const curSize = Number(disk?.size || 0)
    const newSize = Number(size)
    if (!newSize || newSize <= curSize) {
      toast(`扩容后容量需大于当前容量（当前 ${curSize} GB）`, 'warning')
      return
    }
    if (meta.max && newSize > meta.max) {
      toast(`容量不能超过上限 ${meta.max} GB`, 'warning')
      return
    }
    if (meta.step > 1 && newSize % meta.step !== 0) {
      toast(`容量需为 ${meta.step} GB 的整数倍`, 'warning')
      return
    }
    setBusy(true)
    try {
      const r = await api.diskResizeOrder(resizePayload())
      const orderId = r.data?.id || r.data?.order_id
      close()
      if (orderId && !isPaymentPaid(r)) onOpenPay?.(orderId)
      else { onOpDone?.(); toast('扩容已提交', 'success') }
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && close()}>
      <DialogContent className="w-[min(92vw,400px)]">
        <DialogHeader>
          <DialogTitle>磁盘扩容</DialogTitle>
          <DialogDescription>扩容仅支持增大容量，不可回退。</DialogDescription>
        </DialogHeader>
        {loadError ? <DialogReadError onRetry={retry} /> : disks === null ? (
          <Skeleton className="h-28 w-full" />
        ) : disks.length === 0 ? (
          <EmptyState title="暂无可扩容的数据盘" description="扩容仅支持数据盘；当前实例没有数据盘，可先「购买磁盘」。" />
        ) : !meta ? (
          <EmptyState title="当前商品暂不支持磁盘扩容" />
        ) : (
          <div className="space-y-3">
            <div>
              <Label htmlFor="rz-disk">选择磁盘</Label>
              <Select id="rz-disk" value={diskId} onChange={(e) => {
                setDiskId(e.target.value)
                const d = disks.find((x) => String(x.id) === e.target.value)
                if (d) setSize(String((d.size || 0) + 1))
              }}>
                {disks.map((d) => (
                  <option key={d.id} value={d.id}>{d.name || `磁盘 #${d.id}`}（当前 {d.size} GB）</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="rz-size">
                目标容量（GB{meta?.max ? `，上限 ${meta.max} GB` : ''}{meta?.step > 1 ? `，步长 ${meta.step} GB` : ''}）
              </Label>
              <Input
                id="rz-size"
                type="number"
                min={Number(disk?.size || 0) + 1}
                max={meta?.max}
                step={meta?.step}
                value={size}
                onChange={(e) => setSize(e.target.value)}
                onBlur={() => meta && setSize(String(alignToStep(Number(size), Number(disk?.size || 0) + 1, meta.max, meta.step)))}
              />
            </div>
            <div className="space-y-1 rounded-lg border border-line bg-surface-alt px-3 py-2 text-xs text-body">
              <p>
                {priceErr || (price
                  ? `补差价：${formatMoney(price.price ?? price.price_difference)}${price.description ? ` · ${price.description}` : ''}`
                  : '询价中…')}
              </p>
              {price && price.renew_price !== undefined && price.renew_price !== null ? (
                <p className="text-ink">
                  扩容后续费总额：<span className="font-semibold tabular-nums">{formatMoney(price.renew_price)}</span>
                  {price.renew_price_difference ? <span className="text-muted-foreground">（续费差价 {formatMoney(price.renew_price_difference)}）</span> : null}
                </p>
              ) : null}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={close}>取消</Button>
          <Button onClick={go} disabled={busy || Boolean(loadError) || !meta || !diskId || !price}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            提交扩容
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ---------------- 备份/快照：创建 / 还原 / 删除 / 数量调整 ---------------- */
function BsConfigDialog({ api, dlg, cloud, host, close, onOpenPay, reloadCloud }) {
  const toast = useToast()
  const isBackup = dlg.isBackup
  const current = Number((isBackup ? cloud?.backup_num : cloud?.snap_num) || 0)
  const [num, setNum] = useState(current)
  const [quote, setQuote] = useState(null)
  const [quoteErr, setQuoteErr] = useState('')
  const [busy, setBusy] = useState(false)

  /* 契约（对齐原版）：档位来自商品配置 backup_config / snap_config（order_page 返回），
     不是自由输入 —— 只能选择后台已配置的数量；GET /backup_config {type,num} 询价。 */
  const { data: tiers, error: loadError, retry } = useDialogRead(() =>
    api.orderPage(host?.product_id).then(r => (isBackup ? r.data?.backup_config : r.data?.snap_config) || []), [api, host?.product_id, isBackup])
  useEffect(() => {
    setNum(tiers?.length ? Number(tiers[0].num) : current)
  }, [tiers, current])

  useEffect(() => {
    let active = true
    setQuote(null)
    setQuoteErr('')
    const n = Number(num)
    if (loadError || tiers === null || !isFinite(n) || n < 1 || n === current) return
    const t = window.setTimeout(() => {
      api.backupConfig({ type: isBackup ? 'backup' : 'snap', num: n })
        .then(r => { if (active) setQuote(r.data) })
        .catch(e => { if (active) setQuoteErr(e.message) })
    }, 350)
    return () => { active = false; window.clearTimeout(t) }
  }, [num, current, tiers, loadError]) // eslint-disable-line react-hooks/exhaustive-deps

  const { isDowngrade, readSeconds, locked } = useDowngradeGate(quote, Number(num) < current)
  /* B8：已用数量（当前存在的备份/快照数）—— 目标数不能低于已用数（后端拒绝） */
  const usedNum = Number(isBackup ? (dlg.usedBackup ?? 0) : (dlg.usedSnap ?? 0))

  const go = async () => {
    if (loadError || tiers === null || !quote) return
    if (Number(num) === current) {
      toast('数量未变更', 'warning')
      return
    }
    if (usedNum > 0 && Number(num) < usedNum) {
      toast(`目标数量不能低于已使用数量（当前已使用 ${usedNum} 个）`, 'warning')
      return
    }
    setBusy(true)
    try {
      const r = await api.backupConfigOrder({ type: isBackup ? 'backup' : 'snap', num: Number(num) })
      const orderId = r.data?.id || r.data?.order_id
      close()
      if (orderId && !isPaymentPaid(r)) onOpenPay?.(orderId)
      else {
        toast('已提交', 'success')
        reloadCloud?.()
      }
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && close()}>
      <DialogContent className="w-[min(92vw,420px)]">
        <DialogHeader>
          <DialogTitle>调整{isBackup ? '备份' : '快照'}数量</DialogTitle>
          <DialogDescription>当前 {current} 个；仅可选择商品已配置的数量档位，调整后费用按比例结算。</DialogDescription>
        </DialogHeader>
        {loadError ? <DialogReadError onRetry={retry} /> : tiers === null ? (
          <Skeleton className="h-28 w-full" />
        ) : tiers.length === 0 ? (
          <EmptyState title="当前商品未配置可调整的数量档位" />
        ) : (
          <div className="space-y-3">
            <div>
              <Label>选择数量</Label>
              <div className="flex flex-wrap gap-1.5">
                {tiers.map((t) => {
                  const belowUsed = usedNum > 0 && Number(t.num) < usedNum
                  return (
                    <ChoiceButton
                      key={t.id ?? t.num}
                      type="button"
                      disabled={belowUsed}
                      title={belowUsed ? `低于已使用数量（${usedNum} 个），不可选` : undefined}
                      onClick={() => setNum(Number(t.num))}
                      selected={Number(num) === Number(t.num)}
                    >
                      {t.num} 个{t.price != null ? `（${formatMoney(t.price)}）` : ''}
                    </ChoiceButton>
                  )
                })}
              </div>
            </div>
            <div className="space-y-1 rounded-lg border border-line bg-surface-alt px-3 py-2 text-xs text-body">
              <p className={quoteErr ? 'text-warning' : ''}>
                {Number(num) === current
                  ? '与当前数量相同'
                  : quoteErr
                    ? quoteErr
                    : quote
                      ? `补差价：${formatMoney(quote.price ?? quote.price_difference ?? 0)}${quote.description ? ` · ${quote.description}` : ''}`
                      : '询价中…'}
              </p>
              {quote && quote.renew_price !== undefined && quote.renew_price !== null ? (
                <p className="text-ink">
                  调整后续费总额：<span className="font-semibold tabular-nums">{formatMoney(quote.renew_price)}</span>
                </p>
              ) : null}
            </div>
          </div>
        )}
        {isDowngrade ? <DowngradeNotice readSeconds={readSeconds} className="mt-1" /> : null}
        <DialogFooter>
          <Button variant="outline" onClick={close}>取消</Button>
          <DowngradeAwareSubmit onClick={go} disabled={busy || Boolean(loadError) || !quote || Number(num) === current} locked={locked} readSeconds={readSeconds}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            提交调整
          </DowngradeAwareSubmit>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ---------------- 备份/快照还原（A1：此前组件缺失导致点击崩溃） ---------------- */
/* 契约（原版 subhyBs cloudDetail.js:7205）：备份 {id, backup_id} → POST /backup/restore；
   快照 {id, snapshot_id} → POST /snapshot/restore。仅 status===1 可操作（入口已限制）。 */
function BsRestoreDialog({ api, dlg, close, onOpDone }) {
  const toast = useToast()
  const isBackup = dlg.isBackup
  const onDone = dlg.onDone
  const item = dlg.item || {}
  const [busy, setBusy] = useState(false)

  const go = async () => {
    setBusy(true)
    try {
      await (isBackup
        ? api.restoreBackup({ backup_id: item.id })
        : api.restoreSnapshot({ snapshot_id: item.id }))
      toast('还原任务已提交', 'success')
      onDone?.()
      onOpDone?.()
      close()
    } catch (e) {
      toast(e.message, e.needOpPass ? 'warning' : 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && close()}>
      <DialogContent className="w-[min(92vw,400px)]">
        <DialogHeader>
          <DialogTitle>还原{isBackup ? '备份' : '快照'}</DialogTitle>
          <DialogDescription>
            确认将实例还原到「{item.name || `#${item.id}`}」？还原会覆盖当前系统数据，且不可撤销。
          </DialogDescription>
        </DialogHeader>
        <Alert tone="warning" className="text-xs">
          还原期间实例将短暂不可用，请确保已保存重要数据。
        </Alert>
        <DialogFooter>
          <Button variant="outline" onClick={close}>取消</Button>
          <Button variant="danger" onClick={go} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            确认还原
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ---------------- 备份/快照删除（A1：此前组件缺失导致点击崩溃） ---------------- */
/* 契约（原版 subDelBs cloudDetail.js:7250）：DELETE /backup/{backup_id} | /snapshot/{snapshot_id}，
   成功后刷新列表。 */
function BsDeleteDialog({ api, dlg, close, onOpDone }) {
  const toast = useToast()
  const isBackup = dlg.isBackup
  const onDone = dlg.onDone
  const item = dlg.item || {}
  const [busy, setBusy] = useState(false)

  const go = async () => {
    setBusy(true)
    try {
      await (isBackup ? api.delBackup(item.id) : api.delSnapshot(item.id))
      toast('已删除', 'success')
      onDone?.()
      onOpDone?.()
      close()
    } catch (e) {
      toast(e.message, e.needOpPass ? 'warning' : 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ConfirmDialog
      open
      title={`删除${isBackup ? '备份' : '快照'}`}
      description={`确认删除「${item.name || `#${item.id}`}」？删除后无法恢复。`}
      confirmText="删除"
      tone="danger"
      busy={busy}
      onConfirm={go}
      onCancel={close}
    />
  )
}

function BsCreateDialog({ api, dlg, close, cloud, onOpDone }) {
  const isBackup = dlg.isBackup
  const onDone = dlg.onDone
  const toast = useToast()
  const [diskId, setDiskId] = useState('')
  const [name, setName] = useState('')
  const [spaceId, setSpaceId] = useState('')
  const [busy, setBusy] = useState(false)

  /* 契约（对齐原版）：创建快照/备份均需 {name, disk_id}；备份在 space 模式下
     额外必填 mf_cloud_backup_host_id（备份空间实例）。磁盘列表 = 全部已挂载盘。 */
  const isSpace = isBackup && cloud?.backup_mode === 'space'

  const { data: disks, error: diskError, retry: retryDisks } = useDialogRead(() => api.diskList()
    .then(r => (r.data?.list || []).filter(d => d.status === 0 || d.status === 1 || d.type2 === 'system')), [api], !isSpace)
  useEffect(() => { setDiskId(disks?.length ? String(disks[0].id) : '') }, [disks])

  const { data: spaces, error: spaceError, retry: retrySpaces } = useDialogRead(() =>
    get('/mf_cloud_backup/available', { host_id: cloud?.id })
      .then((r) => {
        return (r.data?.list || []).map((x) => ({
          ...x,
          showName: `#${x.id}-${x.name}${x.country_name || x.city ? `(${[x.country_name, x.city, x.area].filter(Boolean).join('-')})` : ''} ${x.used_size ?? 0}GB/${x.size ?? 0}GB`,
        }))
      }), [cloud?.id], isSpace)
  useEffect(() => { setSpaceId(spaces?.length ? String(spaces[0].id) : '') }, [spaces])

  const go = async () => {
    /* A7：space 模式只校验备份空间（原版 subCgBs:7133 分支），非 space 校验磁盘 */
    if (isSpace) {
      if (spaceError || spaces === null) {
        toast('暂时无法读取备份空间，请稍后重试或联系客服', 'warning')
        return
      }
      if (!spaceId) {
        toast('请选择备份空间', 'warning')
        return
      }
    } else if (!diskId) {
      toast('请选择磁盘', 'warning')
      return
    }
    setBusy(true)
    try {
      const body = { name: name || `${formatDate(Date.now() / 1000)} 的${isBackup ? '备份' : '快照'}` }
      if (isSpace) {
        body.mf_cloud_backup_host_id = Number(spaceId)
      } else {
        body.disk_id = Number(diskId)
      }
      await (isBackup ? api.createBackup(body) : api.createSnapshot(body))
      toast(`${isBackup ? '备份' : '快照'}创建任务已提交`, 'success')
      onDone?.()
      onOpDone?.()
      close()
    } catch (e) {
      toast(e.message, e.needOpPass ? 'warning' : 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && close()}>
      <DialogContent className="w-[min(92vw,400px)]">
        <DialogHeader>
          <DialogTitle>创建{isBackup ? '备份' : '快照'}</DialogTitle>
          <DialogDescription>为该磁盘创建{isBackup ? '备份' : '快照'}，创建期间实例性能可能受轻微影响。</DialogDescription>
        </DialogHeader>
        {!isSpace && diskError ? <DialogReadError onRetry={retryDisks} /> : !isSpace && disks === null ? (
          <Skeleton className="h-24 w-full" />
        ) : !isSpace && disks.length === 0 ? (
          <EmptyState title="暂无可操作的磁盘" />
        ) : (
          <div className="space-y-3">
            {/* A7：非 space 模式才选磁盘（space 模式备份到独立空间，原版不选磁盘） */}
            {!isSpace ? (
              <div>
                <Label htmlFor="bs-disk">选择磁盘</Label>
                <Select id="bs-disk" value={diskId} onChange={(e) => setDiskId(e.target.value)}>
                  {disks.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name || `磁盘 #${d.id}`}（{d.size} GB{d.type2 === 'system' ? ' · 系统盘' : ' · 数据盘'}）
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}
            {/* 备份空间（space 模式必选；插件未安装时引导） */}
            {isSpace ? (
              spaceError ? <DialogReadError onRetry={retrySpaces} /> : spaces === null ? (
                <Skeleton className="h-16 w-full" />
              ) : spaces.length === 0 ? (
                <p className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
                  暂无可用备份空间{cloud?.backup_cart_url ? <>，可前往 <a className="text-brand hover:underline" href={cloud.backup_cart_url} target="_blank" rel="noreferrer">购买备份空间</a></> : '（请先购买备份空间）'}
                </p>
              ) : (
                <div>
                  <Label htmlFor="bs-space">备份空间<span className="text-danger">*</span></Label>
                  <Select id="bs-space" value={spaceId} onChange={(e) => setSpaceId(e.target.value)}>
                    {spaces.map((x) => (
                      <option key={x.id} value={x.id}>{x.showName}</option>
                    ))}
                  </Select>
                </div>
              )
            ) : null}
            <div>
              <Label htmlFor="bs-name">名称</Label>
              <Input id="bs-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={`${formatDate(Date.now() / 1000)} 的${isBackup ? '备份' : '快照'}`} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={close}>取消</Button>
          <Button onClick={go} disabled={busy || (isSpace ? (!spaceId || Boolean(spaceError)) : (!diskId || Boolean(diskError)))}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
/* ---------------- 流量包 ---------------- */
function FlowPacketDialog({ api, close, onOpenPay, onOpDone }) {
  const toast = useToast()
  const [list, setList] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [busyId, setBusyId] = useState(0)
  const [capacity, setCapacity] = useState({})
  const [filterType, setFilterType] = useState(0)
  const [retry, setRetry] = useState(0)
  const alive = useRef(false), submitting = useRef(false)
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])
  useEffect(() => {
    let current = true
    const controller = new AbortController()
    setList(null); setLoadError(''); setCapacity({})
    api.withSignal(controller.signal).flowPacketList({ page: 1, limit: 9999 })
      .then(r => {
        const data = normalizeFlowPackets(r.data?.list)
        if (!current) return
        setList(data); setFilterType(defaultFlowPacketType(data))
      }).catch(e => { if (current) setLoadError(e.message || '流量包加载失败') })
    return () => { current = false; controller.abort() }
  }, [api, retry])

  /* B3：已达本月限购上限的包不可购买（对齐原版 isPackageDisabled flowPacket.js:369） */
  const isDisabled = flowPacketDisabled
  const limitText = (pkg) => {
    const limit = Number(pkg.monthly_purchase_limit ?? 0)
    if (isDisabled(pkg)) return '本月已达上限'
    if (limit <= 0) return '不限次数'
    const left = pkg.monthly_purchase_left ?? Math.max(limit - Number(pkg.monthly_purchase_count || 0), 0)
    return `本月可购 ${left} 次`
  }
  const filtered = (list || []).filter((pkg) => Number(pkg.long_term_valid || 0) === filterType)

  const buy = async (pkg) => {
    if (submitting.current) return
    let body
    try { body = flowPacketOrderBody(pkg, capacity[pkg.id]) }
    catch (e) { toast(e.message, 'warning'); return }
    submitting.current = true; setBusyId(pkg.id)
    try {
      const r = await api.flowPacketOrder(body)
      if (!alive.current) return
      const orderId = r.data?.id || r.data?.order_id
      close()
      if (orderId && !isPaymentPaid(r)) onOpenPay?.(orderId)
      else { onOpDone?.(); toast('流量包购买已提交', 'success') }
    } catch (e) { if (alive.current) toast(e.message, 'error') }
    finally { submitting.current = false; if (alive.current) setBusyId(0) }
  }

  const hasLongTerm = (list || []).some(p => p.long_term_valid === 1)
  const hasLimited = (list || []).some(p => p.long_term_valid === 0)

  return (
    <Dialog open onOpenChange={(v) => !v && close()}>
      <DialogContent className="w-[min(92vw,460px)]">
        <DialogHeader>
          <DialogTitle>购买流量包</DialogTitle>
          <DialogDescription>流量包用于抵扣当月超出套餐的流量。</DialogDescription>
        </DialogHeader>
        {loadError ? (
          <div className="py-5 text-center"><p className="mb-3 text-sm text-danger" role="alert">页面错误，请刷新重试</p></div>
        ) : list === null ? (
          <Skeleton className="h-32 w-full" />
        ) : list.length === 0 ? (
          <EmptyState title="暂无可购流量包" />
        ) : (
          <div className="space-y-3">
            {/* B3：限时/不限时筛选 */}
            {hasLongTerm ? (
              <div className="cui-tabs flex w-full">
                {[[0, '限时流量包'], [1, '不限时流量包']].filter(([k]) => k === 0 ? hasLimited : hasLongTerm).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setFilterType(k)}
                    aria-pressed={filterType === k} className="cui-tabs__trigger flex-1"
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="max-h-72 space-y-1.5 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">该分类下暂无流量包</p>
              ) : filtered.map((pkg) => {
                const disabled = isDisabled(pkg)
                return (
                  <div key={pkg.id} className={cn('rounded-lg border px-3 py-2', disabled ? 'border-line bg-surface-alt opacity-60' : 'border-line')}>
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-sm text-ink">
                          {pkg.name || `${pkg.capacity}GB 流量包`}
                          {disabled ? <span className="ml-2 rounded bg-warning/10 px-1.5 py-0.5 text-[11px] text-warning">本月已达上限</span> : null}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {pkg.billing_mode === 0 ? `${pkg.capacity} GB · ` : ''}{pkg.price != null ? formatMoney(pkg.price) : ''}
                          {pkg.billing_mode === 1 ? ' /GB' : ''}
                          {pkg.long_term_valid === 1 ? ' · 长期有效' : ' · 随流量周期重置'}
                          {` · ${limitText(pkg)}`}
                        </p>
                      </div>
                      <Button size="sm" onClick={() => buy(pkg)} disabled={disabled || busyId !== 0}>
                        {busyId === pkg.id ? <Loader2 className="size-3.5 animate-spin" /> : null}
                        购买
                      </Button>
                    </div>
                    {pkg.billing_mode === 1 ? (
                      <div className="mt-2">
                        <Label htmlFor={`cap-${pkg.id}`}>购买容量（GB，{pkg.min_capacity}~{pkg.max_capacity}）</Label>
                        <Input
                          id={`cap-${pkg.id}`}
                          type="number"
                          min={pkg.min_capacity}
                          max={pkg.max_capacity}
                          value={capacity[pkg.id] ?? pkg.min_capacity}
                          onChange={(e) => setCapacity((c) => ({ ...c, [pkg.id]: e.target.value }))}
                        />
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function expandTiers(tiers) {
  if (!tiers || !tiers.length) return []
  const out = []
  for (const t of tiers) {
    if (t.type === 'radio') {
      if (t.value !== undefined && t.value !== null && t.value !== '') out.push(Number(t.value))
    } else {
      const min = Number(t.min_value ?? 0)
      const max = Number(t.max_value ?? min)
      const step = Math.max(1, Number(t.step || 1))
      for (let v = min; v <= max; v += step) out.push(v)
    }
  }
  return [...new Set(out)].sort((a, b) => a - b)
}

function IpOrderDialog({ api, cloud, host, ips, close, onOpenPay, onOpDone }) {
  const toast = useToast()
  const [tiers, setTiers] = useState(null) // {ipValues:[], ipv6Values:[]}
  const [ipNum, setIpNum] = useState('')
  const [ipv6Num, setIpv6Num] = useState('')
  const [price, setPrice] = useState(null)
  const [priceErr, setPriceErr] = useState('')
  const [busy, setBusy] = useState(false)
  /* A3：降级时指定要删除的 IP（对齐原版 ipv4DelArr/ipv6DelArr + calcDelNum）
     - 仅当目标数 < 当前数时出现；可选项 = 实际 IP 列表；上限 = 差值
     - 提交前校验 length ∈ {0, 差值}（原版 subAddIp:6805-6818、后端 CloudLogic.php:3829-3836） */
  const [ip4Del, setIp4Del] = useState([])
  const [ip6Del, setIp6Del] = useState([])
  const lineId = cloud?.line?.id
  const productId = host?.product_id
  /* 语义（对齐原版）：
     - ip_num（detail 字段）= **附加 IP 数量**（不含默认赠送的那 1 个）
     - 列表总数 = 1(默认赠送) + 附加数；后台档位 min/max 也是附加数的范围
     - 价目：附加第 1 个免费、第 2/3 个每个按商品价（如 15 元/月） */
  const attachedCount = Number(cloud?.ip_num ?? 0)                 // 附加 IP 数
  const totalCount = (ips?.list?.length ?? (attachedCount + 1))    // 总 IP 数
  const attachedIpv6 = Number(cloud?.ipv6_num ?? 0)

  // 实际可删除的 IP 列表（对齐原版 ipv4Select=dedicate_ip+assign_ip）
  const ip4Options = (ips?.list || []).map((x) => x.ip).filter(Boolean)
  // 需要降级的差额（目标 < 当前）
  const ip4DelNum = ipNum !== '' && Number(ipNum) < attachedCount ? attachedCount - Number(ipNum) : 0

  /* 切换档位 → 清空已选删除项（对齐原版 changeIpNum:6611-6615 / selectIpValue:6049） */
  const pickIpNum = (v) => {
    setIpNum(String(v))
    setIp4Del([])
  }

  useEffect(() => {
    if (!lineId || !productId) {
      setTiers({ ipValues: [], ipv6Values: [] })
      return
    }
    /* B7：档位限制规则（对齐原版 calcIPList 977-1120）
       - VPC 网络不支持 IPv6 调整（原版 template:1385 network_type !== 'vpc'）
       - limit_rule 的 ipv4_num 结果维度过滤档位 */
    Promise.all([
      api.lineConfig(productId, lineId),
      api.orderPage(productId).catch(() => null),
    ]).then(([r, op]) => {
      const rules = op?.data?.limit_rule || []
      const allIp = expandTiers(r.data?.ip)
      const allIp6 = expandTiers(r.data?.ipv6)
      const params = {
        data_center_id: cloud?.data_center?.id,
        line_id: lineId,
        cpu: cloud?.cpu,
        memory: cloud?.memory,
        image_id: cloud?.image?.id,
        bw: cloud?.bw,
        flow: cloud?.flow,
        peak_defence: cloud?.peak_defence,
        ip_num: cloud?.ip_num,
        ipv4_num: cloud?.ip_num,
        ipv6_num: cloud?.ipv6_num,
        line_type: cloud?.line?.bill_type,
        system_disk: cloud?.system_disk || {},
      }
      const ipFiltered = filterItemsByResultWithMeta(
        rules, 'ipv4_num', allIp.map((v) => ({ value: v })),
        { params, ignoreRuleFields: ['ipv4_num'], strictEmpty: false }
      ).items.map((x) => x.value)
      const isVpc = cloud?.network_type === 'vpc'
      setTiers({
        ipValues: ipFiltered.length ? ipFiltered : allIp,
        ipv6Values: isVpc ? [] : allIp6,   // VPC 下隐藏 IPv6
      })
      setIpNum(String(attachedCount))
      setIpv6Num(String(attachedIpv6))
    }).catch(() => setTiers({ ipValues: [], ipv6Values: [] }))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!tiers) return
    if (ipNum === '') return
    if (Number(ipNum) === attachedCount) { setPrice(null); setPriceErr(''); return }
    const t = window.setTimeout(() => {
      setPrice(null)
      setPriceErr('')
      api.ipNumPrice({ ip_num: Number(ipNum), ipv6_num: Number(ipv6Num) })
        .then((r) => setPrice(r.data))
        .catch((e) => setPriceErr(e.message))
    }, 350)
    return () => window.clearTimeout(t)
  }, [ipNum, ipv6Num, tiers]) // eslint-disable-line react-hooks/exhaustive-deps

  const { isDowngrade, readSeconds, locked } = useDowngradeGate(price, Number(ipNum) < attachedCount)

  const go = async () => {
    if (Number(ipNum) < attachedCount && price == null) {
      toast('降级不退款：请先阅读提示并等待倒计时', 'warning')
      return
    }
    // A3：降级时删除列表只能为空（随机删）或恰好等于差额（对齐原版 subAddIp 校验）
    if (ip4DelNum > 0 && ip4Del.length !== 0 && ip4Del.length !== ip4DelNum) {
      toast(`请选择进行降级操作所需的对应数量的 IP（还需 ${ip4DelNum - ip4Del.length} 个）`, 'warning')
      return
    }
    setBusy(true)
    try {
      const body = { ip_num: Number(ipNum || 0), ipv6_num: Number(ipv6Num || 0) }
      if (ip4Del.length) body.ip = ip4Del
      if (ip6Del.length) body.ipv6 = ip6Del
      const r = await api.ipNumOrder(body)
      const orderId = r.data?.id || r.data?.order_id
      close()
      if (orderId && !isPaymentPaid(r)) onOpenPay?.(orderId)
      else { onOpDone?.(); toast('操作已提交', 'success') }
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  if (!tiers) {
    return (
      <Dialog open onOpenChange={(v) => !v && close()}>
        <DialogContent className="w-[min(92vw,400px)]">
          <DialogHeader>
            <DialogTitle>附加 IP</DialogTitle>
          </DialogHeader>
          <Skeleton className="h-24 w-full" />
        </DialogContent>
      </Dialog>
    )
  }

  const hasIp4 = tiers.ipValues.length > 0
  const hasIp6 = tiers.ipv6Values.length > 0
  if (!hasIp4 && !hasIp6) {
    return (
      <Dialog open onOpenChange={(v) => !v && close()}>
        <DialogContent className="w-[min(92vw,400px)]">
          <DialogHeader>
            <DialogTitle>附加 IP</DialogTitle>
            <DialogDescription>该线路未开放附加 IP 调整。</DialogDescription>
          </DialogHeader>
          <EmptyState title="暂不支持新增附加IP" />
          <DialogFooter>
            <Button variant="outline" onClick={close}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open onOpenChange={(v) => !v && close()}>
      <DialogContent className="w-[min(92vw,420px)]">
        <DialogHeader>
          <DialogTitle>附加 IP</DialogTitle>
          <DialogDescription>
            当前共 {totalCount} 个 IPv4（含默认 1 个），其中附加 {attachedCount} 个；请选择所需的附加数量。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {hasIp4 ? (
            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <Label>附加 IPv4 数量</Label>
                <span className="text-[11px] text-muted-foreground">
                  当前 {attachedCount} 个附加 / 共 {totalCount} 个
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {tiers.ipValues.map((v) => (
                  <ChoiceButton
                    key={v}
                    type="button"
                    onClick={() => pickIpNum(v)}
                    selected={String(ipNum) === String(v)}
                  >
                    {v} 个{v === 1 ? '（免费）' : ''}
                  </ChoiceButton>
                ))}
              </div>
            </div>
          ) : null}
          {/* A3：指定 IP 降级（差值 > 0 时出现；可选 0 个=随机删除，或恰好选满差额） */}
          {hasIp4 && ip4DelNum > 0 ? (
            <div>
              <Label>指定降级的 IPv4（可留空由系统随机选择）</Label>
              <div className="mt-1 space-y-1.5">
                {ip4Options.map((addr) => {
                  const checked = ip4Del.includes(addr)
                  const limitReached = !checked && ip4Del.length >= ip4DelNum
                  return (
                    <label
                      key={addr}
                      data-selected={checked}
                      aria-disabled={limitReached}
                      className={cn('cui-choice flex items-center gap-2', limitReached && 'opacity-50 cursor-not-allowed')}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={limitReached}
                        onChange={(e) => {
                          setIp4Del((list) => (e.target.checked ? [...list, addr].slice(0, ip4DelNum) : list.filter((x) => x !== addr)))
                        }}
                      />
                      <span className="font-mono text-body">{addr}</span>
                    </label>
                  )
                })}
                <p className={cn('text-[11px]', ip4Del.length === 0 ? 'text-muted-foreground' : ip4Del.length === ip4DelNum ? 'text-success' : 'text-warning')}>
                  {ip4Del.length === 0
                    ? `未指定：将由系统随机删除 ${ip4DelNum} 个 IP`
                    : ip4Del.length === ip4DelNum
                      ? `已选满（${ip4DelNum} 个）`
                      : `还需选择 ${ip4DelNum - ip4Del.length} 个`}
                </p>
              </div>
            </div>
          ) : null}
          {hasIp6 ? (
            <div>
              <Label>附加 IPv6 数量（当前 {attachedIpv6}）</Label>
              <div className="flex flex-wrap gap-1.5">
                {tiers.ipv6Values.map((v) => (
                  <ChoiceButton
                    key={v}
                    type="button"
                    onClick={() => setIpv6Num(String(v))}
                    selected={String(ipv6Num) === String(v)}
                  >
                    {v} 个
                  </ChoiceButton>
                ))}
              </div>
            </div>
          ) : null}
          <div className="space-y-1 rounded-lg border border-line bg-surface-alt px-3 py-2 text-xs text-body">
            <p className={priceErr ? 'text-warning' : ''}>
              {Number(ipNum) === attachedCount
                ? '与当前数量相同'
                : priceErr
                  ? priceErr
                  : price
                    ? `${Number(price.price_difference ?? price.price ?? 0) < 0 ? '退款（降级不退）' : '补差价'}：${formatMoney(Math.abs(Number(price.price_difference ?? price.price ?? 0)))}${price.description ? ` · ${price.description}` : ''}`
                    : '询价中…'}
            </p>
            {price && price.renew_price_difference ? (
              <p className="text-ink">
                续费差价：<span className="font-semibold tabular-nums">{formatMoney(price.renew_price_difference)}</span>
              </p>
            ) : null}
          </div>
        </div>
        {isDowngrade ? <DowngradeNotice readSeconds={readSeconds} className="mt-1" /> : null}
        <DialogFooter>
          <Button variant="outline" onClick={close}>取消</Button>
          <DowngradeAwareSubmit onClick={go} disabled={busy || Number(ipNum) === attachedCount} locked={locked} readSeconds={readSeconds}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            提交调整
          </DowngradeAwareSubmit>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function VpcDialog({ api, close, cloud, host, onChanged }) {
  const toast = useToast()
  const [pick, setPick] = useState('')
  const [newName, setNewName] = useState('')
  const [newCidr, setNewCidr] = useState('')
  const [busy, setBusy] = useState(false)

  const { data, error: loadError, retry: load } = useDialogRead(async () => {
    const [current, available] = await Promise.all([api.vpcNetworkList(), api.usableVpcNetwork({ host_id: host.id })])
    return { list: current.data?.list || [], usable: available.data?.list || [] }
  }, [api, host.id])
  const list = data?.list ?? null
  const usable = data?.usable || []

  const join = async () => {
    if (!pick) return
    setBusy(true)
    try {
      await api.vpcNetworkChange({ vpc_network_id: Number(pick) })
      toast('已加入 VPC 网络', 'success')
      load()
      onChanged?.()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }
  const leave = async (v) => {
    setBusy(true)
    try {
      await api.vpcNetworkDelete(v.id)
      toast('已退出 VPC 网络', 'success')
      load()
      onChanged?.()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }
  const create = async () => {
    if (!newName.trim()) {
      toast('请填写 VPC 网络名称', 'warning')
      return
    }
    // C2：CIDR 格式与取值范围校验（对齐后端 vpc_cidr_limit）
    if (newCidr.trim()) {
      const m = newCidr.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/)
      const okIp = m && [1, 2, 3, 4].every((i) => Number(m[i]) >= 0 && Number(m[i]) <= 255)
      const prefix = m ? Number(m[5]) : -1
      if (!okIp || prefix < 8 || prefix > 30) {
        toast('IP 段格式不正确（示例 10.0.0.0/16，掩码 8~30）', 'warning')
        return
      }
    }
    setBusy(true)
    try {
      const body = { name: newName.trim() }
      if (newCidr.trim()) body.ips = newCidr.trim()
      await api.vpcNetworkCreate(body)
      toast('VPC 网络已创建', 'success')
      setNewName('')
      setNewCidr('')
      load()
      onChanged?.()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && close()}>
      <DialogContent className="w-[min(92vw,440px)]">
        <DialogHeader>
          <DialogTitle>VPC 网络</DialogTitle>
          <DialogDescription>VPC 内实例互通，切换网络会使实例短暂重启。</DialogDescription>
        </DialogHeader>
        {loadError ? <DialogReadError onRetry={load} /> : list === null ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <div className="space-y-3">
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">当前网络</p>
              {list.length ? (
                <div className="space-y-1.5">
                  {list.map((v) => (
                    <div key={v.id} className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm">
                      <span className="min-w-0">
                        <span className="text-ink">{v.name || v.network_name || `VPC #${v.id}`}</span>
                        {v.ips ? <span className="ml-2 font-mono text-xs text-muted-foreground">{v.ips}</span> : null}
                      </span>
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-danger" onClick={() => leave(v)}>
                        <Trash2 className="size-3.5" />
                        退出
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-line bg-surface-alt px-3 py-2 text-xs text-muted-foreground">未加入任何 VPC</p>
              )}
            </div>
            {usable.length ? (
              <div>
                <Label htmlFor="vpc-pick">加入其他网络</Label>
                <div className="flex gap-2">
                  <Select id="vpc-pick" value={pick} onChange={(e) => setPick(e.target.value)}>
                    <option value="">请选择</option>
                    {usable.map((v) => (
                      <option key={v.id} value={v.id}>{v.name || `VPC #${v.id}`}</option>
                    ))}
                  </Select>
                  <Button onClick={join} disabled={busy || !pick}>
                    {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                    加入
                  </Button>
                </div>
              </div>
            ) : null}
            {/* 新建 VPC（契约：name 必填；ips(cidr) 可选，不传由系统分配） */}
            <div className="border-t border-line/70 pt-3">
              <Label>新建 VPC 网络</Label>
              <div className="mt-1.5 space-y-2">
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="网络名称（必填）" aria-label="VPC 名称" />
                <Input value={newCidr} onChange={(e) => setNewCidr(e.target.value)} placeholder="IP 段（可选，如 10.0.0.0/16，留空系统分配）" aria-label="VPC IP 段" />
                <Button size="sm" variant="outline" onClick={create} disabled={busy} className="w-full">
                  {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                  创建 VPC 网络
                </Button>
              </div>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={close}>关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ---------------- NAT 转发/建站（契约：int_port 内部端口 / ext_port 外部端口 /
   protocol 数字(1=tcp,2=udp,3=两者) / domain 域名；删除用 nat_acl_id、nat_web_id） ---------------- */
const NAT_PROTOCOLS = [
  { value: 1, label: 'TCP' },
  { value: 2, label: 'UDP' },
  { value: 3, label: 'TCP+UDP' },
]

function NatDialog({ api, caps, close, onChanged }) {
  const toast = useToast()
  const [tab, setTab] = useState(caps.natAcl ? 'acl' : 'web')
  const [form, setForm] = useState({ name: '', protocol: 1, int_port: '', ext_port: '' })
  const [webForm, setWebForm] = useState({ domain: '', int_port: '' })
  const [busy, setBusy] = useState(false)

  const { data: list, error: loadError, retry: load } = useDialogRead(() =>
    (tab === 'acl' ? api.natAcl({ page: 1, limit: 50 }) : api.natWeb({ page: 1, limit: 50 }))
      .then(r => r.data?.list || []), [api, tab])

  const add = async () => {
    setBusy(true)
    try {
      if (tab === 'acl') {
        if (!form.name || !form.int_port) {
          toast('请填写名称与内部端口', 'warning')
          setBusy(false)
          return
        }
        // C3：端口范围校验（1-65535；外部端口留空由系统分配）
        const pIn = Number(form.int_port)
        if (!Number.isInteger(pIn) || pIn < 1 || pIn > 65535) {
          toast('内部端口需为 1~65535 的整数', 'warning')
          setBusy(false)
          return
        }
        if (form.ext_port !== '') {
          const pEx = Number(form.ext_port)
          if (!Number.isInteger(pEx) || pEx < 1 || pEx > 65535) {
            toast('外部端口需为 1~65535 的整数（可留空自动分配）', 'warning')
            setBusy(false)
            return
          }
        }
        const body = { name: form.name, protocol: Number(form.protocol), int_port: Number(form.int_port) }
        if (form.ext_port !== '') body.ext_port = Number(form.ext_port)
        await api.addNatAcl(body)
      } else {
        if (!webForm.domain || !webForm.int_port) {
          toast('请填写域名与内部端口', 'warning')
          setBusy(false)
          return
        }
        const pIn = Number(webForm.int_port)
        if (!Number.isInteger(pIn) || pIn < 1 || pIn > 65535) {
          toast('内部端口需为 1~65535 的整数', 'warning')
          setBusy(false)
          return
        }
        await api.addNatWeb({ domain: webForm.domain, int_port: pIn })
      }
      toast('规则已添加', 'success')
      if (tab === 'acl') setForm({ name: '', protocol: 1, int_port: '', ext_port: '' })
      else setWebForm({ domain: '', int_port: '' })
      load()
      onChanged?.()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }
  const [confirmItem, setConfirmItem] = useState(null)

  const remove = async (item) => {
    try {
      if (tab === 'acl') await api.delNatAcl({ nat_acl_id: item.id })
      else await api.delNatWeb({ nat_web_id: item.id })
      toast('已删除', 'success')
      setConfirmItem(null)
      load()
      onChanged?.()
    } catch (e) {
      toast(e.message, 'error')
      setConfirmItem(null)
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && close()}>
      <DialogContent className="w-[min(94vw,520px)]">
        <DialogHeader>
          <DialogTitle>NAT {tab === 'acl' ? '转发' : '建站'}</DialogTitle>
          <DialogDescription>
            {tab === 'acl' ? '将实例端口映射到公网共享 IP 的指定端口。' : '通过共享 IP 的端口对外提供 Web 服务（仅需域名与内部端口）。'}
          </DialogDescription>
        </DialogHeader>
        {caps.natAcl && caps.natWeb ? (
          <div className="cui-tabs flex w-full">
            {[['acl', '端口转发'], ['web', 'Web 建站']].map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                aria-pressed={tab === k} className="cui-tabs__trigger flex-1"
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}

        {tab === 'acl' ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="nat-name">名称</Label>
                <Input id="nat-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="nat-proto">协议</Label>
                <Select id="nat-proto" value={String(form.protocol)} onChange={(e) => setForm((f) => ({ ...f, protocol: Number(e.target.value) }))}>
                  {NAT_PROTOCOLS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                </Select>
              </div>
              <div>
                <Label htmlFor="nat-int">内部端口 *</Label>
                <Input id="nat-int" type="number" min={1} max={65535} value={form.int_port} onChange={(e) => setForm((f) => ({ ...f, int_port: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="nat-ext">外部端口（留空自动分配）</Label>
                <Input id="nat-ext" type="number" min={1} max={65535} value={form.ext_port} onChange={(e) => setForm((f) => ({ ...f, ext_port: e.target.value }))} />
              </div>
            </div>
            <Button size="sm" onClick={add} disabled={busy || list === null || Boolean(loadError)} className="w-full">
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              添加转发规则
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="natw-domain">域名 *</Label>
                <Input id="natw-domain" value={webForm.domain} onChange={(e) => setWebForm((f) => ({ ...f, domain: e.target.value }))} placeholder="例如 web.example.com" />
              </div>
              <div>
                <Label htmlFor="natw-int">内部端口 *</Label>
                <Input id="natw-int" type="number" min={1} max={65535} value={webForm.int_port} onChange={(e) => setWebForm((f) => ({ ...f, int_port: e.target.value }))} />
              </div>
            </div>
            <Button size="sm" onClick={add} disabled={busy || list === null || Boolean(loadError)} className="w-full">
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              添加建站规则
            </Button>
          </div>
        )}

        {loadError ? <DialogReadError onRetry={load} /> : list === null ? (
          <Skeleton className="h-20 w-full" />
        ) : list.length ? (
          <div className="max-h-40 overflow-y-auto rounded-lg border border-line">
            <table className="w-full text-xs">
              <tbody>
                {list.map((n) => (
                  <tr key={n.id} className="border-b border-line/60 last:border-0">
                    <td className="px-2.5 py-1.5 text-ink">{n.name || n.domain || '--'}</td>
                    <td className="px-2.5 py-1.5 font-mono text-body">
                      {n.ext_port ? `${n.ext_port} → ` : ''}{n.int_port}
                      {n.protocol ? ` · ${typeof n.protocol === 'number' ? (NAT_PROTOCOLS.find((x) => x.value === n.protocol)?.label || n.protocol) : n.protocol}` : ''}
                    </td>
                    <td className="px-2.5 py-1.5 text-right">
                      <button type="button" className="text-xs text-danger" onClick={() => setConfirmItem(n)}>删除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-2 text-center text-xs text-muted-foreground">暂无规则</p>
        )}
      </DialogContent>
      {/* C3：删除二次确认 */}
      {confirmItem ? (
        <ConfirmDialog
          open
          title="删除规则"
          description={`确认删除「${confirmItem.name || confirmItem.domain || `#${confirmItem.id}`}」？该操作不可恢复。`}
          confirmText="删除"
          tone="danger"
          onConfirm={() => remove(confirmItem)}
          onCancel={() => setConfirmItem(null)}
        />
      ) : null}
    </Dialog>
  )
}

/* ---------------- IP 防御 ---------------- */
function DefenceDialog({ api, ips, close, onOpenPay, onOpDone }) {
  const toast = useToast()
  const ipList = [...new Set((ips?.list || []).map(x => x.ip).filter(Boolean))]
  const [ip, setIp] = useState(() => ipList[0] || '')
  const [config, setConfig] = useState(null)
  const [configAttempt, setConfigAttempt] = useState(0)
  const [sel, setSel] = useState('')
  const [pricing, setPricing] = useState(null)
  const [priceAttempt, setPriceAttempt] = useState(0)
  const [busy, setBusy] = useState(false)
  const submitLock = useRef(false)
  const ipKey = JSON.stringify(ipList)

  useEffect(() => {
    if (!ipList.includes(ip)) { setIp(ipList[0] || ''); setSel(''); setConfig(null); setPricing(null) }
  }, [ipKey, ip]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let active = true
    setConfig({ ip, state: 'loading' })
    if (!ip) return
    Promise.resolve().then(() => api.defenceConfig({ ip })).then(r => {
      if (!Array.isArray(r.data?.defence) || !validQuoteAmount(r.data?.current_defence)) throw Error('invalid defence config')
      if (active) setConfig({ ip, state: 'ready', options: r.data.defence, current: r.data.current_defence })
    }).catch(() => { if (active) setConfig({ ip, state: 'error' }) })
    return () => { active = false }
  }, [api, ip, configAttempt])

  const ready = config?.ip === ip && config.state === 'ready'
  const current = ready ? config.current : ''
  const defence = ready ? config.options : []
  const selectableDefence = defence.filter(d => validQuoteAmount(d.value) && String(d.value) !== String(current))
  const validSelection = ready && sel !== '' && selectableDefence.some(d => String(d.value) === sel)
  const selectionKey = JSON.stringify([ip, sel])
  const quote = validSelection && pricing?.key === selectionKey && pricing.state === 'ready' ? pricing.value : null

  useEffect(() => {
    let active = true
    setPricing(null)
    if (!validSelection) return
    setPricing({ key: selectionKey, state: 'loading' })
    Promise.resolve().then(() => api.defencePrice({ ip, peak_defence: sel })).then(r => {
      if (!validQuoteAmount(r.data?.price) || (r.data?.price_difference != null && !Number.isFinite(Number(r.data.price_difference)))) throw Error('invalid quote')
      if (active) setPricing({ key: selectionKey, state: 'ready', value: r.data })
    }).catch(() => { if (active) setPricing({ key: selectionKey, state: 'error' }) })
    return () => { active = false }
  }, [api, ip, sel, validSelection, selectionKey, priceAttempt])

  const pickIp = value => {
    if (submitLock.current) return
    setIp(value); setSel(''); setConfig(null); setPricing(null)
  }
  const pickDefence = value => {
    if (submitLock.current) return
    setSel(value); setPricing(null)
  }
  const { isDowngrade, readSeconds, locked } = useDowngradeGate(quote, validSelection && Number(sel) < Number(current), selectionKey)
  const go = async () => {
    if (submitLock.current || !validSelection || !quote || locked) return
    submitLock.current = true; setBusy(true)
    try {
      const r = await api.defenceOrder({ ip, peak_defence: sel })
      const orderId = r.data?.id || r.data?.order_id
      if (orderId && !isPaymentPaid(r)) await onOpenPay?.(orderId)
      else { onOpDone?.(); toast('操作已提交', 'success') }
      close()
    } catch (e) { toast(e.message, e.needOpPass ? 'warning' : 'error') }
    finally { submitLock.current = false; setBusy(false) }
  }

  return (
    <Dialog open onOpenChange={v => !v && !submitLock.current && close()}>
      <DialogContent className="w-[min(92vw,420px)]">
        <DialogHeader>
          <DialogTitle>IP 防御调整</DialogTitle>
          <DialogDescription>选择 IP 与目标防御峰值，差价按比例结算。{ready ? `当前防御 ${current}G。` : ''}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="df-ip">选择 IP</Label>
            <Select id="df-ip" value={ip} disabled={busy} onChange={e => pickIp(e.target.value)}>
              {ipList.length === 0 ? <option value="">暂无 IP</option> : null}
              {ipList.map(x => <option key={x} value={x}>{x}</option>)}
            </Select>
          </div>
          {ip && config?.ip === ip && config.state === 'error' ? <DialogReadError onRetry={() => setConfigAttempt(n => n + 1)} />
            : ip && !ready ? <p role="status" className="text-xs text-muted">正在读取可选防御档位…</p>
            : ready ? <div>
              <Label htmlFor="df-val">目标防御（当前 {current}G，不可重复选择）</Label>
              {selectableDefence.length ? <Select id="df-val" value={sel} disabled={busy} onChange={e => pickDefence(e.target.value)}>
                <option value="">请选择</option>
                {selectableDefence.map(d => <option key={d.value} value={d.value}>
                  {d.desc || `${d.value}G`}{Number(d.value) > Number(current) ? '（升级）' : '（降级不退款）'}
                </option>)}
              </Select> : <p className="rounded-lg border border-line bg-surface-alt px-3 py-2 text-xs text-muted-foreground">暂无可调整的防御档位</p>}
            </div> : null}
          {validSelection && pricing?.key === selectionKey && pricing.state === 'error' ? <Alert tone="error">
            暂时无法获取价格，请重新询价。
            <Button size="sm" variant="outline" className="ml-2" onClick={() => setPriceAttempt(n => n + 1)}>重新询价</Button>
          </Alert> : quote ? <p className="rounded-lg border border-line bg-surface-alt px-3 py-2 text-xs text-body">
            {quote.description || ''} 价格 {formatMoney(quote.price)}{quote.price_difference != null ? ` · 差价 ${formatMoney(quote.price_difference)}` : ''}
          </p> : validSelection ? <p role="status" className="text-xs text-muted">正在获取当前档位价格…</p> : null}
          {isDowngrade ? <DowngradeNotice readSeconds={readSeconds} /> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={busy}>取消</Button>
          <DowngradeAwareSubmit onClick={go} disabled={busy || !validSelection || !quote} locked={locked} readSeconds={readSeconds}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            提交调整
          </DowngradeAwareSubmit>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ---------------- 计费模式转换（按需 ↔ 包年包月） ---------------- */
function BillingConvertDialog({ api, cloud, host, caps, close, onOpenPay, reloadHost }) {
  const toast = useToast()
  /* 方向与开关一律来自 host（product_on_demand 在 host detail；cloud.product_on_demand 恒不存在）；
     原版判据：isDemandFee = hostData.billing_cycle === 'on_demand'（cloudDetail.js:3173） */
  const onDemand = host?.billing_cycle === 'on_demand'
  /* 已提交的转按需申请（原版 template:376-379：(到期后转按需) + 取消转换） */
  const changeCycleId = Number(host?.change_billing_cycle_id || 0)
  /* 方向可用性（原版 template:368-384 门控）：
     按需→包月：product_on_demand.on_demand_to_duration=1（后端 HostModel.php:5511 硬校验）
     包月→按需：product_on_demand.duration_to_on_demand=1（后端 HostModel.php:5731 硬校验） */
  const allowToDuration = Number(host?.product_on_demand?.on_demand_to_duration || 0) === 1
  const allowToOnDemand = Number(host?.product_on_demand?.duration_to_on_demand || 0) === 1
  const [durations, setDurations] = useState(null)  // 按需转包年包月的周期列表
  const [durationId, setDurationId] = useState('')
  const [price, setPrice] = useState(null)
  const [priceErr, setPriceErr] = useState('')
  const [busy, setBusy] = useState(false)

  /* 契约（对齐原版 renewDialog.js:376-378）：
     按需转包年包月：GET 返回 duration[]{id,price,name_show} 需选择周期，POST 必传 duration_id；
     包年包月转按需：GET 返回价格，POST 无需周期。 */
  useEffect(() => {
    if (onDemand) {
      api.demandToPrepaymentPrice()
        .then((r) => {
          const list = r.data?.duration || []
          setDurations(list)
          if (list.length) setDurationId(String(list[0].id))
        })
        .catch((e) => { setDurations([]); setPriceErr(e.message) })
    } else {
      api.durationToDemandPrice().then((r) => setPrice(r.data)).catch((e) => setPriceErr(e.message))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const selDuration = (durations || []).find((d) => String(d.id) === durationId)
  const amount = onDemand ? (selDuration?.price ?? null) : (price ? (price.on_demand_price ?? price.price ?? price.amount) : null)
  /* 取消转换（对齐原版 cancelTransferDemand:2189 / submitCancelTransfer:2196）：仅包年包月侧可用 */
  const [cancelBusy, setCancelBusy] = useState(false)
  const cancelConvert = async () => {
    setCancelBusy(true)
    try {
      await api.cancelDurationToDemand()
      toast('已取消转按需', 'success')
      reloadHost?.()
      close()
    } catch (e) {
      toast(e.message, e.needOpPass ? 'warning' : 'error')
    } finally {
      setCancelBusy(false)
    }
  }

  const go = async () => {
    if (onDemand && !durationId) {
      toast('请选择转换周期', 'warning')
      return
    }
    setBusy(true)
    try {
      const r = onDemand
        ? await api.demandToPrepayment({ duration_id: Number(durationId) })
        : await api.durationToDemand({})
      const orderId = r.data?.id || r.data?.order_id
      close()
      if (orderId && !isPaymentPaid(r)) onOpenPay?.(orderId)
      else { reloadHost?.(); toast('转换申请已提交', 'success') }
    } catch (e) {
      toast(e.message, e.needOpPass ? 'warning' : 'error')
    } finally {
      setBusy(false)
    }
  }

  /* 方向不允许 / 询价失败 → 只读提示（对齐原版：按钮不存在即不可操作） */
  const notAllowed = onDemand ? !allowToDuration : !allowToOnDemand

  return (
    <Dialog open onOpenChange={(v) => !v && close()}>
      <DialogContent className="w-[min(92vw,420px)]">
        <DialogHeader>
          <DialogTitle>{onDemand ? '按需转包年包月' : '包年包月转按需'}</DialogTitle>
          <DialogDescription>
            {onDemand ? '转为包年包月后按周期计费，避免按需费用波动；请选择目标周期。' : '转为按需后按实际用量计费。'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {notAllowed ? (
            <Alert tone="warning" className="text-xs">
              该商品未开启{onDemand ? '「按需转包年包月」' : '「包年包月转按需」'}，暂不可执行此操作。
            </Alert>
          ) : onDemand ? (
            durations === null ? (
              <Skeleton className="h-24 w-full" />
            ) : durations.length === 0 ? (
              <EmptyState title="暂无可选周期" description={priceErr || '该商品未配置可转换的周期。'} />
            ) : (
              <div>
                <Label>转换周期</Label>
                <div className="flex flex-wrap gap-1.5">
                  {durations.map((d) => (
                    <ChoiceButton
                      key={d.id}
                      type="button"
                      onClick={() => setDurationId(String(d.id))}
                      selected={String(durationId) === String(d.id)}
                    >
                      {d.name_show || d.name || `周期 #${d.id}`}
                      {d.price != null ? `（${formatMoney(d.price)}）` : ''}
                    </ChoiceButton>
                  ))}
                </div>
              </div>
            )
          ) : priceErr ? (
            <Alert tone="warning" className="text-xs">{priceErr}</Alert>
          ) : null}
          {!notAllowed && !priceErr ? (
            <p className={cn('rounded-lg border px-3 py-2 text-xs', 'border-line bg-surface-alt text-body')}>
              {amount != null
                ? (onDemand ? `预估金额：${formatMoney(amount)}` : `转按需后单价：${formatMoney(amount)}/小时`)
                : (durations === null && onDemand ? '询价中…' : '选择周期后显示金额')}
            </p>
          ) : null}
          {/* 转换申请中：提供取消入口（原版 template:376-379） */}
          {!onDemand && changeCycleId ? (
            <Alert tone="info" className="text-xs">
              该实例已提交转按需申请（到期后转按需），可在此取消。
            </Alert>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close}>关闭</Button>
          {/* 已申请转换：仅提供取消（原版 template:376-379，取消与商品开关无关） */}
          {!onDemand && changeCycleId ? (
            <Button variant="danger" onClick={cancelConvert} disabled={cancelBusy}>
              {cancelBusy ? <Loader2 className="size-4 animate-spin" /> : null}
              取消转按需
            </Button>
          ) : !notAllowed ? (
            <Button onClick={go} disabled={busy || !amount}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              确认转换
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ---------------- 自动释放时间（按需实例专属，原版 handleReleaseTime:2255） ---------------- */
/* 契约：PUT /host/:id/auto_release_time {auto_release_time: 秒级时间戳}；
   显示条件：按需计费 + product_on_demand.client_auto_delete（原版 template:391-400） */
function AutoReleaseDialog({ api, host, close, reloadHost }) {
  const toast = useToast()
  const cur = Number(host?.auto_release_time || 0)
  const [dt, setDt] = useState(() => releaseLocalValue(cur))
  const [confirmAt, setConfirmAt] = useState(null)
  const [busy, setBusy] = useState(false)
  const submitLock = useRef(false)

  const future = timestamp => Number.isFinite(timestamp) && timestamp > Math.floor(Date.now() / 1000)
  const prepare = () => {
    const timestamp = releaseTimestamp(dt, cur)
    if (!dt || !future(timestamp)) { toast('自动释放时间需晚于当前时间', 'warning'); return }
    setConfirmAt(timestamp)
  }
  const submit = async timestamp => {
    if (submitLock.current) return
    if (timestamp !== 0 && (!confirmAt || timestamp !== confirmAt || !future(timestamp))) {
      setConfirmAt(null); toast('自动释放时间需晚于当前时间，请重新选择', 'warning'); return
    }
    submitLock.current = true; setBusy(true)
    try {
      await api.autoRelease({ auto_release_time: timestamp })
      toast(timestamp === 0 ? '已取消自动释放' : '自动释放时间已设置', 'success')
      reloadHost?.(); close()
    } catch (e) { toast(e.message, e.needOpPass ? 'warning' : 'error') }
    finally { submitLock.current = false; setBusy(false) }
  }

  return (
    <Dialog open onOpenChange={v => !v && !submitLock.current && close()}>
      <DialogContent className="w-[min(92vw,440px)]">
        <DialogHeader>
          <DialogTitle>{confirmAt ? '确认自动释放' : '自动释放时间'}</DialogTitle>
          <DialogDescription>
            到达指定时间，实例将被自动删除。即使余额充足、正常付费使用，也会执行；数据不可恢复。
          </DialogDescription>
        </DialogHeader>
        {confirmAt ? <div className="space-y-3">
          <dl className="space-y-2 text-xs text-body">
            <div><dt className="text-muted">实例</dt><dd className="mt-1 break-all font-medium">{host.name || `#${host.id}`}</dd></div>
            <div><dt className="text-muted">自动释放时间（浏览器本地时区）</dt><dd className="mt-1 break-words font-medium">{releaseTimeText(confirmAt)}</dd></div>
          </dl>
          <Alert tone="warning">请提前备份所需数据。确认后会按上述时间删除实例，请确认时间和实例无误。</Alert>
        </div> : <div className="space-y-3">
          <p className="text-xs leading-5 text-body break-words">{cur ? `当前设置：${releaseTimeText(cur)}` : '当前未设置自动释放。'}</p>
          <div>
            <Label htmlFor="ar-time">释放时间（浏览器本地时区）</Label>
            <DateTimePicker id="ar-time" value={dt} disabled={busy} onChange={e => setDt(e.target.value)} />
          </div>
        </div>}
        <DialogFooter>
          {confirmAt ? <>
            <Button variant="outline" onClick={() => setConfirmAt(null)} disabled={busy}>返回修改</Button>
            <Button variant="danger" onClick={() => submit(confirmAt)} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}确认设置自动释放
            </Button>
          </> : <>
            {cur ? <Button variant="danger" onClick={() => submit(0)} disabled={busy}>取消自动释放</Button> : null}
            <Button variant="outline" onClick={close} disabled={busy}>关闭</Button>
            <Button onClick={prepare} disabled={busy || !dt}>保存</Button>
          </>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


function SimulateDialog({ api, remote, close, onOpDone }) {
  const toast = useToast()
  const on = Number(remote?.simulate_physical_machine || 0) === 1
  const [busy, setBusy] = useState(false)

  const go = async () => {
    setBusy(true)
    try {
      await api.simulatePhysicalMachine({ simulate_physical_machine: on ? 0 : 1 })
      toast(on ? '已关闭模拟物理机' : '已开启模拟物理机', 'success')
      onOpDone?.()
      close()
    } catch (e) {
      toast(e.message, e.needOpPass ? 'warning' : 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ConfirmDialog
      open
      title={on ? '关闭模拟物理机' : '开启模拟物理机'}
      description={on ? '关闭后实例恢复为普通虚拟机形态。' : '开启后实例将隐藏虚拟化特征，表现为独立物理机。'}
      confirmText="确认"
      busy={busy}
      onConfirm={go}
      onCancel={close}
    />
  )
}

/* ---------------- 退订 / 停用（通用 /refund 能力） ---------------- */
function UnsubscribeDialog({ api, host, caps, close, refreshStatus }) {
  const toast = useToast()
  const [msg, setMsg] = useState(null)      // 已申请的停用单（Suspending/Reject）
  const [attempt,retry]=useState(0)
  const [page, setPage] = useState(null)    // 退订页配置
  const [type, setType] = useState(host?.billing_cycle === 'on_demand' ? 'Immediate' : 'Expire')
  const [refundMethod,setRefundMethod] = useState('credit')
  const [ack,setAck] = useState(false)
  const refundView = refundState(host, page || {}, refundMethod)
  const submitting = useRef(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive=true
    setPage(null)
    Promise.all([api.refundMsg(),api.refundPage({host_id:host.id})]).then(([m,p])=>{
      if(!alive)return
      setMsg(m.data?.refund || null);setPage(p.data);setRefundMethod(p.data?.refund_method_default || 'credit')
    }).catch(e=>{if(alive){setPage({error:e.message});toast(e.message,'error')}})
    return ()=>{alive=false}
  }, [host.id,attempt])

  const apply = async () => {
    if (submitting.current || !page || page.error) return
    if ((type === 'Immediate' || refundView.immediate) && !ack) { toast('请先确认立即停用的影响', 'error'); return }
    if (!reason) {
      toast('请选择停用原因', 'error')
      return
    }
    setBusy(true)
    try {
      submitting.current = true
      const body = { host_id: host.id, type: refundView.immediate ? 'Immediate' : type }
      body.suspend_reason = Number(page.reason_custom) === 0 ? [Number(reason)] : reason
      if (Number(page.show_refund_method) === 1) body.refund_method = refundMethod
      await api.refundApply(body)
      toast(refundView.immediate ? '实例已停用' : '停用申请已提交', 'success')
      window.dispatchEvent(new Event('cra1:finance-updated'))
      refreshStatus?.()
      close()
    } catch (e) {
      toast(e.message, e.needOpPass ? 'warning' : 'error')
    } finally {
      setBusy(false)
      submitting.current = false
    }
  }

  const cancelApply = async () => {
    if (submitting.current || !msg || !['Pending','Suspending'].includes(msg.status)) return
    submitting.current = true
    setBusy(true)
    try {
      await api.refundCancel(msg.id)
      toast('已取消停用申请', 'success')
      setMsg(null)
      refreshStatus?.()
    } catch (e) {
      toast(e.message, e.needOpPass ? 'warning' : 'error')
    } finally {
      setBusy(false)
      submitting.current = false
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && !busy && close()}>
      <DialogContent className="w-[min(92vw,420px)]">
        <DialogHeader>
          <DialogTitle>退订 / 停用</DialogTitle>
          <DialogDescription>{refundView.immediate ? '确认后将立即停用实例，无法继续使用，请谨慎操作。' : '停用时间和退款金额按当前产品规则处理。'}</DialogDescription>
        </DialogHeader>

        {msg && ['Pending', 'Suspending', 'Suspend', 'Suspended'].includes(msg.status) ? (
          <div className="space-y-3">
            <Alert tone="warning" className="text-xs">
              已于 {formatDate(msg.create_time)} 提交停用申请（{msg.type === 'Expire' ? '到期停用' : '立即停用'}），当前状态：{({Pending:'待处理',Suspending:'停用处理中',Suspend:'已停用',Suspended:'已停用'})[msg.status]}。
            </Alert>
            <DialogFooter>
              <Button variant="outline" onClick={close}>关闭</Button>
              {['Pending','Suspending'].includes(msg.status) && <Button variant="danger" onClick={cancelApply} disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                取消退订
              </Button>}
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            {msg && msg.status === 'Reject' ? (
              <Alert tone="info" className="text-xs">
                上次申请被拒绝{msg.reject_reason ? `：${msg.reject_reason}` : ''}，可重新提交。
              </Alert>
            ) : null}
            {page === null ? (
              <Skeleton className="h-24 w-full" />
            ) : page.error ? (
              <Alert tone="error">页面错误，请刷新重试</Alert>
            ) : caps?.unsubscribe === false || ![0, 1].includes(Number(page.allow_refund)) ? (
              <EmptyState title="该产品不支持自助退订" description="请联系客服处理。" />
            ) : (
              <>
                {Number(page.allow_refund) === 0 ? (
                  <Alert tone="info" className="text-xs">该实例支持停用，不提供退款。</Alert>
                ) : null}
                <div>
                  <Label>停用方式</Label>
                  <div className="flex gap-2">
                    {refundView.types.map(k => [k, k === 'Expire' ? '到期停用' : '立即停用']).map(([k, label]) => (
                      <ChoiceButton
                        key={k}
                        type="button"
                        onClick={() => setType(k)}
                        selected={type === k} className="flex-1"
                      >
                        {label}
                      </ChoiceButton>
                    ))}
                  </div>
                </div>
                <div>
                  <Label htmlFor="un-reason">停用原因</Label>
                  {Number(page.reason_custom) === 0 ? (
                    <Select id="un-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
                      <option value="">请选择原因</option>
                      {(page.reasons || []).map((r) => (
                        <option key={r.id} value={r.id}>{r.content || r.name || r.reason}</option>
                      ))}
                    </Select>
                  ) : (
                    <Input id="un-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="填写停用原因" />
                  )}
                </div>
                {Number(page.allow_refund) === 1 && type==='Immediate' && !refundView.immediate && <div className="rounded-lg border border-line p-3 text-sm space-y-2">
                  {Number(page.show_refund_method) === 1 && <Field label="退款方式" htmlFor="refund-method"><Select id="refund-method" value={refundMethod} disabled={busy} onChange={e=>setRefundMethod(e.target.value)}>{(page.refund_method_options || []).map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</Select></Field>}
                  <p>退款基数：{formatMoney(refundView.base)}</p><p>手续费：{formatMoney(refundView.fee)}</p><p>预计退还：{formatMoney(refundView.amount)}</p>
                </div>}
                {type==='Expire' && <p className="text-xs text-muted-foreground">到期停用不产生退款。</p>}
                {(type === 'Immediate' || refundView.immediate) && <label className="flex items-start gap-2 text-sm"><input className="cui-checkbox mt-1" type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)} disabled={busy}/>我已确认立即停用，实例将无法继续使用</label>}
                <DialogFooter>
                  <Button variant="outline" disabled={busy} onClick={close}>取消</Button>
                  <Button variant="danger" onClick={apply} disabled={busy || ((type === 'Immediate' || refundView.immediate) && !ack)}>
                    {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                    提交申请
                  </Button>
                </DialogFooter>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
