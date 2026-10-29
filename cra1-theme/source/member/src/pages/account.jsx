import { Guard, useAccess } from '../ui/access'
import ProfileEditor from './ProfileEditor'
import OauthBindings from './OauthBindings'
import OperatePasswordDialog from '../ui/operate-password-dialog'
import { sharedReady } from '../shared'
import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react'
import { User, Mail, Phone, Shield, Wallet, KeyRound, Building2, MapPin } from 'lucide-react'
import { PageHeader, Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../ui/card'
import { Button } from '../ui/button'
import { Input, Field, Label } from '../ui/input'
import { Badge, Alert, EmptyState, Skeleton } from '../ui/feedback'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog'
import { Avatar } from '../ui/avatar'
import { DataTable } from '../ui/data-table'
import { useToast } from '../ui/toast'
import { commonData, get, post, put, formatDateTime, formatMoney, creditTypeText } from '../lib'
import { usePageTab } from './usePageTab'

/**
 * 账户信息（shadcn 布局）
 * 结构 = PageHeader + Tabs（基本资料 / 安全设置 / 余额记录）
 * 接口见 app/home/controller/AccountController.php
 */
// 标签值会被侧边栏三级导航直接链接（/account.htm?tab=credit），
// 因此必须与 URL 同步，不能只用组件内 state。
const AvatarEditor = lazy(() => import('./AvatarEditor'))
const ACCOUNT_TABS = ['profile', 'security', 'credit']

export default function AccountPage() {
  const [avatarOpen, setAvatarOpen] = useState(false)
  const avatarTrigger = useRef(null)
  const { can } = useAccess()
  const tabRules = {profile:'Account::update',security:'Account::updatePassword',credit:'Account::creditList'}
  const [tab, setTab] = usePageTab('profile', ACCOUNT_TABS.filter(t => can(tabRules[t])))
  const [account, setAccount] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setError('')
    setLoading(true)
    get(can('Account::index') ? '/account' : '/index')
      .then((res) => { const value = res.data?.account || {}; window.CRA1Avatar?.register(value); setAccount(value) })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])
  useEffect(() => {
    const update = e => setAccount(value => value && String(value.id) === String(e.detail?.id)
      ? { ...value, theme_avatar: e.detail.theme_avatar } : value)
    window.addEventListener('cra1:avatar-updated', update)
    return () => window.removeEventListener('cra1:avatar-updated', update)
  }, [])

  if (loading) return <AccountSkeleton />
  if (error) return <Alert tone="error">页面错误，请刷新重试</Alert>

  /* 头像：统一走共享实现（/web/cra1/assets/js/avatar.js，与官网、会员中心顶栏同一套算法）。
     文件由 footer.php 全局加载；若尚未就绪则回退为首字母 + 品牌蓝底。 */
  const avatar = window.CRA1Avatar
  const avatarStyle = avatar ? avatar.style(account) : {}
  const initial = avatar ? avatar.letter(account) : (account?.username || '?').slice(0, 1).toUpperCase()

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-ink">账户信息</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">查看与维护账户资料、安全设置与余额记录</p>
      </div>

      {/* 左右分栏（阿里云账号中心式）：左=用户竖卡（sticky），右=tabs 内容 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[248px_minmax(0,1fr)]">
        {/* 用户竖卡 */}
        <Card className="h-fit lg:sticky lg:top-4">
          <CardContent className="flex flex-col items-center p-5 text-center">
            <Avatar className="size-16 rounded-full" style={avatarStyle}>
              <span className="text-xl">{initial}</span>
            </Avatar>
            <Button ref={avatarTrigger} variant="ghost" size="sm" className="mt-2" onClick={() => setAvatarOpen(true)}>更换头像</Button>
            <div className="mt-3 flex items-center gap-2">
              <p className="text-[15px] font-semibold text-ink">{account?.username || '—'}</p>
              {account?.status === 1 && <Badge tone="success">正常</Badge>}
            </div>
            <p className="mt-0.5 w-full truncate text-xs text-muted-foreground">
              ID：{account?.id ?? '—'}
            </p>
            <div className="mt-3 w-full space-y-1 border-t border-line pt-3 text-left">
              <p className="w-full truncate text-xs text-muted-foreground" title={account?.email || ''}>
                {account?.email || '未绑定邮箱'}
              </p>
              <p className="w-full truncate text-xs text-muted-foreground">
                {account?.phone ? `+${account.phone_code} ${account.phone}` : '未绑定手机号'}
              </p>
            </div>
            <a href="/finance.htm"
               className="mt-4 w-full rounded-lg border border-line px-4 py-2.5 transition-colors duration-150 hover:border-brand/40">
              <p className="text-xs text-muted-foreground">余额</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-ink">{formatMoney(account?.credit)}</p>
            </a>
            <a href="/security.htm"
               className="mt-2 w-full rounded-lg border border-line px-4 py-2.5 text-[13px] text-body transition-colors duration-150 hover:border-brand/40 hover:text-brand">
              安全中心 · 管理密钥
            </a>
          </CardContent>
        </Card>

        {/* tabs 与内容 */}
        <div className="min-w-0">
          <Card>
            <CardContent className="p-5">
              <Tabs value={tab} onValueChange={setTab}>
                <TabsList>
                  <TabsTrigger permission="Account::update" value="profile">基本资料</TabsTrigger>
                  <TabsTrigger permission="Account::updatePassword" value="security">安全设置</TabsTrigger>
                  <TabsTrigger permission="Account::creditList" value="credit">余额记录</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="mt-4">
                {tab === 'profile' && <Guard permission="Account::update"><ProfilePanel account={account} onSaved={load} /></Guard>}
                {tab === 'security' && <Guard permission="Account::updatePassword"><><SecurityPanel account={account} onChanged={load} /><OauthBindings account={account} onChanged={load}/></></Guard>}
                {tab === 'credit' && <Guard permission="Account::creditList"><CreditPanel /></Guard>}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      {avatarOpen && <Suspense fallback={<p role="status">正在打开头像设置…</p>}><AvatarEditor open={avatarOpen} onClose={() => setAvatarOpen(false)} account={account} onSaved={updated => { setAccount(updated); }} returnFocus={avatarTrigger} /></Suspense>}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* 基本资料                                                                    */
