import { useEffect, useRef } from 'react'

export function AnnouncementSlot({ className = '' }) {
  const host = useRef(null)
  useEffect(() => {
    const notice = window.CRA1Shared?.Notices?.mount(host.current, { theme: 'member' })
    return () => notice?.destroy()
  }, [])
  return <div ref={host} className={'cra1-notices-host ' + className} hidden />
}
