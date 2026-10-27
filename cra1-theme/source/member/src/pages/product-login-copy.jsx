import { useEffect, useRef, useState } from 'react'
import { Check, Copy, Loader2 } from 'lucide-react'
import { DropdownMenuItem } from '../ui/dropdown-menu'
import { useToast } from '../ui/toast'
import { copyToClipboard } from '../shared'
import { formatLoginInfo, loginInfoReason } from '../lib/product-login-info'
import { sharedReady } from '../shared'

/** Credentials exist only during this open menu, never in card data or storage. */
export default function CopyLoginMenuItem({ host, api, active }) {
  const toast = useToast(), alive = useRef(false), locked = useRef(false)
  const controller = useRef(null), prepared = useRef(null), timer = useRef(null), generation = useRef(0)
  const [phase, setPhase] = useState('idle'), [error, setError] = useState('')
  const reason = loginInfoReason(host)
  useEffect(() => {
    alive.current = active; generation.current++; locked.current = false; setPhase('idle'); setError('')
    return () => { alive.current = false; generation.current++; controller.current?.abort(); prepared.current = null; window.clearTimeout(timer.current) }
  }, [active, host.id, host.module])

  const copy = async () => {
    if (locked.current || reason || !alive.current) return
    const ticket = generation.current, current = () => alive.current && ticket === generation.current
    locked.current = true; setError(''); setPhase('loading'); window.clearTimeout(timer.current)
    try {
      const shared = await sharedReady(), session = shared.Request.getToken()
      let until = Math.min(Date.now() + 30000, prepared.current?.until || Infinity)
      let text = prepared.current?.until > Date.now() ? prepared.current.text : ''
      if (prepared.current?.session !== session) text = ''
      prepared.current = null
      if (!text) {
        controller.current = new AbortController()
        const response = await api.withSignal(controller.current.signal).remoteInfo()
        if (!current()) return
        text = formatLoginInfo(host, response.data)
        const verifiedUntil = Number(response.data?.verification_expires_at) * 1000
        until = Math.min(Date.now() + 30000, verifiedUntil || Infinity)
      }
      if (!current()) return
      if (shared.Request.getToken() !== session || Date.now() >= until) throw new Error('安全验证已过期，请重新读取登录信息')
      const copied = await copyToClipboard(text)
      if (!current()) return
      if (copied) {
        setPhase('copied'); toast('登录信息已复制', 'success')
        timer.current = window.setTimeout(() => { if (current()) setPhase('idle') }, 1800)
      } else {
        // Some browsers require a second direct click after the network read.
        prepared.current = { text, until, session }
        setPhase('idle'); setError('浏览器未允许复制，请再次点击“复制登录信息”重试。')
        timer.current = window.setTimeout(() => { prepared.current = null; if (current()) setError('登录信息已过期，请重新点击读取。') }, Math.max(0, until - Date.now()))
      }
    } catch (err) {
      if (current()) { prepared.current = null; setPhase('idle'); setError(err.message || '暂时无法读取登录信息，请稍后重试') }
    } finally { if (current()) locked.current = false }
  }

  const Icon = phase === 'loading' ? Loader2 : phase === 'copied' ? Check : Copy
  return <>
    <DropdownMenuItem disabled={Boolean(reason) || phase === 'loading'} title={reason || undefined} onSelect={event => { event.preventDefault(); copy() }} aria-busy={phase === 'loading'}>
      <Icon aria-hidden="true" className={phase === 'loading' ? 'animate-spin' : undefined} />{phase === 'loading' ? '正在读取登录信息…' : '复制登录信息'}
    </DropdownMenuItem>
    {error && <p role="alert" className="cra1-product-actions-menu__error">{error}</p>}
  </>
}
