import {Guard,useAccess} from '../ui/access'
import {usePaymentReturn} from '../ui/use-payment-return'
import { lazy, Suspense, useEffect, useId, useMemo, useRef, useState } from 'react'
import { ArrowUpDown, CalendarPlus, ExternalLink, KeyRound, Loader2, Monitor, MoreHorizontal, Power, PowerOff, RefreshCw, RotateCw, ShieldCheck } from 'lucide-react'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu'
import { useToast } from '../ui/toast'
import { quickActionOptions, quickDialogCapabilities } from '../lib/product-operations'
import { autoRenewReason, configurationReason, createActionLoader, renewalReason, upgradeMatches, RENEW_ACTION, SECURITY_ACTION, UPGRADE_ACTION, VNC_ACTION } from '../lib/product-action-state'
import { productActionRequest } from '../lib/product-action-client'
import { createServerApi } from './serverPanel/api'
import { AutoRenewButton, useAutoRenewControl } from './serverPanel/auto-renew-control'
import CopyLoginMenuItem from './product-login-copy'

const ActionDialogs = lazy(() => import('./serverPanel/dialogs').then(module => ({ default: module.ServerPanelDialogs })))
const PaymentDialog = lazy(() => import('./serverPanel/dialogs').then(module => ({ default: module.PayDialog })))
const ICONS = { reboot: RotateCw, reinstall: RefreshCw, powerOn: Power, powerOff: PowerOff, resetPass: KeyRound }
const MENU_GROUPS = [['powerOn', 'powerOff', 'reboot'], ['resetPass', 'reinstall']]

function CheckDialog({ action, error, retry, close, url }) {
  return <Dialog open onOpenChange={value => { if (!value) close() }}>
    <DialogContent className="cra1-product-action-dialog w-[min(92vw,420px)]" onCloseAutoFocus={event => event.preventDefault()}>
      <DialogHeader><DialogTitle>{action.title}</DialogTitle><DialogDescription>{action.name}</DialogDescription></DialogHeader>
      {error ? <p className="cra1-product-action-dialog__error" role="alert">{error}</p>
        : url ? <p>控制台已准备就绪，请点击下方按钮打开。</p>
          : <p className="cra1-product-action-dialog__loading" role="status"><Loader2 className="animate-spin" aria-hidden="true" />正在检查是否可以{action.title}…</p>}
      <DialogFooter><Button variant="outline" onClick={close}>取消</Button>
        {error && <Button onClick={retry}>重新检查</Button>}
        {url && <a className="cui-button cui-button--primary" href={url} target="_blank" rel="noopener noreferrer" onClick={close}>打开控制台<ExternalLink aria-hidden="true" /></a>}
      </DialogFooter>
    </DialogContent>
  </Dialog>
}

