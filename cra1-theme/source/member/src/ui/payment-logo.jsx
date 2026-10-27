import { useState } from 'react'
import { CreditCard } from 'lucide-react'
export function PaymentLogo({ gateway }) {
  const [failed, setFailed] = useState('')
  return gateway?.url && failed !== gateway.url
    ? <img src={gateway.url} alt="" className="cra1-payment-logo" onError={() => setFailed(gateway.url)} />
    : <CreditCard className="cra1-payment-logo" aria-hidden="true" />
}
