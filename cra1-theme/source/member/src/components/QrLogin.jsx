import { useEffect, useRef, useState } from 'react'
import { api, post } from '../lib'
import { Alert } from '../ui/feedback'
import { Button } from '../ui/button'
import { Field } from '../ui/input'
import { Select } from '../ui/select'

// Native WeChat session contracts. Neither tickets nor QR responses are cached.
export default function QrLogin({ onLogin }) {
  const [attempt, retry] = useState(0), [qr, setQr] = useState(null), [error, setError] = useState('')
  const [clients, setClients] = useState(null), [selected, select] = useState(''), [busy, setBusy] = useState(false)
  const generation = useRef(0), lock = useRef(false)
  useEffect(() => {
    const g = ++generation.current, c = new AbortController(); let timer
    const current = () => g === generation.current && !c.signal.aborted
    setQr(null); setClients(null); setError('')
    async function poll(data) {
      if (!current()) return
      if (document.hidden) { timer = setTimeout(() => poll(data), 1500); return }
      try {
        const r = await api('/mp_weixin_notice/qrcode/status', { params:{ticket:data.ticket,token:data.token}, signal:c.signal, timeout:35000 })
        if (!current()) return
        const result = r.data || {}
        if (result.status === 'Success') { await onLogin(r); return }
        if (result.status === 'WaitBind') { location.href = `/oauth.htm?${new URLSearchParams({ticket:data.ticket,token:data.token})}`; return }
        if (result.status === 'SelectClient') { setClients(result.client || []); select(String(result.client?.find(x=>Number(x.status)===1)?.id || '')); return }
        if (result.status === 'Expired') { setError('二维码已过期，请重新获取'); return }
        timer = setTimeout(() => poll(data), 1500)
      } catch(e) { if(current()) setError(e.message) }
    }
    api('/mp_weixin_notice/qrcode', { signal:c.signal }).then(r => {
      if (!current()) return
      const data = r.data || {}, source = data.img_url || data.url || data.qrcode || data.qr_code || data.qrcode_url
      if (!source || !data.ticket || !data.token) throw new Error('二维码暂时无法读取，请重试')
      setQr({...data,source}); poll(data)
    }).catch(e=>{if(current())setError(e.message)})
    return () => { c.abort(); generation.current++; clearTimeout(timer) }
  },[attempt])
  async function submit() {
    if(lock.current || !qr || !selected)return
    lock.current=true;setBusy(true);setError('');const g=generation.current
    try { const r=await post('/mp_weixin_notice/qrcode/select_client_login',{ticket:qr.ticket,token:qr.token,client_id:Number(selected)});if(g===generation.current)await onLogin(r) }
    catch(e){if(g===generation.current)setError(e.message)}finally{lock.current=false;setBusy(false)}
  }
  return <div className="space-y-4 text-center">{error&&<Alert tone="error">{error}</Alert>}{clients?<><Field label="选择登录账户" htmlFor="qr-client"><Select id="qr-client" value={selected} onChange={e=>select(e.target.value)} disabled={busy}><option value="">请选择账户</option>{clients.map(c=><option key={c.id} value={c.id} disabled={Number(c.status)!==1}>{c.username || c.email || c.phone || c.id}</option>)}</Select></Field><Button disabled={busy||!selected} onClick={submit}>登录账户</Button></>:qr?<><img src={qr.source} alt="微信登录二维码" className="mx-auto h-52 w-52 object-contain"/><p className="text-sm text-muted-foreground">使用微信扫码登录</p></>:!error&&<p role="status">正在读取二维码…</p>}<Button variant="outline" disabled={busy} onClick={()=>retry(n=>n+1)}>重新获取二维码</Button></div>
}
