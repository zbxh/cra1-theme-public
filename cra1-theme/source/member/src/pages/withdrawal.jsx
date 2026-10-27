import {useAccess} from '../ui/access'
import { withdrawalFee } from '../compat'
import { useState, useEffect, useCallback, useRef } from 'react'
import { Wallet, Plus, RefreshCw, Clock, CheckCircle2, XCircle, ArrowRight } from 'lucide-react'
import { PageHeader, Card, CardContent } from '../ui/card'
import { Button } from '../ui/button'
import { Input, Select, Field } from '../ui/input'
import { Badge, Alert, EmptyState } from '../ui/feedback'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog'
import { DataTable } from '../ui/data-table'
import { StatCard, StatGrid } from '../ui/stat-card'
import { useToast } from '../ui/toast'
import { get, post, formatDateTime, formatMoney, pageData } from '../lib'

/**
 * 提现（插件 idcsmart_withdraw）
 *
 * 契约：
 *   GET  /console/v1/withdraw            提现列表（page/limit）
 *   GET  /console/v1/withdraw/rule/credit 提现规则与可用余额
 *   POST /console/v1/withdraw            提交提现申请
 *
 * 状态：0 待审核 / 1 待打款 / 2 审核驳回 / 3 已打款
 */
const STATUS = {
  0: { label: '待审核', tone: 'warning' },
  1: { label: '待打款', tone: 'default' },
  2: { label: '审核驳回', tone: 'danger' },
  3: { label: '已打款', tone: 'success' },
}

