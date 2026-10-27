import { useEffect, useState } from 'react'
import { sharedReady } from '../shared'
import { Alert } from './feedback'
import { Button } from './button'
export default function Cashier({orderId,onClose,hostId,operation,context,returnTo}) {
  const [error,setError]=useState(''),[attempt,setAttempt]=useState(0)
  const id = typeof orderId==='object' ? orderId?.id : orderId
  useEffect(()=>{
    if (!id) { setError(''); return }
    let active=true
    setError('')
    sharedReady().then(shared=>{
      if(!active)return
      if(!shared.Payments)throw new Error('支付组件尚未就绪，请刷新后重试')
      shared.Payments.navigate({orderId:id,hostId:hostId || orderId?.hostId,operation:operation || orderId?.operation,context:context || orderId?.context,returnTo})
    }).catch(e=>{if(active)setError(window.CRA1Shared?.Errors?.message(e) || '支付暂时无法打开，请稍后重试')})
    return()=>{active=false}
  },[id,attempt])
  return id && error?<div role="dialog" aria-modal="true" aria-label="支付未能加载" className="fixed inset-0 z-[2100] grid place-items-center bg-black/30 p-4"><div className="max-w-md rounded-xl bg-white p-6"><Alert tone="error">{error}</Alert><p className="mt-3 text-sm">订单已经创建，继续支付即可，无需重新下单。</p><div className="mt-4 flex gap-2"><Button onClick={()=>setAttempt(n=>n+1)}>继续支付</Button><Button variant="outline" onClick={()=>location.assign(`/cashier.htm?id=${id}`)}>打开收银台</Button><Button variant="outline" onClick={onClose}>关闭</Button></div></div></div>:null
}
