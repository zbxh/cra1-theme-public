import { useEffect, useState } from 'react'
import { get } from '../lib'
import { RegisterAuthLayout } from './authLayout'
import CredentialForm, { finishLogin } from '../components/CredentialForm'
import { Alert } from '../ui/feedback'
import { Button } from '../ui/button'
let initialSession
export default function OauthPage(){
 const [state,setState]=useState('pending'),[error,setError]=useState('')
 useEffect(()=>{let alive=true; const q=new URLSearchParams(location.search);if(q.get('ticket')&&q.get('token')){setState('bind');return}
 (initialSession ||= get('/oauth/token')).then(async r=>{if(!alive)return;if(r.data?.jwt){await finishLogin(r)}else {const target=r.data?.url?new URL(r.data.url,location.origin):null;if(target?.origin===location.origin&&target.pathname==='/oauth.htm'&&!target.username&&!target.password)setState('bind');else{setState('error');setError('授权已过期，请重新发起登录')}}}).catch(e=>{if(alive){setState('error');setError(e.message)}});return()=>{alive=false}},[])
 return <RegisterAuthLayout title="关联账户" subtitle="完成第三方登录">{state==='pending'?<p role="status">正在确认授权…</p>:state==='bind'?<CredentialForm kind="login" association/>:<><Alert tone="error">{error}</Alert><Button className="mt-4" onClick={()=>location.href='/login.htm'}>返回登录</Button></>}</RegisterAuthLayout>
}