/* -------------------------------------------------------------------------- */
function ProfilePanel(props) { return <ProfileEditor {...props} /> }

function SecurityPanel({ account, onChanged }) {
  const [dialog, setDialog] = useState(() => new URLSearchParams(location.search).get('section') === 'operate_password' ? 'operate_password' : null)
  const restricted=commonData().prohibit_user_information_changes || []

  const items = [
    { key: 'password', icon: KeyRound, title: '登录密码', desc: '定期修改密码可提升账户安全性', action: '修改' },
    { key: 'operate_password', icon: Shield, title: '操作密码', desc: Number(account?.set_operate_password) === 1 ? '已设置，验证要求以当前操作的安全策略为准' : '用于验证敏感操作，请勿与登录密码相同', action: Number(account?.set_operate_password) === 1 ? '修改' : '设置' },
    {
      key: 'phone', icon: Phone, title: '手机号',
      desc: account?.phone ? `已绑定 +${account.phone_code} ${account.phone}` : '未绑定手机号',
      action: account?.phone ? '更换' : '绑定',
    },
    {
      key: 'email', icon: Mail, title: '邮箱',
      desc: account?.email || '未绑定邮箱',
      action: account?.email ? '更换' : '绑定',
    },
  ]

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>安全设置</CardTitle>
          <CardDescription>密码与联系方式，用于登录和账户找回</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-line border-t border-line">
            {items.map((it) => (
              <li key={it.key} className="flex items-center gap-4 px-5 py-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/8 text-brand">
                  <it.icon className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-ink">{it.title}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{it.desc}</p>
                </div>
                <Button variant="outline" size="sm" disabled={restricted.includes(it.key) && (it.key==='password' || !!account?.[it.key])} onClick={() => setDialog(it.key)}>{it.action}</Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <PasswordDialog open={dialog === 'password'} onClose={() => setDialog(null)} />
      <OperatePasswordDialog open={dialog === 'operate_password'} onClose={(saved) => {
        const url = new URL(location.href)
        if (url.searchParams.get('section') === 'operate_password') {
          url.searchParams.delete('section')
          history.replaceState(history.state, '', url.pathname + url.search + url.hash)
        }
        setDialog(null)
        if (saved) onChanged?.()
      }} />
      <PhoneDialog account={account} open={dialog === 'phone'} onClose={() => { setDialog(null); onChanged?.() }} />
      <EmailDialog account={account} open={dialog === 'email'} onClose={() => { setDialog(null); onChanged?.() }} />
    </>
  )
}

function PasswordDialog({ open, onClose }) {
  const toast = useToast()
  const [form, setForm] = useState({ old: '', next: '', confirm: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (open) { setForm({ old: '', next: '', confirm: '' }); setErr('') }
  }, [open])

  async function submit(e) {
    e.preventDefault()
    setErr('')
    if (!form.old) return setErr('请输入原密码')
    if (form.next.length < 6) return setErr('新密码至少 6 位')
    if (form.next !== form.confirm) return setErr('两次输入的新密码不一致')
    setBusy(true)
    try {
      // 契约见 AccountController::updatePassword：
      // old_password / new_password / repassword（沿用原生 HTTPS 表单契约）
      await put('/account/password', {
        old_password: form.old,
        new_password: form.next,
        repassword: form.confirm,
      })
      toast('密码修改成功', 'success')
      onClose()
    } catch (e2) {
      setErr(e2.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>修改登录密码</DialogTitle>
          <DialogDescription>修改后需使用新密码重新登录</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {err && <Alert tone="error">{err}</Alert>}
          <Field label="原密码" required>
            <Input type="password" value={form.old} autoComplete="current-password"
                   onChange={(e) => setForm((f) => ({ ...f, old: e.target.value }))} />
          </Field>
          <Field label="新密码" required hint="至少 6 位">
            <Input type="password" value={form.next} autoComplete="new-password"
                   onChange={(e) => setForm((f) => ({ ...f, next: e.target.value }))} />
          </Field>
          <Field label="确认新密码" required>
            <Input type="password" value={form.confirm} autoComplete="new-password"
                   onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>取消</Button>
            <Button type="submit" disabled={busy}>{busy ? '提交中…' : '确认修改'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** 验证码输入行（手机/邮箱共用） */
function CodeField({ value, onChange, onSend, countdown, label = '验证码' }) {
  const [sending, setSending] = useState(false)
  const send = async () => { if (sending || countdown > 0) return; setSending(true); try { await onSend() } finally { setSending(false) } }
  return (
    <Field label={label} required>
      <div className="flex gap-2">
        <Input value={value} onChange={onChange} placeholder="请输入验证码" inputMode="numeric" className="flex-1" />
        <Button variant="outline" className="shrink-0" onClick={send} disabled={sending || countdown > 0}>
          {sending ? '发送中…' : countdown > 0 ? `${countdown}s` : '获取验证码'}
        </Button>
      </div>
    </Field>
  )
}

function useCountdown() {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!n) return
    const t = setTimeout(() => setN((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [n])
  return [n, setN]
}

function PhoneDialog({ open, onClose, account }) {
  const toast = useToast()
  const [form, setForm] = useState({ code: '86', phone: '', sms: '' })
  const [oldVerified, setOldVerified] = useState(!account?.phone)
  const [oldCode, setOldCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [countdown, setCountdown] = useCountdown()

  useEffect(() => { if (open) { setOldVerified(!account?.phone); setOldCode(''); setForm({ code: '86', phone: '', sms: '' }); setErr('') } }, [open])

  async function verifyOld(e) {
    e.preventDefault(); setBusy(true); setErr('')
    try { await put('/account/phone/old', { code: oldCode }); setOldVerified(true); setOldCode('') }
    catch (error) { setErr(error.message) } finally { setBusy(false) }
  }
  async function sendOld() {
    setErr('')
    try {
      let proof = {}
      if (Number(commonData()?.captcha_client_verify) === 1) {
        const shared = await sharedReady(); const result = await shared.Security.openCaptcha()
        if (!result) return
        proof = { captcha: result.code, token: result.token }
      }
      await post('/phone/code', { action: 'verify', ...proof }); setCountdown(60); toast('验证码已发送', 'success')
    } catch (error) { setErr(error.message) }
  }
  async function send() {
    if (!form.phone) return setErr('请先填写手机号')
    setErr('')
    try {
      let proof = {}
      if (Number(commonData()?.captcha_client_update) === 1) {
        const shared = await sharedReady(); const result = await shared.Security.openCaptcha()
        if (!result) return
        proof = { captcha: result.code, token: result.token }
      }
      // 契约见 CommonController::sendPhoneCode：action 必填
      await post('/phone/code', { action: 'update', phone_code: Number(form.code), phone: form.phone, ...proof })
      setCountdown(60)
      toast('验证码已发送', 'success')
    } catch (e) { setErr(e.message) }
  }

  async function submit(e) {
    e.preventDefault()
    setErr('')
    if (!form.phone) return setErr('请输入新手机号')
    if (!form.sms) return setErr('请输入验证码')
    setBusy(true)
    try {
      await put('/account/phone', { phone_code: Number(form.code), phone: form.phone, code: form.sms })
      toast('手机号已更新', 'success')
      onClose()
    } catch (e2) { setErr(e2.message) } finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>更换手机号</DialogTitle></DialogHeader>
        {!oldVerified ? <form onSubmit={verifyOld} className="space-y-4">
          <p className="text-sm text-muted-foreground">请先验证当前绑定的手机，再填写新的手机。</p>
          {err && <Alert tone="error">{err}</Alert>}
          <CodeField value={oldCode} countdown={countdown} onSend={sendOld} onChange={event => setOldCode(event.target.value)} />
          <DialogFooter><Button variant="outline" onClick={onClose}>取消</Button><Button type="submit" disabled={busy || !oldCode}>验证当前绑定</Button></DialogFooter>
        </form> : <form onSubmit={submit} className="space-y-4">
          {err && <Alert tone="error">{err}</Alert>}
          <Field label="新手机号" required>
            <div className="flex gap-2">
              <Input className="w-20" value={form.code} aria-label="国际区号"
                     onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
              <Input value={form.phone} placeholder="请输入手机号" className="flex-1"
                     onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
          </Field>
          <CodeField value={form.sms} countdown={countdown} onSend={send}
                     onChange={(e) => setForm((f) => ({ ...f, sms: e.target.value }))} />
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>取消</Button>
            <Button type="submit" disabled={busy}>{busy ? '提交中…' : '确认更换'}</Button>
          </DialogFooter>
        </form>}
      </DialogContent>
    </Dialog>
  )
}

function EmailDialog({ open, onClose, account }) {
  const toast = useToast()
  const [form, setForm] = useState({ email: '', code: '' })
  const [oldVerified, setOldVerified] = useState(!account?.email)
  const [oldCode, setOldCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [countdown, setCountdown] = useCountdown()

  useEffect(() => { if (open) { setOldVerified(!account?.email); setOldCode(''); setForm({ email: '', code: '' }); setErr('') } }, [open])

  async function verifyOld(e) {
    e.preventDefault(); setBusy(true); setErr('')
    try { await put('/account/email/old', { code: oldCode }); setOldVerified(true); setOldCode('') }
    catch (error) { setErr(error.message) } finally { setBusy(false) }
  }
  async function sendOld() {
    setErr('')
    try {
      let proof = {}
      if (Number(commonData()?.captcha_client_verify) === 1) {
        const shared = await sharedReady(); const result = await shared.Security.openCaptcha()
        if (!result) return
        proof = { captcha: result.code, token: result.token }
      }
      await post('/email/code', { action: 'verify', ...proof }); setCountdown(60); toast('验证码已发送', 'success')
    } catch (error) { setErr(error.message) }
  }
  async function send() {
    if (!form.email) return setErr('请先填写邮箱')
    setErr('')
    try {
      let proof = {}
      if (Number(commonData()?.captcha_client_update) === 1) {
        const shared = await sharedReady(); const result = await shared.Security.openCaptcha()
        if (!result) return
        proof = { captcha: result.code, token: result.token }
      }
      // 契约见 CommonController::sendEmailCode：action 必填
      await post('/email/code', { action: 'update', email: form.email, ...proof })
      setCountdown(60)
      toast('验证码已发送', 'success')
    } catch (e) { setErr(e.message) }
  }

  async function submit(e) {
    e.preventDefault()
    setErr('')
    if (!form.email) return setErr('请输入新邮箱')
    if (!form.code) return setErr('请输入验证码')
    setBusy(true)
    try {
      await put('/account/email', { email: form.email, code: form.code })
      toast('邮箱已更新', 'success')
      onClose()
    } catch (e2) { setErr(e2.message) } finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>更换邮箱</DialogTitle></DialogHeader>
        {!oldVerified ? <form onSubmit={verifyOld} className="space-y-4">
          <p className="text-sm text-muted-foreground">请先验证当前绑定的邮箱，再填写新的邮箱。</p>
          {err && <Alert tone="error">{err}</Alert>}
          <CodeField value={oldCode} countdown={countdown} onSend={sendOld} onChange={event => setOldCode(event.target.value)} />
          <DialogFooter><Button variant="outline" onClick={onClose}>取消</Button><Button type="submit" disabled={busy || !oldCode}>验证当前绑定</Button></DialogFooter>
        </form> : <form onSubmit={submit} className="space-y-4">
          {err && <Alert tone="error">{err}</Alert>}
          <Field label="新邮箱" required>
            <Input type="email" value={form.email} placeholder="you@example.com"
                   onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </Field>
          <CodeField value={form.code} countdown={countdown} onSend={send}
                     label="邮箱验证码"
                     onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>取消</Button>
            <Button type="submit" disabled={busy}>{busy ? '提交中…' : '确认更换'}</Button>
          </DialogFooter>
        </form>}
      </DialogContent>
    </Dialog>
  )
}

/* -------------------------------------------------------------------------- */
/* 余额记录（DataTable 模式）                                                   */
/* -------------------------------------------------------------------------- */
function CreditPanel() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 10

  useEffect(() => {
    setLoading(true)
    setError('')
    get('/credit', { page, limit })
      .then((res) => { setRows(res.data?.list || []); setTotal(res.data?.count || 0) })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [page])

  const columns = [
    { key: 'create_time', title: '时间', width: 160,
      render: (r) => <span className="text-muted-foreground">{formatDateTime(r.create_time)}</span> },
    { key: 'type', title: '类型', render: (r) => creditTypeText(r.type) },
    { key: 'amount', title: '金额', width: 120,
      render: (r) => (
        <span className={Number(r.amount) >= 0 ? 'font-medium text-[#00B42A]' : 'font-medium text-danger'}>
          {Number(r.amount) >= 0 ? '+' : ''}{formatMoney(r.amount)}
        </span>
      ) },
    { key: 'credit', title: '余额', width: 120,
      render: (r) => <span className="tabular-nums">{formatMoney(r.credit)}</span> },
    // 接口字段为 notes（cc.notes），响应无 description/balance
    { key: 'notes', title: '说明',
      render: (r) => <span className="text-muted-foreground">{r.notes || r.description || '—'}</span> },
  ]

  return (
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
          empty="暂无余额记录"
        />
      </CardContent>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
function AccountSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-4 w-64" />
      <Card><CardContent className="p-5"><Skeleton className="h-12 w-full" /></CardContent></Card>
      <div className="flex gap-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-9 w-24" />)}</div>
      <Card><CardContent className="space-y-4 p-5">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full max-w-[560px]" />)}</CardContent></Card>
    </div>
  )
}
