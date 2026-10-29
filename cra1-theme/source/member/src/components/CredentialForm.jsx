import { startOAuth } from '../oauth-flow'
import { useEffect, useRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { api, get, post, encryptPassword } from '../lib'
import { passwordPayload, safeReturn, validateFields } from '../compat'
import { loginAccount, loginMethods, passwordError, providerLogo } from '../lib/auth-policy'
import { Button } from '../ui/button'
import { Field, Input } from '../ui/input'
import { Select } from '../ui/select'
import { Alert } from '../ui/feedback'
import { useCaptcha } from '../ui/captcha'
import CustomFields from '../ui/custom-fields'
import QrLogin from './QrLogin'

function PasswordInput({ id, ...props }) {
  const [visible, setVisible] = useState(false)
  return <div className="auth-password"><Input {...props} id={id} type={visible ? 'text' : 'password'} /><button type="button" disabled={props.disabled} aria-label={(visible ? '隐藏' : '显示') + (id === 'auth-confirm' ? '确认密码' : '密码')} aria-pressed={visible} onClick={() => setVisible(v => !v)}>{visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</button></div>
}

export async function finishLogin(response) {
  if (!response.data?.jwt) throw new Error('登录结果无效，请重新登录')
  localStorage.setItem('jwt', response.data.jwt)
  try { const menus = await get('/menu'); localStorage.setItem('frontMenus', JSON.stringify(menus.data?.menu || [])) } catch { /* Menu can retry on the next page. */ }
  const target = safeReturn(sessionStorage.getItem('redirectUrl'))
  sessionStorage.removeItem('redirectUrl')
  location.href = target
}
export default function CredentialForm({ kind = 'login', association = false }) {
  const runtime = window.__CRA1_RUNTIME__ || {}, policy = runtime.auth || {}, common = runtime.common || {}
  const loginPage = kind === 'login' && !association
  const methods = association ? (policy.associate || ['email','phone']) : loginPage ? loginMethods(policy.login) : kind === 'regist' ? (policy.register || []).map(x => x.type) : (policy.reset || [])
  const preferred = loginPage && policy.preferred?.endsWith('-password') ? 'password' : policy.preferred
  const [mode, setMode] = useState(methods.includes(preferred) ? preferred : methods[0] || '')
  const [form, setForm] = useState({ account:'',email:'',phone:'',phone_code:'86',username:'',code:'',password:'',re_password:'' })
  const [countryOption, setCountryOption] = useState('86')
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [sending, setSending] = useState(false)
  const [countdown, setCountdown] = useState(0), [countries,setCountries] = useState([]), [fields,setFields] = useState([]), [values,setValues] = useState({}), [fieldError,setFieldError] = useState('')
  const [sale,setSale]=useState(() => kind === 'regist' && policy.sales ? (new URLSearchParams(location.search).get('sale_number') || '').slice(0,100) : '')
  const [remember,setRemember]=useState(false)
  const [fieldsReady,setFieldsReady]=useState(kind !== 'regist' || !runtime.client_custom_fields)
  const [qr,setQr]=useState(kind === 'login' && !association && !!policy.qr && (policy.qr.preferred || !methods.length))
  const [agree,setAgree] = useState(false), [done,setDone] = useState(false)
  const [oauthBusy,setOauthBusy] = useState(false), [languageBusy,setLanguageBusy] = useState(false)
  const [language,setLanguage] = useState(() => {
    const stored = localStorage.getItem('lang')
    return runtime.locale?.choices?.some(x => x.display_lang === stored) ? stored : runtime.locale?.current
  })
  const oauthStop = useRef(null)
  useEffect(()=>()=>oauthStop.current?.(),[])
  const sendLock=useRef(false), lock = useRef(false), captcha = useCaptcha(), proof = useRef({})
  const unifiedAccount = loginPage && mode === 'password'
  const type = unifiedAccount ? (/^\d+$/.test(form.account.trim()) ? 'phone' : 'email') : mode.startsWith('phone') ? 'phone' : 'email'
  const showCountry = type === 'phone'
  const account = unifiedAccount ? form.account : form[type]
  // Preserve every native country, including those sharing a calling code. The
  // selector has unique UI values; the server still receives only phone_code.
  const callingCodes = countries.flatMap((country, i) => country.phone_code && String(country.phone_code) !== '86' ? [{ ...country, option: `${country.phone_code}:${country.id ?? i}` }] : [])
  const needCode = association || kind === 'forget' || mode === 'phone-code' || (kind === 'regist' && policy.register?.find(x => x.type === mode)?.code)
  const scene = association ? 'oauth' : kind === 'regist' ? 'register' : kind === 'forget' ? 'password_reset' : 'login'
  const set = key => e => { proof.current = {}; setForm(f => ({...f,[key]:e.target.value})) }
  function changeCountry(event) {
    const value = event.target.value, country = callingCodes.find(row => row.option === value)
    if(value !== '86' && !country)return
    proof.current = {}; setCountryOption(value)
    setForm(f => ({...f, phone_code: country ? String(country.phone_code) : '86'}))
  }
  useEffect(() => { if (!countdown) return; const timer = setTimeout(() => setCountdown(n => n - 1),1000); return () => clearTimeout(timer) },[countdown])
  useEffect(() => { if (type === 'phone') get('/country').then(r => setCountries(r.data?.list || [])).catch(() => {}) },[type])
  useEffect(() => { if (kind !== 'regist' || !runtime.client_custom_fields || !methods.length) return; let alive=true; get('/register/custom_field').then(r => {if(alive){setFields(r.data?.list || []);setFieldsReady(true)}}).catch(() => {if(alive)setFieldError('补充资料暂时无法读取，请刷新重试')}); return () => {alive=false} },[kind])
  const captchaProof = async () => { const p=await captcha.open(); if(!p)throw new Error('请完成图形验证后重试'); return {captcha:p.code,token:p.token} }
  async function sendCode() {
    if (sendLock.current || sending || countdown || busy) return
    if (loginPage) {
      const checked = loginAccount(account, { methods: policy.login, phoneCode: form.phone_code, code: true })
      if (checked.error) return setError(checked.error)
    } else if (!form[type].trim()) return setError(type === 'email' ? '请先填写邮箱' : '请先填写手机号')
    sendLock.current=true;setSending(true);setError('')
    try {
      const check = policy.captcha?.[scene] ? await captchaProof() : {}
      await post(type === 'phone' ? '/phone/code' : '/email/code', {action:scene,...(type === 'phone'?{phone_code:form.phone_code,phone:form.phone.trim()}:{email:form.email.trim()}),...check})
      setCountdown(60)
    } catch(e) {setError(e.message)} finally {sendLock.current=false;setSending(false)}
  }
  async function submit(e) {
    e.preventDefault(); if(lock.current || sending || languageBusy || oauthBusy || !mode || !fieldsReady)return
    setError('')
    if(loginPage) {
      const checked = loginAccount(account, { methods: policy.login, phoneCode: form.phone_code, code: mode === 'phone-code' })
      if(checked.error)return setError(checked.error)
    } else if(!form[type].trim())return setError(type === 'phone'?'请输入手机号':'请输入邮箱')
    if(needCode && !form.code)return setError('请输入验证码')
    if(!association && (kind !== 'login' || mode !== 'phone-code')) {
      const message = passwordError(form.password, {login:kind==='login',strong:policy.password_rule==='strong'})
      if(message)return setError(message)
      if(kind !== 'login' && form.password !== form.re_password)return setError('两次输入的密码不一致')
    }
    if((kind === 'login' || kind === 'regist' || association) && !agree)return setError('请阅读并同意服务条款和隐私政策')
    if(kind==='regist'&&policy.sales?.required&&!sale)return setError('请选择销售人员')
    const fieldMessage=validateFields(fields,values);if(fieldMessage || fieldError)return setError(fieldMessage || fieldError)
    lock.current=true;setBusy(true)
    try {
      let body = passwordPayload(type,form), path
      if(loginPage) {path='/login';body={type:mode==='phone-code'?'code':'password',account:account.trim(),phone_code:type==='phone'?form.phone_code:'86',remember_password:remember?'1':'0'};if(mode === 'phone-code')body.code=form.code;else body.password=encryptPassword(form.password)}
      else if(association){path='/oauth/client/bind';body={type,account:form[type].trim(),phone_code:form.phone_code,code:form.code}; const q=new URLSearchParams(location.search);if(q.get('ticket')&&q.get('token')){path='/mp_weixin_notice/qrcode/bind_client';body.ticket=q.get('ticket');body.token=q.get('token')}}
      else if(kind === 'regist'){path='/register';body.username=form.username;body.customfield={addon_client_custom_field:values};if(sale)body.customfield.sale_number=sale}
      else path='/account/password_reset'
      if(policy.captcha?.[scene] && !Object.keys(proof.current).length && !needCode && !(scene==='login' && policy.captcha_on_failure))Object.assign(body,await captchaProof())
      Object.assign(body,proof.current);proof.current={}
      const r=await api(path,{method:'POST',body})
      if(kind === 'forget'){setDone(true);setForm(f=>({...f,password:'',re_password:'',code:''}))}else await finishLogin(r)
    } catch(e) {
      setError(e.message)
      if(e.data?.data?.captcha === 1){try{proof.current=await captchaProof();setError('验证完成，请再次点击提交')}catch(f){setError(f.message)}}
    } finally {lock.current=false;setBusy(false)}
  }
  async function changeLanguage(event) {
    const next = event.target.value
    if(languageBusy || busy || sending || oauthBusy || !runtime.locale?.choices?.some(x=>x.display_lang===next))return
    setLanguageBusy(true);setError('')
    try {
      await api('/language',{method:'PUT',body:{language:next}})
      localStorage.setItem('lang',next);sessionStorage.setItem('brow_lang',next);setLanguage(next)
      location.reload()
    } catch(error) {setError(error.message)} finally {setLanguageBusy(false)}
  }
  function authorize(provider) {
    setError('');setOauthBusy(true)
    oauthStop.current=startOAuth(provider.name,{
      onResult:async response=>{if(response.data?.jwt)await finishLogin(response);else location.href='/oauth.htm'},
      onError:error=>{setOauthBusy(false);setError(error.message)},
    })
  }
  if(runtime.error)return <Alert tone="error">页面错误，请刷新重试</Alert>
  if(done)return <><Alert tone="success">密码已重置，请使用新密码登录</Alert><Button className="mt-4 w-full" onClick={()=>location.href='/login.htm'}>返回登录</Button></>
  const labels={password:'账密登录','phone-code':'验证码登录',email:'邮箱',phone:'手机号'}
  const providers=loginPage?(policy.providers||[]).filter(p=>p.name):[]
  const showQr=loginPage&&qr&&policy.qr
  return <div className="auth-content space-y-4">
    {runtime.locale?.choices?.length>1&&<div className="auth-language"><label htmlFor="auth-language">显示语言</label><Select id="auth-language" value={language} disabled={busy||sending||languageBusy||oauthBusy} onChange={changeLanguage}>{runtime.locale.choices.map(l=><option key={l.display_lang} value={l.display_lang}>{l.display_name||l.name||l.display_lang}</option>)}</Select></div>}
    {error && <Alert tone="error">{error}</Alert>}
    {showQr?<><QrLogin onLogin={finishLogin}/>{methods.length>0&&<Button variant="outline" className="w-full" onClick={()=>setQr(false)}>使用账户登录</Button>}</>:methods.length>0?<form onSubmit={submit} className="auth-form" noValidate>
    {loginPage&&policy.qr&&<Button className="w-full" variant="outline" disabled={busy||sending||oauthBusy} onClick={()=>{setError('');setQr(true)}}>微信扫码登录</Button>}
    {methods.length>1 && <div className="auth-methods" aria-label="账户验证方式">{methods.map(m=><button type="button" key={m} aria-pressed={m===mode} onClick={()=>{setMode(m);setError('');setForm(f=>({...f,code:'',...(loginPage?(m==='password'?{account:f.phone||f.account}:{phone:/^\d+$/.test(f.account.trim())?f.account.trim():f.phone}):{})}));proof.current={}}} disabled={busy || sending || oauthBusy || languageBusy}>{labels[m]}</button>)}</div>}
    {kind==='regist'&&<Field className="mb-0" label="用户名" htmlFor="auth-username"><Input id="auth-username" value={form.username} onChange={set('username')} disabled={busy} autoComplete="nickname" placeholder="怎么称呼您（选填）"/></Field>}
    <Field className="mb-0" label={unifiedAccount?'账号':type==='email'?'邮箱':'手机号'} htmlFor="auth-account" required><div className={showCountry?'auth-account-row':undefined}>{showCountry&&<Select className="auth-country" aria-label="国际区号" valueLabel={'+'+form.phone_code} value={countryOption} onChange={changeCountry} disabled={busy||sending}><option value="86">+86</option>{callingCodes.map(x=><option key={x.option} value={x.option}>{x.name_zh || x.name} +{x.phone_code}</option>)}</Select>}<Input id="auth-account" type={unifiedAccount?'text':type==='email'?'email':'tel'} value={account} onChange={set(unifiedAccount?'account':type)} disabled={busy||sending} autoComplete={unifiedAccount?'username':type==='email'?'email':'tel'} autoCapitalize="none" spellCheck={false} inputMode={unifiedAccount?'text':type==='phone'?'tel':'email'} maxLength={unifiedAccount?254:loginPage&&form.phone_code==='86'?11:undefined} placeholder={unifiedAccount?'请输入手机号或邮箱':type==='email'?'请输入邮箱地址':'请输入手机号'}/></div></Field>
    {needCode&&<Field className="mb-0" label="验证码" htmlFor="auth-code" required><div className="flex gap-2"><Input id="auth-code" value={form.code} onChange={set('code')} disabled={busy} autoComplete="one-time-code"/><Button variant="outline" onClick={sendCode} disabled={busy||sending||countdown>0}>{sending?'发送中…':countdown?`${countdown}s`:'获取验证码'}</Button></div></Field>}
    {!association&&!(kind==='login'&&mode==='phone-code')&&<><Field className="mb-0" label={kind==='forget'?'新密码':'密码'} htmlFor="auth-password" required hint={kind!=='login'?(policy.password_rule==='strong'?'使用 8–32 位，包含字母、数字和特殊符号，避免连续或重复字符':'6–32 位'):undefined}><PasswordInput id="auth-password" value={form.password} onChange={set('password')} disabled={busy} autoComplete={kind==='login'?'current-password':'new-password'} placeholder={kind==='login'?'请输入密码':'请设置密码'}/></Field>{kind!=='login'&&<Field className="mb-0" label="确认密码" htmlFor="auth-confirm" required><PasswordInput id="auth-confirm" value={form.re_password} onChange={set('re_password')} disabled={busy} autoComplete="new-password" placeholder="请再次输入密码"/></Field>}</>}
    {kind==='regist'&&policy.sales&&<Field className="mb-0" label="销售人员" htmlFor="register-sale" required={policy.sales.required}>{policy.sales.select?<Select id="register-sale" value={sale} onChange={e=>setSale(e.target.value)} disabled={busy}><option value="">请选择</option>{policy.sales.list.map(s=><option key={s.sale_number} value={s.sale_number}>{s.name}</option>)}</Select>:<Input id="register-sale" value={sale} onChange={e=>setSale(e.target.value)} disabled={busy} placeholder="选填销售编号"/>}</Field>}
    <CustomFields SelectComponent={Select} fieldClassName="mb-0" fields={fields} values={values} onChange={setValues} disabled={busy}/>
    {loginPage&&<div className="auth-options"><label><input type="checkbox" className="cui-checkbox" checked={remember} disabled={busy} onChange={e=>setRemember(e.target.checked)}/>保持登录</label>{policy.reset?.length>0&&<a href="/forget.htm">忘记密码</a>}</div>}
    {(kind==='login'||kind==='regist'||association)&&<label className="auth-agreement flex items-start gap-2"><input id="auth-agreement" type="checkbox" className="cui-checkbox mt-1" checked={agree} onChange={e=>setAgree(e.target.checked)} disabled={busy}/><span>我已阅读并同意 {common.terms_service_url?<a className="underline" href={common.terms_service_url} target="_blank" rel="noopener">服务条款</a>:'服务条款'} 和 {common.terms_privacy_url?<a className="underline" href={common.terms_privacy_url} target="_blank" rel="noopener">隐私政策</a>:'隐私政策'}</span></label>}
    <Button type="submit" className="auth-submit w-full" disabled={busy||sending||languageBusy||oauthBusy||!!fieldError||!fieldsReady}>{busy?'正在提交…':association?'关联账户':kind==='login'?'登录':kind==='regist'?'注册':'重置密码'}</Button>
    </form>:!providers.length&&!policy.external?.url&&<Alert tone="info">当前页面暂不可用</Alert>}
    {loginPage&&<><div className="auth-links">{(showQr||!methods.length)&&policy.reset?.length>0&&<a href="/forget.htm">忘记密码</a>}{policy.register?.length>0&&<a href="/regist.htm">还没有账户？ <span className="underline">注册账户</span></a>}</div>{providers.length>0&&<div className="auth-providers"><div className="auth-providers-label">其他登录方式</div><div className="auth-provider-grid">{providers.map(p=><Button key={p.name} className="gap-2" variant="outline" disabled={busy||sending||languageBusy||oauthBusy} onClick={()=>authorize(p)}>{providerLogo(p,location.origin)&&<img src={providerLogo(p,location.origin)} alt="" className="h-5 w-5 shrink-0 object-contain" onError={e=>{e.currentTarget.hidden=true}}/>}{p.title || '第三方'}登录</Button>)}</div></div>}</>}
    {policy.external?.url&&<a className="block text-center text-sm underline" href={policy.external.url} target={policy.external.blank?'_blank':undefined} rel="noopener noreferrer">{policy.external.text || '其他登录方式'}</a>}
    {(kind!=='login'||association)&&<p className="text-center text-sm"><a href="/login.htm">返回登录</a></p>}
  </div>
}
