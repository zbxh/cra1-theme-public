import { useEffect, useRef } from 'react'
import { sharedReady } from '../shared'
export function usePaymentReturn(hostId, onPaid) {
  const callback=useRef(onPaid);callback.current=onPaid
  useEffect(()=>{
    if(!hostId)return
    const controller=new AbortController()
    sharedReady().then(shared=>shared.Payments.resume({hostId,signal:controller.signal,onPaid:record=>{
      if(!controller.signal.aborted){callback.current?.(record.operation,record.details);window.dispatchEvent(new Event('cra1:finance-updated'))}
    }})).catch(()=>{})
    return()=>controller.abort()
  },[hostId])
}
