import { useEffect, useState } from 'react'
import { MessageSquarePlus } from 'lucide-react'
import { api } from '../lib'
import { buttonVariants } from '../ui/button'

export default function ProductTicket({ hostId }) {
  const [entry, setEntry] = useState(null)
  useEffect(() => {
    if (!hostId) return
    const controller = new AbortController()
    api('/cra1-theme/member/host/' + encodeURIComponent(hostId) + '/ticket-entry', { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setEntry({ hostId, url: result.data?.url }) })
      .catch(() => {})
    return () => controller.abort()
  }, [hostId])
  if (entry?.hostId !== hostId || !entry?.url) return null
  return (
    <a className={buttonVariants({ size: 'sm', variant: 'outline' })} href={entry.url}>
      <MessageSquarePlus aria-hidden="true" />提交工单
    </a>
  )
}
