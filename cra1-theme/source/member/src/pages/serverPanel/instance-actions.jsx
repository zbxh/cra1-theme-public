import {useAccess} from '../../ui/access'
import { useEffect, useState } from 'react'
import {
  ChevronDown, Cpu, FileDown, Info, KeyRound, LifeBuoy, Power,
  PowerOff, RefreshCw, RotateCw, Settings2, Trash2, Zap,
} from 'lucide-react'
import { Button } from '../../ui/button'
import { useToast } from '../../ui/toast'
import { saveRdpFile } from './rdp-download'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '../../ui/dropdown-menu'

/** 电源、系统维护和其他实例操作共用一个入口；支持状态以服务端为准。 */
export default function InstanceActionsMenu({ api, power, busy, setDlg, module, caps, isWin, host, remote }) {
  const {can}=useAccess()
  const [open, setOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const toast = useToast()
  const downloadRdp = async () => {
    if (downloading) return
    setDownloading(true)
    try { saveRdpFile((await api.downloadRdp()).data) }
    catch (error) { toast(error.message || '远程桌面文件下载失败', 'error') }
    finally { setDownloading(false) }
  }
  const [refund, setRefund] = useState({ state: 'loading', allowed: false, pending: false })

  // 每次打开重新确认退订支持情况，关闭或切换实例后丢弃旧响应。
  useEffect(() => {
    if (!open || !api || !can('action:billing') || !window.__CRA1_RUNTIME__?.features?.refund) return
    let alive = true
    Promise.allSettled([api.refundPage({ host_id: host.id }), api.refundMsg()]).then(([page, message]) => {
      if (!alive) return
      const valid = page.status === 'fulfilled' && Number(page.value?.status) === 200
        && [0, 1].includes(Number(page.value.data?.allow_refund))
      const pending = message.status === 'fulfilled'
        && Number(message.value?.status) === 200
        && ['Pending', 'Suspending', 'Suspend'].includes(message.value.data?.refund?.status)
      setRefund({
        state: valid ? 'ready' : 'error',
        allowed: valid && caps.unsubscribe && !pending,
        pending,
      })
    })
    return () => { alive = false }
  }, [api, host.id, open, caps.unsubscribe])

  const changeOpen = (next) => {
    if (next) setRefund({ state: 'loading', allowed: false, pending: false })
    setOpen(next)
  }
  const powerDisabled = busy || power.status === 'operating'
  const isOff = power.status === 'off'
  const MainIcon = isOff ? Power : PowerOff
  const inRescue = Number(remote?.rescue || 0) === 1
  const refundHint = refund.state === 'loading'
    ? '正在确认该实例是否支持退订'
    : refund.state === 'error'
      ? '暂时无法确认退订支持情况，请重新打开菜单重试'
      : refund.pending ? '已有停用申请，请通过“查看停用申请”管理'
        : refund.allowed ? undefined : '该实例不支持自助退订 / 停用，请联系客服'

  return (
    <DropdownMenu open={open} onOpenChange={changeOpen}>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" disabled={busy} aria-label="实例操作" className="w-full">
          <Settings2 className="size-4" />
          实例操作
          <ChevronDown className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56" aria-label="实例操作菜单">
        <DropdownMenuItem permission="action:power" disabled={powerDisabled} onSelect={() => setDlg({
          type: 'power', action: isOff ? 'powerOn' : 'powerOff', danger: !isOff, title: isOff ? '开机' : '关机',
        })}>
          <MainIcon />
          {isOff ? '开机' : '关机'}
        </DropdownMenuItem>
        <DropdownMenuItem permission="action:power" disabled={powerDisabled} onSelect={() => setDlg({ type: 'power', action: 'reboot', title: '重启' })}>
          <RotateCw />
          重启
        </DropdownMenuItem>
        {module === 'mf_cloud' ? (
          <>
            <DropdownMenuItem permission="action:power" variant="destructive" disabled={powerDisabled} onSelect={() => setDlg({ type: 'power', action: 'hardReboot', title: '硬重启', danger: true })}>
              <Zap />
              硬重启（模拟断电）
            </DropdownMenuItem>
            <DropdownMenuItem permission="action:power" variant="destructive" disabled={powerDisabled} onSelect={() => setDlg({ type: 'power', action: 'hardOff', title: '强制关机', danger: true })}>
              <PowerOff />
              强制关机（模拟断电）
            </DropdownMenuItem>
          </>
        ) : null}
        {!caps.manualManage ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem permission="action:control" disabled={powerDisabled} onSelect={() => setDlg({ type: 'reinstall' })}>
              <RefreshCw />
              重装系统
            </DropdownMenuItem>
            <DropdownMenuItem permission="action:control" disabled={powerDisabled} onSelect={() => setDlg({ type: 'resetPass' })}>
              <KeyRound />
              重置密码
            </DropdownMenuItem>
            <DropdownMenuItem permission="action:control" disabled={powerDisabled} onSelect={() => setDlg({ type: inRescue ? 'rescueExit' : 'rescue' })}>
              <LifeBuoy />
              {inRescue ? '退出救援模式' : '救援模式'}
            </DropdownMenuItem>
          </>
        ) : null}
        <DropdownMenuSeparator />
        {isWin && module === 'mf_cloud' ? (
          <DropdownMenuItem permission="action:control" disabled={downloading} onSelect={downloadRdp}>
            <FileDown />
            {downloading ? '正在下载 RDP…' : '下载 RDP'}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem permission="action:control" disabled={!caps.simulate} title={caps.simulate ? undefined : '该实例不支持模拟物理机'} onSelect={() => setDlg({ type: 'simulate' })}>
          <Cpu />
          模拟物理机
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {window.__CRA1_RUNTIME__?.features?.refund && refund.pending && !refund.allowed ? (
          <DropdownMenuItem permission="action:billing" onSelect={() => setDlg({ type: 'unsubscribe' })}>
            <Info />
            查看停用申请
          </DropdownMenuItem>
        ) : null}
        {window.__CRA1_RUNTIME__?.features?.refund && <DropdownMenuItem permission="action:billing" variant="destructive" disabled={!refund.allowed} title={refundHint} onSelect={() => setDlg({ type: 'unsubscribe' })}>
          <Trash2 />
          退订 / 停用
        </DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
