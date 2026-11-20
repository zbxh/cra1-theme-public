import { createContext, useContext, useEffect, useState } from 'react'
import { get } from '../lib'
import { allowed } from '../permissions'
const Access = createContext(null)
export function useAccess(){const value=useContext(Access);return {access:value,can:rule=>allowed(value,rule)}}
export function Guard({permission,children}){return useAccess().can(permission)?children:null}
export function AccessProvider({children}){
 const [access,setAccess]=useState(null),[error,setError]=useState(''),[retry,setRetry]=useState(0)
 useEffect(()=>{let alive=true;setError('');if(window.__CRA1_RUNTIME__?.error){setError('页面暂时无法加载，请刷新重试');return}(window.CRA1Shared?.Access ? window.CRA1Shared.Access.read() : get('/theme/access').then(r=>r.data)).then(data=>{if(alive){window.__CRA1_ACCESS__=data;setAccess(data)}}).catch(e=>{if(alive)setError(e.message)});return()=>{alive=false;delete window.__CRA1_ACCESS__}},[retry])
 useEffect(()=>{const update=()=>{window.CRA1Shared?.Access?.invalidate();setRetry(n=>n+1)};window.addEventListener('cra1:account-security-updated',update);return()=>window.removeEventListener('cra1:account-security-updated',update)},[])
 if(error)return <div role="alert" className="cui-access-state cui-member-feedback p-5 text-sm"><p>暂时无法读取账户权限，请稍后重试。</p><button type="button" className="cui-button cui-button--outline cui-button--sm" onClick={()=>setRetry(n=>n+1)}>重新加载</button></div>
 if(!access)return <div role="status" className="cui-access-state p-5 text-sm text-muted-foreground">正在读取账户权限…</div>
 return <Access.Provider value={access}>{(access.security||[]).length>0&&<div role="status" className="mb-4 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm">请完善账户安全设置：{access.security.map(s=><a key={s.label} href={s.url} className="ml-3 underline">{s.label}</a>)}</div>}{children}</Access.Provider>
}
