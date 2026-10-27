import { useEffect, useRef, useState } from 'react'
import { put } from '../lib'
import { Button } from './button'
import { Input, Field } from './input'
import { Alert } from './feedback'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './dialog'
import { useToast } from './toast'

export default function OperatePasswordDialog({ open, onClose }) {
  const toast = useToast()
  const [form, setForm] = useState({ pwd: '', confirm: '' })
  const [busy, setBusy] = useState(false), submitLock = useRef(false)
  const [err, setErr] = useState('')

  useEffect(() => { setForm({ pwd: '', confirm: '' }); setErr('') }, [open])

  async function submit(e) {
    e.preventDefault()
    if (submitLock.current || busy) return
    setErr('')
    if (form.pwd.length < 6 || form.pwd.length > 32) return setErr('操作密码应为 6–32 位')
    if (form.pwd !== form.confirm) return setErr('两次输入不一致')
    submitLock.current = true
    setBusy(true)
    try {
      await put('/account/operate_password', {
        operate_password: form.pwd,
        re_operate_password: form.confirm,
      })
      toast('操作密码已保存', 'success')
      onClose(true)
      window.dispatchEvent(new Event('cra1:account-security-updated'))
    } catch (e2) {
      setErr(e2.message)
    } finally {
      submitLock.current = false
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !busy && onClose(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>设置操作密码</DialogTitle>
          <DialogDescription>请勿与登录密码相同</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4"><fieldset disabled={busy} className="space-y-4">
          {err && <Alert tone="error">{err}</Alert>}
          <Field label="操作密码" htmlFor="operation-password" required hint="6–32 位">
            <Input id="operation-password" type="password" value={form.pwd} autoComplete="new-password"
                   onChange={(e) => setForm((f) => ({ ...f, pwd: e.target.value }))} />
          </Field>
          <Field label="确认操作密码" htmlFor="operation-password-confirm" required>
            <Input id="operation-password-confirm" type="password" value={form.confirm} autoComplete="new-password"
                   onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => onClose(false)}>取消</Button>
            <Button type="submit" disabled={busy}>{busy ? '保存中…' : '保存'}</Button>
          </DialogFooter>
        </fieldset></form>
      </DialogContent>
    </Dialog>
  )
}

