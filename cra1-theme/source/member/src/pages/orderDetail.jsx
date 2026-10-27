import { useEffect, useState } from 'react'
import { ArrowLeft, CreditCard, FileText, Receipt } from 'lucide-react'
import { PageHeader, Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Badge, Alert, EmptyState, Skeleton } from '../ui/feedback'
import { get, formatDateTime, formatMoney, orderTypeText } from '../lib'
import { sharedReady } from '../shared'
import { useAccess } from '../ui/access'

const STATUS = {Unpaid:['未付款','warning'],Paid:['已付款','success'],WaitUpload:['待上传凭证','warning'],WaitReview:['待审核','default'],ReviewFail:['审核失败','danger'],Cancelled:['已取消','muted'],Refunded:['已退款','muted']}
const HOST_STATUS = {Unpaid:'未付款',Pending:'开通中',Active:'已开通',Suspended:'已暂停',Deleted:'已删除',Failed:'开通失败'}
export default function OrderDetailPage() {
  const id=new URLSearchParams(location.search).get('id') || ''
  const {can}=useAccess()
  const [order,setOrder]=useState(null),[records,setRecords]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[recordError,setRecordError]=useState('')
  useEffect(()=>{
    let alive=true
    if(!/^[1-9]\d*$/.test(id)){setError('订单信息不完整，请从财务中心重新打开。');setLoading(false);return}
    get(`/order/${id}`).then(res=>{if(!alive)return;const data=res.data?.order;setOrder(data?.id?data:null);if(data?.id)window.dispatchEvent(new CustomEvent('cra1:page-title',{detail:{name:data.order_sn || `订单 #${id}`}}))}).catch(e=>{if(alive)setError(e.message)}).finally(()=>{if(alive)setLoading(false)})
    get(`/order/${id}/transaction_record`).then(res=>{if(alive)setRecords(res.data?.list||[])}).catch(()=>{if(alive)setRecordError('交易记录暂时无法读取，可稍后刷新。')})
    return()=>{alive=false}
  },[id])
  async function openCashier(){try{(await sharedReady()).Payments.navigate({orderId:id,operation:'order'})}catch(e){setError(e.message || '收银台暂时无法打开，请重试')}}
  if(loading)return <div className="space-y-4"><PageHeader title="订单详情"/><Card><CardContent className="space-y-4 p-5"><Skeleton className="h-12 w-full"/><Skeleton className="h-24 w-full"/></CardContent></Card></div>
  const st=STATUS[order?.status] || ['状态待同步','muted'], actionable=['Unpaid','WaitUpload','WaitReview','ReviewFail'].includes(order?.status)
  return <div className="cra1-order-detail space-y-5">
    <PageHeader title="订单详情" description={order?`订单 #${order.order_sn || id}`:undefined} actions={<Button variant="outline" size="sm" onClick={()=>location.assign('/finance.htm')}><ArrowLeft className="size-3.5"/>财务中心</Button>}/>
    {error&&<Alert tone="error">{error}</Alert>}
    {!order?<EmptyState icon={Receipt} title={error?'订单暂时无法读取':'订单不存在'} description="请确认订单属于当前账号，或稍后重试。" action={<Button variant="outline" onClick={()=>location.reload()}>重新读取</Button>}/>:<>
      <Card><CardContent className="flex flex-wrap items-center gap-x-9 gap-y-4 p-6">
        <div><p className="text-xs text-muted-foreground">订单金额</p><p className="mt-1 text-2xl font-semibold tabular-nums break-all">{formatMoney(order.amount)}</p></div>
        <div><p className="text-xs text-muted-foreground">状态</p><p className="mt-2"><Badge tone={st[1]}>{st[0]}</Badge></p></div>
        <div><p className="text-xs text-muted-foreground">类型</p><p className="mt-2 text-sm">{orderTypeText(order.type)}</p></div>
        <div><p className="text-xs text-muted-foreground">创建时间</p><p className="mt-2 text-sm">{formatDateTime(order.create_time)}</p></div>
        {actionable&&can('Pay::pay')&&<Button className="ml-auto" onClick={openCashier}><CreditCard className="size-4"/>{order.status==='Unpaid'?'前往收银台':order.status==='WaitReview'?'查看付款进度':'上传付款凭证'}</Button>}
      </CardContent></Card>
      {order.review_fail_reason&&<Alert tone="error">凭证未通过审核：{order.review_fail_reason}</Alert>}
      <Card><CardHeader><CardTitle>订单信息</CardTitle></CardHeader><CardContent>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <Info label="待支付" value={formatMoney(order.amount_unpaid)}/>
          {Number(order.credit)>0&&<Info label="已使用余额" value={formatMoney(order.credit)}/>}
          {order.pay_time>0&&<Info label="付款时间" value={formatDateTime(order.pay_time)}/>}
          {order.gateway&&<Info label="支付方式" value={order.gateway_title || order.gateway}/>}
          {Number(order.refund_amount)>0&&<Info label="已退款" value={formatMoney(order.refund_amount)}/>}
          {Number(order.remain_pay_time)>0&&order.status==='Unpaid'&&<Info label="剩余付款时间" value={`${Math.ceil(Number(order.remain_pay_time)/60)} 分钟`}/>}
        </dl>{order.notes&&<p className="mt-5 border-t border-line pt-4 text-sm break-words">备注：{order.notes}</p>}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>商品明细</CardTitle></CardHeader><CardContent className="p-0">
        {(order.items||[]).length?<ul className="divide-y divide-line">{order.items.map((item,i)=><li key={item.id||i} className="flex flex-wrap items-center gap-4 px-5 py-4">
          <div className="min-w-0 flex-1"><p className="text-sm font-medium break-words">{item.product_name||item.description||'订单项目'}</p><p className="mt-1 text-xs text-muted-foreground break-words">{[item.host_name,item.billing_cycle].filter(Boolean).join(' · ')}</p></div>
          {item.host_status&&<Badge>{HOST_STATUS[item.host_status]||'状态待同步'}</Badge>}<span className="text-sm tabular-nums break-all">{formatMoney(item.amount)}</span>
          {item.host_id>0&&<Button variant="ghost" size="sm" onClick={()=>location.assign(`/productdetail.htm?id=${item.host_id}`)}>管理</Button>}
        </li>)}</ul>:<div className="p-5"><EmptyState title="暂无商品明细"/></div>}
      </CardContent></Card>
      {(order.voucher||[]).length>0&&<Card><CardHeader><CardTitle>已上传凭证</CardTitle></CardHeader><CardContent><ul className="flex flex-wrap gap-3">{order.voucher.map((v,i)=><li key={v.save_name||i}><a href={v.url || '#'} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-2 break-all text-sm underline"><FileText className="size-4 shrink-0"/>{v.name||v.save_name||`凭证 ${i+1}`}</a></li>)}</ul></CardContent></Card>}
      <Card><CardHeader><CardTitle>交易记录</CardTitle></CardHeader><CardContent className="p-0">
        {recordError?<p className="p-5 text-sm text-muted-foreground">{recordError}</p>:records.length?<ul className="divide-y divide-line">{records.map((r,i)=><li key={r.id||i} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm"><time className="text-muted-foreground">{formatDateTime(r.create_time)}</time><span className="min-w-0 flex-1 break-words">{r.description||r.notes||'付款记录'}</span>{r.amount!==undefined&&<span className="tabular-nums">{formatMoney(r.amount)}</span>}</li>)}</ul>:<p className="p-5 text-sm text-muted-foreground">暂无交易记录</p>}
      </CardContent></Card>
    </>}
  </div>
}
function Info({label,value}){return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words">{value}</dd></div>}
