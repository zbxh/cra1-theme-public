import { useEffect, useRef, useState } from 'react'
import { Upload, Check, RotateCcw } from 'lucide-react'
import { Button } from '../ui/button'
import { Alert } from '../ui/feedback'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog'
import { api } from '../lib'
import './avatar-editor.css'

/** Uploads are staged on the server; only the explicit save changes the avatar. */
export default function AvatarEditor({ open, onClose, account, onSaved, returnFocus }) {
  const [draft, setDraft] = useState(account?.theme_avatar || { mode: 'default', revision: 0 })
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [upload, setUpload] = useState(null)
  const file = useRef(), request = useRef(null), generation = useRef(0)
  const revision = useRef(account?.theme_avatar?.revision || 0)
  const avatar = window.CRA1Shared?.Avatar
  useEffect(() => {
    generation.current++
    request.current?.abort()
    setBusy(''); setError(''); setUpload(null)
    setDraft(account?.theme_avatar || { mode: 'default', revision: 0 })
    revision.current = account?.theme_avatar?.revision || 0
    return () => { generation.current++; request.current?.abort() }
  }, [open, account?.id])

  const choice = (value) => { if (busy) return; setDraft(value); setError('') }
  const previewUser = { ...account, theme_avatar: draft, avatar_preview: true }
  const same = draft.mode === (account?.theme_avatar?.mode || 'default') &&
    (draft.mode !== 'preset' || draft.preset === account?.theme_avatar?.preset) &&
    (draft.mode !== 'upload' || draft.attachment_id === account?.theme_avatar?.attachment_id)
  async function uploadFile(event) {
    const f = event.target.files?.[0]; event.target.value = ''
    if (!f || busy) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) return setError('请选择 JPG、PNG 或 WebP 图片。')
    if (f.size > 3 * 1024 * 1024) return setError('图片不能超过 3MB，请换一张小一点的图片。')
    const n = ++generation.current, controller = new AbortController(); request.current = controller
    setBusy('upload'); setError('')
    try {
      const body = new FormData(); body.append('file', f)
      const res = await api('/cra1-theme/member/avatar/upload', { method: 'POST', body, signal: controller.signal })
      if (n !== generation.current) return
      const value = { mode: 'upload', attachment_id: res.data.attachment_id, url: res.data.url }
      setUpload(value); setDraft(value)
    } catch (e) { if (n === generation.current && e.name !== 'AbortError') setError(e.message) }
    finally { if (n === generation.current) setBusy('') }
  }
  async function save() {
    if (busy || same) return
    setBusy('save'); setError('')
    try {
      const res = await api('/cra1-theme/member/avatar', { method: 'PUT', body: { ...draft, expected_revision: revision.current } })
      const updated = { ...account, theme_avatar: res.data.theme_avatar }
      avatar.commit(updated); onSaved(updated); onClose()
    } catch (e) { setError(e.message) }
    finally { setBusy('') }
  }
  function close() { if (busy === 'save') return; onClose() }
  const currentCustom = upload || (account?.theme_avatar?.mode === 'upload' ? account.theme_avatar : null)
  return <Dialog open={open} onOpenChange={v => { if (!v) close() }}>
    <DialogContent onCloseAutoFocus={e => { e.preventDefault(); returnFocus?.current?.focus(); }} className="cra1-avatar-editor" onEscapeKeyDown={e => { if (busy === 'save') e.preventDefault() }}>
      <DialogHeader><DialogTitle>更换头像</DialogTitle><DialogDescription>选择喜欢的预设，或上传自己的图片。</DialogDescription></DialogHeader>
      <div className="cra1-avatar-editor__body">
        <div className="cra1-avatar-preview">
          <span className="cra1-avatar-preview__image" style={avatar?.style(previewUser)} aria-label="头像预览">{avatar?.letter(previewUser)}</span>
          <div><p>头像预览</p><span>官网、会员中心和购物车会同步显示</span></div>
        </div>
        <fieldset disabled={!!busy} className="cra1-avatar-presets"><legend>预设头像</legend>
          <div className="cra1-avatar-presets__grid">
            {(avatar?.presets || []).map(p => <label key={p.id} className={'cra1-avatar-choice ' + (draft.mode === 'preset' && draft.preset === p.id ? 'is-selected' : '')}>
              <input type="radio" name="theme-avatar" value={p.id} checked={draft.mode === 'preset' && draft.preset === p.id} onChange={() => choice({ mode: 'preset', preset: p.id })} />
              <span className="cra1-avatar-choice__image" style={avatar.style({ ...account, theme_avatar: { mode: 'preset', preset: p.id }, avatar_preview: true })} />
              <span>{p.label}</span>{draft.mode === 'preset' && draft.preset === p.id && <Check className="cra1-avatar-choice__check" />}
            </label>)}
          </div>
        </fieldset>
        <div className="cra1-avatar-upload">
          <div><p>上传自定义头像</p><span>JPG、PNG、WebP，最大 3MB；图片会居中裁成方形。</span></div>
          <Button variant="outline" disabled={!!busy} onClick={() => file.current?.click()}><Upload className="size-4" />{busy === 'upload' ? '正在上传…' : '选择图片'}</Button>
          <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={uploadFile} aria-label="上传头像图片" />
        </div>
        {currentCustom && <label className={'cra1-avatar-custom ' + (draft.mode === 'upload' && draft.attachment_id === currentCustom.attachment_id ? 'is-selected' : '')}>
          <input disabled={!!busy} type="radio" name="theme-avatar" checked={draft.mode === 'upload' && draft.attachment_id === currentCustom.attachment_id} onChange={() => choice(currentCustom)} />
          <img src={currentCustom.url} alt="自己上传的头像" /><span>{upload ? '刚上传的图片' : '当前自定义头像'}</span>
        </label>}
        <Button variant="ghost" disabled={!!busy || draft.mode === 'default'} onClick={() => choice({ mode: 'default' })}><RotateCcw className="size-4" />恢复默认头像</Button>
        {error && <Alert tone="error" role="alert">{error}</Alert>}
      </div>
      <DialogFooter><Button variant="outline" disabled={busy === 'save'} onClick={close}>取消</Button><Button disabled={!!busy || same} onClick={save}>{busy === 'save' ? '正在保存…' : '保存头像'}</Button></DialogFooter>
    </DialogContent>
  </Dialog>
}
