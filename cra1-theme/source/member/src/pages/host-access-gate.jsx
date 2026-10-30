import {useEffect,useState} from 'react'
import {get} from '../lib'
import {Card,CardContent} from '../ui/card'
import {Alert,Skeleton} from '../ui/feedback'
import {Button} from '../ui/button'

function contractPlugin() {
  try {return JSON.parse(document.documentElement.getAttribute('addons_js')||'[]').find(item=>item.name==='EContract'&&/^[1-9]\d*$/.test(String(item.id)))}
  catch {return null}
}

// This gate precedes both custom server panels and third-party module mounts.
export default function HostAccessGate({hostId,children}) {
  const plugin=contractPlugin()
  const [state,setState]=useState(plugin?'loading':'allowed')
  const [orderId,setOrderId]=useState(null)
  useEffect(()=>{
    if(!plugin){setState('allowed');return}
    let alive=true
    setState('loading')
    get(`/e_contract/host/${hostId}/timeout`).then(async res=>{
      if(!alive)return
      const data=res.data
      if(!data||!Object.prototype.hasOwnProperty.call(data,'timeout')||(data.timeout&&!Array.isArray(data.act)))throw new Error('Invalid contract status')
      if(!data.timeout||!data.act.includes('unable_access')){setState('allowed');return}
      const detail=await get(`/theme/host/${hostId}`)
      if(!alive)return
      const host=detail.data?.host
      if(!host?.id||!/^[1-9]\d*$/.test(String(host.order_id)))throw new Error('Missing contract order')
      setOrderId(host.order_id);setState('blocked')
    }).catch(()=>{if(alive)setState('error')})
    return()=>{alive=false}
  },[hostId,plugin?.id])
  if(state==='allowed')return children
  if(state==='loading')return <Skeleton className="h-40 w-full"/>
  if(state==='error')return <Alert tone="danger">页面错误，请刷新重试</Alert>
  return <Card><CardContent className="space-y-4 p-6">
    <Alert tone="warning">该产品的电子合同尚未完成签署，请先签署合同。</Alert>
    <Button onClick={()=>{window.location.href=`/plugin/${plugin.id}/signContract.htm?id=${orderId}`}}>前往签署合同</Button>
  </CardContent></Card>
}