export default function WithdrawalPage() {
  const toast = useToast()
  const {can} = useAccess()
  const balancePath = can('Account::index') ? '/account' : '/index'
  const submitLock = useRef(false)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [rule, setRule] = useState(null)
  const [balance,setBalance] = useState(null)
  const available = window.__CRA1_RUNTIME__?.features?.withdraw_open === 1
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ amount: '', method_id: '', account: '', name:'', card_number:'' })
  const limit = 10

  const load = useCallback(() => {
    if(!available){setLoading(false);return}
    setLoading(true)
    setError('')
    get('/withdraw', { page, limit })
      .then((res) => { setRows(res.data?.list || []); setTotal(res.data?.count || 0) })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [page])

  useEffect(load, [load])

  useEffect(() => {
    if(!available)return
    get(balancePath).then(r=>setBalance(r.data?.account?.credit)).catch(e=>setError(e.message))
    // Native rule does not contain an account balance.
    get('/withdraw/rule/credit')
      .then((res) => {setRule(res.data || null);setForm(f=>({...f,method_id:String(res.data?.method?.[0]?.id || '')}))})
      .catch(e => {setRule(null);setError(e.message)})
  }, [])

  const withdrawClosed = !available || !rule || Number(rule.status) !== 1 || !rule.method?.length
  const feeText = !rule ? '—' : rule.withdraw_fee_type === 'fixed' ? formatMoney(rule.withdraw_fee) : `${rule.percent || 0}%（最低 ${formatMoney(rule.percent_min || 0)}）`

  const stat = (s) => rows.filter((r) => Number(r.status) === s).length

  async function submit(e) {
    e.preventDefault()
    if(submitLock.current||busy||withdrawClosed||balance===null)return
    const amount = Number(form.amount)
    if (!Number.isFinite(amount) || amount <= 0 || !/^\d+(?:\.\d{1,2})?$/.test(form.amount.trim())) return toast('请输入正确的提现金额，最多两位小数', 'error')
    if (rule?.min && amount < Number(rule.min)) return toast(`最低提现金额为 ${formatMoney(rule.min)}`, 'error')
    if (!rule.method?.some(m=>Number(m.id)===Number(form.method_id))) return toast('请选择提现方式', 'error')
    if (Number(rule.max)>0 && amount>Number(rule.max)) return toast('金额超过单次提现上限','error')
    if (amount>Number(balance)) return toast('可用余额不足','error')
    if (!form.account.trim()) return toast('请输入收款账号','error')

    submitLock.current = true
    setBusy(true)
    try {
      await post('/withdraw', { amount, method_id:Number(form.method_id), account:form.account, name:form.name, card_number:form.card_number })
      toast('提现申请已提交，等待审核', 'success')
      setOpen(false)
      setForm({ amount: '', method_id: String(rule?.method?.[0]?.id || ''), account: '', name:'', card_number:'' })
      get(balancePath).then(r=>setBalance(r.data?.account?.credit ?? null)).catch(()=>setBalance(null))
      setPage(1)
      load()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      submitLock.current = false
      setBusy(false)
    }
  }

  const columns = [
    { key: 'create_time', title: '时间', width: 150,
      render: (r) => <span className="text-muted-foreground">{formatDateTime(r.create_time)}</span> },
    { key: 'amount', title: '提现金额', width: 120, align: 'right',
      render: (r) => <span className="font-medium tabular-nums">{formatMoney(r.amount)}</span> },
    { key: 'fee', title: '手续费', width: 110, align: 'right',
      render: (r) => <span className="tabular-nums text-muted-foreground">{formatMoney(r.fee)}</span> },
    { key: 'withdraw_amount', title: '到账金额', width: 120, align: 'right',
      render: (r) => <span className="font-medium tabular-nums">{formatMoney(r.withdraw_amount ?? Number(r.amount||0)-Number(r.fee||0))}</span> },
    { key: 'method', title: '提现方式',
      render: (r) => <span className="text-muted-foreground">{r.method || '—'}</span> },
    { key: 'status', title: '状态', width: 110,
      render: (r) => {
        const st = STATUS[Number(r.status)] || { label: String(r.status), tone: 'muted' }
        return <Badge tone={st.tone}>{st.label}</Badge>
      } },
  ]

  if(!available)return <EmptyState title="当前页面暂不可用"/>
  return (
    <div className="space-y-4">
      <PageHeader
        title="提现"
        description="申请余额提现并查看提现记录"
      />

      {/* 资金操作卡（腾讯云费用中心式）：可提余额大字 + 规则说明 + 申请按钮并排 */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-10 gap-y-4 p-5">
          <div>
            <p className="text-xs text-muted-foreground">可提现余额</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-ink">
              {rule ? formatMoney(balance) : '—'}
            </p>
          </div>
          <div className="hidden h-10 w-px bg-line sm:block" aria-hidden="true" />
          <div className="min-w-0 text-[13px] leading-6 text-muted-foreground">
            {withdrawClosed ? (
              <p>服务暂不可用，请稍后重试</p>
            ) : (
              <>
                <p>
                  手续费 {feeText}
                  <span className="mx-1.5 text-line">·</span>
                  最低提现 {rule?.min ? formatMoney(rule.min) : '无限制'}
                </p>
                <p>到账金额 = 提现金额 − 手续费，提交申请后进入审核</p>
              </>
            )}
          </div>
          {!withdrawClosed && (
            <div className="ml-auto">
              <Button onClick={() => {setForm({amount:'',method_id:String(rule.method[0].id),account:'',name:'',card_number:''});setOpen(true)}}>
                <Plus className="size-3.5" />申请提现
              </Button>
            </div>
          )}
        </CardContent>
        {/* 流程说明条：申请 → 审核 → 打款 */}
        {!withdrawClosed && (
        <CardContent className="border-t border-line p-0">
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 px-5 py-3.5 text-[13px] text-muted-foreground" aria-label="提现流程">
            {[
              ['1', '提交申请'],
              ['2', '平台审核'],
              ['3', '打款到账（已扣手续费）'],
            ].map(([n, label], i) => (
              <li key={n} className="flex items-center gap-2">
                {i > 0 && <ArrowRight className="size-3.5 text-line" aria-hidden="true" />}
                <span className="flex size-5 items-center justify-center rounded-full bg-brand/10 text-[11px] font-semibold text-brand">{n}</span>
                <span>{label}</span>
              </li>
            ))}
          </ol>
        </CardContent>
        )}
      </Card>

      <StatGrid>
        <StatCard label="提现记录" value={total || 0}
                  hint="全部申请" sub="含审核中与已完成" icon={RefreshCw} />
        <StatCard label="待审核 / 待打款" value={stat(0) + stat(1)}
                  hint="处理中" sub="等待平台处理" icon={Clock}
                  tone={stat(0) + stat(1) > 0 ? 'warning' : 'brand'} />
        <StatCard label="已打款" value={stat(3)}
                  hint="已完成" sub="到账金额已扣除手续费" icon={CheckCircle2}
                  tone={stat(3) > 0 ? 'success' : 'brand'} />
      </StatGrid>

      <Card>
        <CardContent className="p-5">
          <DataTable
            columns={columns}
            rows={rows}
            loading={loading}
            error={error}
            page={page}
            total={total}
            limit={limit}
            onPageChange={setPage}
            actions={<Button variant="outline" size="sm" onClick={load}><RefreshCw className="size-3.5" />刷新</Button>}
            empty={
              <EmptyState
                icon={Wallet}
                title="暂无提现记录"
                description={withdrawClosed ? '平台已关闭余额提现功能' : '提交提现申请后，记录会显示在这里'}
                action={!withdrawClosed && <Button size="sm" onClick={() => setOpen(true)}><Plus className="size-3.5" />申请提现</Button>}
              />
            }
          />
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(v) => !busy && !v && setOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>申请提现</DialogTitle>
            <DialogDescription>
              {balance !== null ? `当前可提现余额 ${formatMoney(balance)}` : '提交后由平台审核处理'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4"><fieldset disabled={busy} className="space-y-4">
            <Field label="提现金额" required
                   hint={rule?.min ? `最低 ${formatMoney(rule.min)}，手续费 ${feeText}` : undefined}>
              <Input value={form.amount} inputMode="decimal" placeholder="请输入金额"
                     onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
            </Field>
            <Field label="提现方式" required><Select value={form.method_id} onChange={e=>setForm(f=>({...f,method_id:e.target.value}))} disabled={busy}>{(rule?.method || []).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</Select></Field>
            <Field label="收款人姓名"><Input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} disabled={busy}/></Field>
            <Field label="银行卡号"><Input value={form.card_number} onChange={e=>setForm(f=>({...f,card_number:e.target.value}))} disabled={busy}/></Field>
            <Field label="收款账号" required>
              <Input value={form.account} placeholder="请输入收款账号"
                     onChange={(e) => setForm((f) => ({ ...f, account: e.target.value }))} />
            </Field>
            <p className="text-sm">预计手续费 {formatMoney(withdrawalFee(rule,form.amount))}，预计到账 {formatMoney(Math.max(0,Number(form.amount||0)-withdrawalFee(rule,form.amount)))}</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
              <Button type="submit" disabled={busy||withdrawClosed||balance===null}>{busy ? '提交中…' : '提交申请'}</Button>
            </DialogFooter>
          </fieldset></form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
