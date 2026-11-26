import { useEffect, useImperativeHandle, useRef, useState } from 'react'
import { ImagePlus, Upload } from 'lucide-react'
import { Button } from '@ui/button'
import { Input, Label } from '@ui/input'
import { Alert } from '@ui/feedback'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@ui/dialog'
import { mediaApi } from '../lib/api'

export default function MediaPicker({ value = '', onChange, label = '图片', compact = false, openDialogRef, returnFocus }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [total, setTotal] = useState(0)
  const [address, setAddress] = useState('')
  const fileInput = useRef(null), sequence = useRef(0), uploadRequest = useRef(null)

  function changeOpen(next) {
    if (next) {
      setAddress('')
      setError('')
    } else {
      uploadRequest.current?.abort()
      sequence.current++
    }
    setOpen(next)
  }
  useImperativeHandle(openDialogRef, () => () => changeOpen(true), [])
  useEffect(() => () => uploadRequest.current?.abort(), [])

  async function load(more = false) {
    const request = ++sequence.current
    setLoading(true)
    setError('')
    try {
      const response = await mediaApi.list({ search, offset: more ? items.length : 0 })
      if (response.status !== 200) throw new Error(response.msg)
      if (request === sequence.current) {
        setItems(previous => more ? [...previous, ...response.data.items] : response.data.items)
        setTotal(response.data.total)
      }
    } catch (error) {
      if (request === sequence.current) setError(error.message || '图片列表读取未完成，请重试')
    } finally {
      if (request === sequence.current) setLoading(false)
    }
  }
  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => load(), 200)
    return () => { clearTimeout(timer); sequence.current++ }
  }, [open, search])

  async function upload(event) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    const controller = new AbortController()
    uploadRequest.current = controller
    setError('')
    setUploading(true)
    try {
      const url = await mediaApi.uploadImage(file, { signal: controller.signal })
      if (!controller.signal.aborted) select(url)
    } catch (error) {
      if (!controller.signal.aborted) setError(error.message)
    } finally {
      if (uploadRequest.current === controller) {
        uploadRequest.current = null
        setUploading(false)
      }
      input.value = ''
    }
  }

  function select(url) {
    if (onChange(url) === false) setError('请填写有效的图片地址')
    else changeOpen(false)
  }

  return <div className={compact ? undefined : 'space-y-3'}>
    {compact ? !openDialogRef && <Button type="button" size="sm" variant="outline" onClick={() => changeOpen(true)}><ImagePlus className="size-4" />{label}</Button> : <>
      <div className="media-current">{value ? <img src={value} alt={label} loading="lazy" onError={event => event.currentTarget.classList.add('image-failed')} />
        : <div className="media-placeholder"><ImagePlus className="size-7" />尚未选择图片</div>}</div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => changeOpen(true)}><ImagePlus className="size-4" />{value ? '更换图片' : '选择图片'}</Button>
        {value && <Button type="button" variant="ghost" onClick={() => onChange('')}>移除图片</Button>}
      </div>
      <details className="advanced-details"><summary>使用图片地址</summary><Label className="sr-only">{label}地址</Label>
        <Input aria-label={label + '地址'} value={value} onChange={event => onChange(event.target.value)} placeholder="粘贴已有图片地址" /></details>
    </>}
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="max-w-[800px]" onCloseAutoFocus={event => {
        if (!returnFocus?.current?.isConnected) return
        event.preventDefault()
        returnFocus.current.focus({ preventScroll: true })
      }}>
        <DialogHeader><DialogTitle>选择图片</DialogTitle><DialogDescription>选择已有图片或上传新图片，支持 PNG、JPEG、WebP、GIF、ICO，最大 5MB。</DialogDescription></DialogHeader>
        <div className="flex gap-2"><Input aria-label="搜索图片" value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索图片…" />
          <Button type="button" disabled={uploading} onClick={() => fileInput.current.click()}><Upload className="size-4" />上传图片</Button>
          <input ref={fileInput} type="file" className="hidden" accept="image/png,image/jpeg,image/webp,image/gif,image/x-icon,image/vnd.microsoft.icon" onChange={upload} /></div>
        {compact && <div className="flex gap-2"><Input aria-label="图片地址" value={address} onChange={event => setAddress(event.target.value)} placeholder="或填写已有图片地址" />
          <Button type="button" variant="outline" disabled={!address.trim()} onClick={() => select(address.trim())}>使用地址</Button></div>}
        {error && <Alert tone="error">{error}</Alert>}
        <div className="media-grid">{items.map(item => <button type="button" key={item.url} onClick={() => select(item.url)} className="media-choice">
          <img src={item.url} alt={item.name} loading="lazy" /><span>{item.name}</span></button>)}</div>
        {(loading || uploading) && <p role="status">{uploading ? '正在上传图片…' : '正在读取图片…'}</p>}
        {!loading && !items.length && !error && <p className="text-sm text-muted-foreground">还没有图片，可以上传一张。</p>}
        {items.length < total && <Button type="button" disabled={loading} variant="outline" onClick={() => load(true)}>加载更多</Button>}
      </DialogContent>
    </Dialog>
  </div>
}
