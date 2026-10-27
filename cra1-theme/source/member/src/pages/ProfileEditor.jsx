import { useEffect, useRef, useState } from 'react'
import { get, put, post, commonData } from '../lib'
import { profilePatch, validateFields, safeReturn } from '../compat'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../ui/card'
import { Field, Input, Select, Textarea } from '../ui/input'
import { Button } from '../ui/button'
import { Alert } from '../ui/feedback'
import CustomFields from '../ui/custom-fields'
import { useToast } from '../ui/toast'

export default function ProfileEditor({ account, onSaved }) {
  const toast=useToast(), lock=useRef(false), runtime=window.__CRA1_RUNTIME__ || {}
  const [form,setForm]=useState(()=>({...profilePatch(account),notes:account.client_notes ?? account.notes ?? ''}))
  const [fields,setFields]=useState([]),[values,setValues]=useState({}),[countries,setCountries]=useState([])
  const [ready,setReady]=useState(!runtime.client_custom_fields),[error,setError]=useState(''),[saving,setSaving]=useState(false)
  const beforeSettle=new URLSearchParams(location.search).has('complete_checkout')
  const restrictions=commonData().prohibit_user_information_changes || []
  const set=key=>e=>setForm(f=>({...f,[key]:e.target.value}))
  useEffect(()=>{get('/country').then(r=>setCountries(r.data?.list || [])).catch(()=>{})},[])
  useEffect(()=>{
    if(!runtime.client_custom_fields)return
    let alive=true;setReady(false)
    get('/client_custom_field_value').then(r=>{if(!alive)return;const list=r.data?.list || [];setFields(list);setValues(Object.fromEntries(list.map(f=>[f.id,f.value ?? ''])));setReady(true)}).catch(e=>{if(alive)setError(e.message)})
    return()=>{alive=false}
  },[account.id])
  async function submit(e){
    e.preventDefault();if(lock.current||!ready)return
    const validation=validateFields(fields,values,beforeSettle);if(validation)return setError(validation)
    lock.current=true;setSaving(true);setError('')
    try{
      await put('/account',profilePatch(account,form,runtime.client_custom_fields?values:undefined))
      if(form.language){localStorage.setItem('lang',form.language);sessionStorage.setItem('brow_lang',form.language)}
      toast('资料已保存','success');onSaved?.()
      if(beforeSettle){const target=safeReturn(sessionStorage.getItem('cra1:checkout-return'),'/cart/settlement.htm');sessionStorage.removeItem('cra1:checkout-return');location.href=target}
    }catch(e){setError(e.message)}finally{lock.current=false;setSaving(false)}
  }
  return <div className="space-y-4"><form onSubmit={submit} className="space-y-4">
    {error&&<Alert tone="error">{error}</Alert>}
    <Card><CardHeader><CardTitle>基本资料</CardTitle></CardHeader><CardContent><fieldset disabled={saving||!ready} className="grid gap-4 sm:grid-cols-2">
      <Field label="用户名" htmlFor="profile-name"><Input id="profile-name" value={form.username||''} onChange={set('username')} maxLength={20}/></Field>
      <Field label="公司" htmlFor="profile-company"><Input id="profile-company" value={form.company||''} onChange={set('company')} maxLength={255}/></Field>
      <Field label="邮箱" htmlFor="profile-email" hint={<a href="/account.htm?tab=security">前往安全设置修改</a>}><Input id="profile-email" value={account.email||''} disabled/></Field>
      <Field label="手机号" htmlFor="profile-phone"><Input id="profile-phone" value={account.phone?`+${account.phone_code} ${account.phone}`:''} disabled/></Field>
      <Field label="国家或地区" htmlFor="profile-country"><Select id="profile-country" value={form.country_id||''} onChange={set('country_id')}><option value="">请选择</option>{countries.map(c=><option key={c.id} value={c.id}>{c.name_zh||c.name}</option>)}</Select></Field>
      <Field label="地址" htmlFor="profile-address"><Input id="profile-address" value={form.address||''} onChange={set('address')} maxLength={255}/></Field>
      {runtime.locale?.choices?.length>0&&<Field label="显示语言" htmlFor="profile-language"><Select id="profile-language" value={form.language} onChange={set('language')}>{runtime.locale.choices.map(l=><option key={l.display_lang} value={l.display_lang}>{l.display_name || l.name || l.display_lang}</option>)}</Select></Field>}
      <Field label="备注" htmlFor="profile-notes"><Textarea id="profile-notes" value={form.notes||''} onChange={set('notes')} maxLength={1000}/></Field>
    </fieldset>
    {fields.length>0&&<fieldset disabled={saving} className="mt-4"><CustomFields fields={fields} values={values} onChange={setValues} disabled={saving} restricted={restrictions} beforeSettle={beforeSettle}/></fieldset>}
    </CardContent></Card>
    <Card><CardHeader><CardTitle>通知偏好</CardTitle></CardHeader><CardContent><fieldset disabled={saving||!ready} className="grid gap-4 sm:grid-cols-2"><Field label="接收通知" htmlFor="notice-open"><Select id="notice-open" value={form.notice_open} onChange={set('notice_open')}><option value="1">接收通知</option><option value="0">关闭通知</option></Select></Field><Field label="通知方式" htmlFor="notice-method"><Select id="notice-method" value={form.notice_method} onChange={set('notice_method')} disabled={Number(form.notice_open)!==1}><option value="all">邮件和短信</option><option value="email">邮件</option><option value="sms">短信</option></Select></Field></fieldset></CardContent><CardFooter><Button type="submit" disabled={saving||!ready}>{saving?'保存中…':'保存资料'}</Button></CardFooter></Card>
  </form><ReminderSettings account={account}/></div>
}
function ReminderSettings({account}){
  const toast=useToast(),[busy,setBusy]=useState(false)
  const [credit,setCredit]=useState({credit_remind:Number(account.credit_remind||0),credit_remind_amount:account.credit_remind_amount||'0'})
  const [traffic,setTraffic]=useState({}),[error,setError]=useState(''),[attempt,retry]=useState(0)
  const balanceAvailable=Number(commonData().balance_notice_show)===1
  const modules=window.__CRA1_RUNTIME__?.traffic_modules || []
  useEffect(()=>{let alive=true;setError('');Promise.allSettled(modules.map(async module=>{try{const r=await get('/account/traffic_warning',{module});if(alive)setTraffic(t=>({...t,[module]:r.data}))}catch(e){if(alive)setError(e.message)}}));return()=>{alive=false}},[attempt])
  if(!balanceAvailable && modules.length===0)return null
  return <Card><CardHeader><CardTitle>余额与流量提醒</CardTitle></CardHeader><CardContent className="space-y-4">{error&&<Alert tone="error">{error}<Button variant="link" onClick={()=>retry(n=>n+1)}>重试</Button></Alert>}
    {balanceAvailable&&<div className="flex flex-wrap items-end gap-3"><Field label="余额提醒" htmlFor="credit-remind"><Select id="credit-remind" value={credit.credit_remind} disabled={busy} onChange={e=>setCredit(c=>({...c,credit_remind:Number(e.target.value)}))}><option value="0">关闭</option><option value="1">开启</option></Select></Field>{credit.credit_remind===1&&<Field label="低于此金额提醒" htmlFor="credit-threshold"><Input id="credit-threshold" type="number" min="0" value={credit.credit_remind_amount} onChange={e=>setCredit(c=>({...c,credit_remind_amount:e.target.value}))} disabled={busy}/></Field>}<Button disabled={busy} onClick={async()=>{setBusy(true);try{await post('/account/credit/remind',credit);toast('余额提醒已保存','success')}catch(e){setError(e.message)}finally{setBusy(false)}}}>保存余额提醒</Button></div>}
    {Object.entries(traffic).map(([module,data])=><div key={module} className="flex flex-wrap items-end gap-3"><Field label={module==='mf_cloud'?'云服务器流量提醒':'服务器流量提醒'} htmlFor={`traffic-${module}`}><Select id={`traffic-${module}`} value={Number(data.warning_switch)===1?data.leave_percent:0} disabled={busy} onChange={e=>{const n=Number(e.target.value);setTraffic(t=>({...t,[module]:{warning_switch:n?1:0,leave_percent:n}}))}}><option value="0">关闭</option>{[5,10,15,20].map(n=><option key={n} value={n}>剩余 {n}% 时提醒</option>)}</Select></Field><Button disabled={busy} onClick={async()=>{setBusy(true);try{await put('/account/traffic_warning',{module,...data});toast('流量提醒已保存','success')}catch(e){setError(e.message)}finally{setBusy(false)}}}>保存流量提醒</Button></div>)}
  </CardContent></Card>
}