export default function ProductQuickActions({ host, onChanged }) {
  const {can}=useAccess()
  const toast = useToast(), changed = useRef(onChanged), mounted = useRef(false)
  changed.current = onChanged
  const [open, setOpen] = useState(false), [selected, setSelected] = useState(null)
  const [context, setContext] = useState(null), [error, setError] = useState(''), [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false), [operation, setOperation] = useState(null), [payment, setPayment] = useState(null), [vncUrl, setVncUrl] = useState('')
  const [securityBusy, setSecurityBusy] = useState(false), [securityError, setSecurityError] = useState('')
  const autoErrorId = useId()
  const locked = useRef(false), generation = useRef(0), trigger = useRef(null), returnFocus = useRef(null), popup = useRef(null)
  const supported = ['mf_cloud', 'mf_dcim'].includes(host.module)
  const api = useMemo(() => createServerApi(host.module, host.id, undefined, productActionRequest), [host.module, host.id])
  const reads = useMemo(() => {
    const controller = new AbortController()
    return { controller, loader: createActionLoader({ host, read: path => productActionRequest(path, { signal: controller.signal }) }) }
  }, [host.id, host.module, host.product_id, host.status, host.billing_cycle, host.renew_forbidden])
  const loader = reads.loader
  const autoReason = autoRenewReason(host)
  const auto = useAutoRenewControl({ api, active: open && can('action:billing') && !!window.__CRA1_RUNTIME__?.features?.renew, disabledReason: autoReason, onConfirmed: enabled => changed.current?.({ id: host.id, host: { is_auto_renew: enabled ? 1 : 0 } }) })
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; generation.current++; reads.controller.abort(); if (popup.current && !popup.current.closed) popup.current.close() }
  }, [reads])

  const close = () => {
    generation.current++; setSelected(null); setContext(null); setError(''); setReady(false); setVncUrl('')
    if (popup.current && !popup.current.closed) popup.current.close()
    popup.current = null
    window.setTimeout(() => returnFocus.current?.focus(), 0)
  }
  const refreshHost = async () => {
    loader.invalidate()
    try {
      const response = await productActionRequest(`/host/${host.id}`)
      if (mounted.current) changed.current?.({ id: host.id, host: response.data?.host })
    } catch { if (mounted.current) toast('操作已提交，产品信息暂未更新，可稍后重新查看', 'warning') }
  }

  // Only the operated instance is observed. Opening/closing menus never polls.
  useEffect(() => {
    if (!operation) return
    const controller = new AbortController(), { signal } = controller
    let timer, failures = 0, sawWorking = false, stable = 0
    const check = async () => {
      if (signal.aborted) return
      const age = Date.now() - operation.sentAt
      if (age > (['reinstall', 'upgrade'].includes(operation.type) ? 600000 : 120000)) {
        setOperation(null); loader.invalidate(); toast('操作结果尚未确认，请进入控制面板查看后再操作', 'warning'); return
      }
      if (!document.hidden) {
        try {
          if (operation.type === 'upgrade') {
            const detail = await productActionRequest(`/${host.module}/${host.id}`, { signal })
            if (signal.aborted) return
            changed.current?.({ id: host.id, detail: detail.data }); failures = 0
            stable = upgradeMatches(detail.data, operation) ? stable + 1 : 0
            if (stable >= 2) { loader.invalidate(); setOperation(null); refreshHost(); return }
            timer = window.setTimeout(check, age < 15000 ? 3000 : 8000); return
          }
          const response = await productActionRequest(`/${host.module}/${host.id}/status`, { signal })
          const power = response.data
          if (!power?.status) throw new Error('状态暂不可用')
          if (signal.aborted) return
          changed.current?.({ id: host.id, power }); failures = 0
          if (['operating', 'pending'].includes(power.status)) sawWorking = true
          const boot = operation.type === 'reinstall' || operation.action === 'reboot'
          const expected = operation.action === 'powerOff' ? 'off' : operation.action === 'powerOn' || boot ? 'on' : null
          stable = (expected ? power.status === expected : ['on', 'off'].includes(power.status)) ? stable + 1 : 0
          if (stable >= 2 && (!boot || sawWorking || age >= 10000)) {
            if (operation.type === 'reinstall') {
              const detail = await productActionRequest(`/${host.module}/${host.id}`, { signal })
              if (!signal.aborted) changed.current?.({ id: host.id, detail: detail.data, power })
            }
            if (!signal.aborted) { loader.invalidate(); setOperation(null) }
            return
          }
        } catch {
          if (signal.aborted) return
          if (++failures >= 3) { loader.invalidate(); setOperation(null); toast('暂时无法确认操作结果，请进入控制面板查看', 'warning'); return }
        }
      }
      timer = window.setTimeout(check, age < 15000 ? 3000 : 8000)
    }
    check()
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [operation, host.id, host.module, loader, toast])

  const track = (type, details = {}) => {
    loader.invalidate()
    if (type === 'renew') { refreshHost(); return }
    if (type === 'upgrade') { refreshHost(); setOperation({ ...details, type, sentAt: Date.now() }); return }
    changed.current?.({ id: host.id, power: { status: 'operating' } })
    setOperation({ type, action: details.action, sentAt: Date.now() })
  }
  usePaymentReturn(host.id, track)
  const begin = async (action, button, force = false) => {
    if (busy || operation) return
    if (button) returnFocus.current = button
    if (force) loader.invalidate()
    const ticket = ++generation.current
    let connectionWindow = null
    setOpen(false); setSelected({ ...action, name: host.name || host.product_name }); setContext(null); setError(''); setReady(false); setVncUrl('')
    if (action.type === 'vnc') {
      connectionWindow = window.open('about:blank', '_blank'); popup.current = connectionWindow
      if (connectionWindow) { connectionWindow.opener = null; connectionWindow.document.title = '正在连接控制台'; connectionWindow.document.body.textContent = '正在检查服务器状态，请稍候…' }
    }
    try {
      const value = await loader.prepare(action)
      if (!mounted.current || ticket !== generation.current) return
      if (value.power) changed.current?.({ id: host.id, power: value.power, ...(value.cloud ? { detail: value.cloud } : {}) })
      if (action.type === 'vnc') {
        const result = await api.vnc({}), raw = result.data?.url || result.data?.vnc_url
        if (!raw) throw new Error('暂时无法获取远程控制台地址，请稍后重试')
        const url = new URL(raw, window.location.origin)
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('远程控制台地址无效，请联系客服')
        if (!mounted.current || ticket !== generation.current) { if (connectionWindow && !connectionWindow.closed) connectionWindow.close(); return }
        if (connectionWindow && !connectionWindow.closed) { connectionWindow.location.replace(url.href); popup.current = null; close() }
        else setVncUrl(url.href)
      } else { setContext(value); setReady(true) }
    } catch (err) {
      if (mounted.current && ticket === generation.current) {
        if (popup.current && !popup.current.closed) popup.current.close()
        popup.current = null
        setError(err.message || '暂时无法检查此操作，请稍后重试')
      }
    }
  }
  const goSecurity = async () => {
    if (securityBusy) return
    setSecurityBusy(true); setSecurityError('')
    const ticket = ++generation.current
    try {
      const result = await loader.prepare(SECURITY_ACTION)
      if (mounted.current && ticket === generation.current) window.location.assign(result.url)
    } catch (err) { if (mounted.current && ticket === generation.current) setSecurityError(err.message || '安全组信息暂时无法读取，请重试') }
    finally { if (mounted.current) setSecurityBusy(false) }
  }
  const runPower = async (action, body) => {
    if (locked.current || !context) return false
    const option = quickActionOptions({ ...context, ready: true, busy: Boolean(operation) }).find(item => item.action === action)
    if (!option || option.disabled) { toast(option?.reason || '当前状态不支持此操作', 'warning'); return false }
    locked.current = true; setBusy(true)
    try {
      await api[action](body || {})
      if (!mounted.current) return false
      toast('指令已下发，等待服务器响应', 'success'); track('power', { action }); return true
    } catch (err) {
      loader.invalidate()
      if (!mounted.current) return false
      if (Number(err?.data?.data?.operate_password) === 1) setSelected(value => ({ ...value, needPassword: true }))
      if (err.uncertain) track('power', { action })
      toast(err.message, 'warning'); return false
    } finally { locked.current = false; if (mounted.current) setBusy(false) }
  }
  const cachedPower = loader.peekPower()
  const disabledReason = !supported ? '该产品请进入控制面板操作' : host.status !== 'Active' ? '仅已开通的服务器支持此操作' : operation || busy ? '服务器正在执行操作，请稍候' : ''
  const renewReason = renewalReason(host) || (operation || busy ? '服务器正在执行操作，请稍候' : '')
  const options = quickActionOptions({ host, power: cachedPower, deferCheck: true, busy: busy || Boolean(operation) })
  return <>
    {supported && <Button permission="action:control" size="sm" variant="ghost" className="cra1-product-card__remote" disabled={Boolean(disabledReason)} title={disabledReason || '打开 VNC 控制台'} onClick={event => begin(VNC_ACTION, event.currentTarget)}><Monitor aria-hidden="true" />远程登录</Button>}
    {window.__CRA1_RUNTIME__?.features?.renew && <Button permission="action:billing" size="sm" variant="ghost" className="cra1-product-card__renew" disabled={Boolean(renewReason)} title={renewReason || '选择续费周期'} onClick={event => begin(RENEW_ACTION, event.currentTarget)}><CalendarPlus aria-hidden="true" />续费</Button>}
    <DropdownMenu open={open} onOpenChange={value => { if (value) returnFocus.current = trigger.current; else if (securityBusy) generation.current++; setOpen(value) }}>
      <DropdownMenuTrigger asChild><Button ref={trigger} size="sm" variant="ghost" className="cra1-product-card__quick" title="更多操作" aria-label={`更多操作 ${host.name || host.product_name || host.id}`} aria-busy={busy || Boolean(operation)}>{operation ? <Loader2 className="animate-spin" aria-hidden="true" /> : <MoreHorizontal aria-hidden="true" />}</Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" collisionPadding={12} sideOffset={6} className="cra1-product-actions-menu" aria-label={`服务器操作 ${host.name || host.id}`} onCloseAutoFocus={event => { if (selected) event.preventDefault() }}>
        {MENU_GROUPS.map((keys, index) => <div key={index}>{index > 0 && <DropdownMenuSeparator />}<DropdownMenuLabel className="cra1-product-actions-menu__label">{index ? '配置管理' : '实例操作'}</DropdownMenuLabel>{index === 1 && <Guard permission="action:control"><CopyLoginMenuItem host={host} api={api} active={open} /></Guard>}{keys.map(key => {
          const option = options.find(item => item.key === key), Icon = ICONS[key]
          return <DropdownMenuItem permission={index?'action:control':'action:power'} key={key} disabled={option.disabled} title={option.reason || undefined} variant={key === 'reinstall' ? 'destructive' : 'default'} onSelect={() => begin(option, trigger.current)}><Icon aria-hidden="true" />{option.title}</DropdownMenuItem>
        })}</div>)}
        <DropdownMenuItem permission="action:control" disabled={Boolean(configurationReason(host, 'security')) || securityBusy} title={configurationReason(host, 'security') || undefined} onSelect={event => { event.preventDefault(); goSecurity() }}>{securityBusy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}{securityBusy ? '正在读取安全组…' : '配置安全组'}</DropdownMenuItem>
        {securityError && <p role="alert" className="cra1-product-actions-menu__error">{securityError}</p>}
        <DropdownMenuItem permission="action:billing" disabled={Boolean(configurationReason(host, 'upgrade')) || busy || Boolean(operation)} title={configurationReason(host, 'upgrade') || undefined} onSelect={() => begin(UPGRADE_ACTION, trigger.current)}><ArrowUpDown aria-hidden="true" />升降级</DropdownMenuItem>
        <DropdownMenuSeparator />
        {window.__CRA1_RUNTIME__?.features?.renew && <Guard permission="action:billing"><div className="server-auto-renew cra1-product-actions-menu__auto">
          <DropdownMenuLabel className="cra1-product-actions-menu__label cra1-product-actions-menu__renew-label">自动续费</DropdownMenuLabel>
          <DropdownMenuCheckboxItem asChild checked={auto.state.phase === 'error' || autoReason ? 'indeterminate' : auto.state.enabled ?? 'indeterminate'} disabled={Boolean(autoReason) || ['loading', 'saving', 'confirming'].includes(auto.state.phase)} onSelect={event => { event.preventDefault(); auto.activate() }}>
            <AutoRenewButton compact state={auto.state} disabledReason={autoReason} errorId={autoErrorId} />
          </DropdownMenuCheckboxItem>
          {auto.state.error && !autoReason && <p id={autoErrorId} className="ar-error" role="alert">{auto.state.error}</p>}
        </div></Guard>}
      </DropdownMenuContent>
    </DropdownMenu>
    {selected && (!ready || vncUrl) && <CheckDialog action={selected} error={error} url={vncUrl} retry={() => begin(selected, null, true)} close={close} />}
    {selected && ready && context && <Suspense fallback={<CheckDialog action={selected} close={close} />}><ActionDialogs dlg={selected} setDlg={value => { if (!value) close(); else setSelected(value) }} host={context.host} cloud={context.cloud} preparedAt={context.preparedAt} power={context.power} renewData={context.renewData} module={host.module} caps={quickDialogCapabilities(context.cloud, context.orderConfig)} api={api} runPower={runPower} onOperation={track} onOpenPay={(id, type, details) => { close(); setPayment({ id, type, details }) }} /></Suspense>}
    {payment && <Suspense fallback={null}><PaymentDialog orderId={{id:payment.id,operation:payment.type,context:payment.details,hostId:host.id}} onClose={() => { setPayment(null); window.setTimeout(() => returnFocus.current?.focus(), 0) }} onPaid={() => track(payment.type, payment.details)} /></Suspense>}
  </>
}
