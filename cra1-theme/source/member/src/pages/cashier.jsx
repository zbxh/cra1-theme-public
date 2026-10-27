import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, CheckCircle2, Clock3, ReceiptText, ShieldCheck } from 'lucide-react'
import { PageHeader } from '../ui/card'
import { Button } from '../ui/button'
import { Alert, EmptyState } from '../ui/feedback'
import { useAccess } from '../ui/access'
import { sharedReady } from '../shared'
import { formatMoney, orderTypeText } from '../lib'
import './cashier.css'

const STATES = {
  Paid: ['付款已完成', '已收到付款，请返回查看订单或产品的最新进度。'],
  WaitUpload: ['等待上传凭证', '请先完成转账，再上传付款凭证。'],
  WaitReview: ['凭证正在审核', '凭证已提交，审核通过后订单才会完成付款。'],
  ReviewFail: ['凭证未通过审核', '请核对审核原因，重新上传清晰的付款凭证。'],
  Cancelled: ['订单已取消', '这笔订单已关闭，无法继续付款。'],
  Refunded: ['订单已退款', '退款进度请在订单详情或财务中心查看。'],
  Failed: ['订单无法继续付款', '请查看订单详情，或联系客服。'],
}

export default function CashierPage() {
  const id = new URLSearchParams(location.search).get('id') || ''
  const valid = /^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id))
  const { can } = useAccess()
  const permitted = can('Pay::pay') && can('Order::index')
  const host = useRef(null), generation = useRef(0)
  const [attempt, setAttempt] = useState(0), [error, setError] = useState('')
  const [snapshot, setSnapshot] = useState(null), [status, setStatus] = useState('')
  const [returnTo, setReturnTo] = useState(''), [ready, setReady] = useState(false)
  const [itemsOpen, setItemsOpen] = useState(() => window.innerWidth > 768)
  useEffect(() => {const query = window.matchMedia('(min-width:769px)'), change = () => setItemsOpen(query.matches);query.addEventListener('change', change);return () => query.removeEventListener('change', change)}, [])
  useEffect(() => {
    if (!valid || !permitted) return
    const ticket = ++generation.current
    let handle, active = true
    setError(''); setReady(false)
    sharedReady().then(shared => {
      if (!active) return
      setReturnTo(shared.Payments.context(id)?.source || '')
      handle = shared.Payments.mount(host.current, {
        orderId: id,
        gateway: shared.Payments.context(id)?.gateway || '',
        onState: state => { if (active) { setSnapshot(state); setStatus(state.order?.status || ''); setReady(true) } },
        onPaid: () => { if (active) { setStatus('Paid'); setReady(true); window.dispatchEvent(new Event('cra1:finance-updated')) } },
        onUpdated: () => { if (active) setAttempt(n => n + 1) },
        onCancel: () => { if (active) setError('付款尚未完成。可以继续支付，也可以稍后从订单详情打开。') },
      })
      return handle.ready
    }).catch(e => { if (active) setError(window.CRA1Shared?.Errors?.message(e) || '支付暂时无法加载，请重试') })
    return () => { active = false; if (generation.current === ticket) generation.current++; handle?.destroy() }
  }, [id, valid, permitted, attempt])

  function leave(target) {
    window.CRA1Shared?.Payments.mark(id, status === 'Paid' ? 'paid' : 'updated')
    location.assign(target)
  }
  if (!valid) return <EmptyState icon={ReceiptText} title="订单信息不完整" description="请从订单详情重新打开收银台。" action={<Button onClick={() => location.assign('/finance.htm')}>前往财务中心</Button>} />
  if (!permitted) return <EmptyState title="当前账号没有付款权限" description="请联系主账号确认权限。" />
  const order = snapshot?.order, state = STATES[status], terminal = ['Paid', 'Cancelled', 'Refunded', 'Failed'].includes(status)
  return <div className="cra1-checkout-page">
    <PageHeader title="收银台" description={`订单 #${id}`} actions={<Button variant="outline" size="sm" onClick={() => leave(returnTo || `/orderDetail.htm?id=${id}`)}><ArrowLeft className="size-3.5" />返回{ returnTo ? '来源页面' : '订单' }</Button>} />
    <div className="cra1-checkout-steps" aria-label="订单进度"><span>核对订单</span><i /><span aria-current={status === 'Paid' ? undefined : 'step'}>完成付款</span><i /><span aria-current={status === 'Paid' ? 'step' : undefined}>付款结果</span></div>
    <div className="cra1-cashier-layout">
      <div className="cra1-cashier-main">
        {state && <div className={`cra1-cashier-state ${status === 'Paid' ? 'is-paid' : ''}`} role="status">
          {status === 'Paid' ? <CheckCircle2 aria-hidden="true" /> : <Clock3 aria-hidden="true" />}
          <div><h2>{state[0]}</h2><p>{state[1]}</p>{order?.review_fail_reason && <p>{order.review_fail_reason}</p>}</div>
        </div>}
        {error && <Alert tone="error">{error}<div className="mt-3"><Button size="sm" onClick={() => setAttempt(n => n + 1)}>继续支付当前订单</Button></div></Alert>}
        {!ready && !error && <p className="cra1-cashier-loading" role="status">正在读取订单及付款方式…</p>}
        <div ref={host} className="cra1-cashier-mount" hidden={terminal || !!error} />
        {terminal && <div className="cra1-cashier-result-actions">
          {returnTo && <Button onClick={() => leave(returnTo)}>返回来源页面</Button>}
          <Button variant={returnTo ? 'outline' : 'default'} onClick={() => leave(`/orderDetail.htm?id=${id}`)}>查看订单详情</Button>
          <Button variant="outline" onClick={() => leave('/finance.htm')}>财务中心</Button>
        </div>}
      </div>
      <aside className="cra1-cashier-summary" aria-label="订单摘要">
        <header><ReceiptText aria-hidden="true" /><h2>订单摘要</h2><span>{order ? orderTypeText(order.type) : '正在读取'}</span></header>
        <div className="cra1-cashier-amount"><span>{status === 'Paid' ? '订单金额' : '当前应付'}</span><strong>{order ? formatMoney(status === 'Paid' ? order.amount : snapshot.payable) : '—'}</strong></div>
        <details className="cra1-cashier-items" open={itemsOpen} onToggle={e => setItemsOpen(e.currentTarget.open)}><summary>商品与费用明细 <span>{order?.items?.length || 0} 项 · {itemsOpen ? '收起' : '展开'}</span></summary><ul>{(order?.items || []).map((item, i) => <li key={item.id || i}><div><b>{item.product_name || item.description || '订单项目'}</b>{item.host_name && <small>{item.host_name}</small>}{item.billing_cycle && <small>{item.billing_cycle}</small>}</div><span>{formatMoney(item.amount)}</span></li>)}</ul>
        {order && <dl className="cra1-cashier-totals">
          <div><dt>订单金额</dt><dd>{formatMoney(order.amount)}</dd></div>
          {Number(snapshot.balance) > 0 && <div><dt>余额抵扣</dt><dd>−{formatMoney(snapshot.balance)}</dd></div>}
          {Number(snapshot.coin) > 0 && <div><dt>平台币抵扣</dt><dd>−{formatMoney(snapshot.coin)}</dd></div>}
          {Number(snapshot.voucher) > 0 && <div><dt>代金券抵扣</dt><dd>−{formatMoney(snapshot.voucher)}</dd></div>}
        </dl>}</details>
        <p className="cra1-cashier-assurance"><ShieldCheck aria-hidden="true" />付款结果以系统核实为准</p>
      </aside>
    </div>
  </div>
}
