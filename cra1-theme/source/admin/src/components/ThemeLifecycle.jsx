import {useEffect,useRef,useState} from 'react'
import {Button,buttonVariants} from '@ui/button'
import {Card,CardHeader,CardTitle,CardContent} from '@ui/card'
import {Input} from '@ui/input'
import {Alert} from '@ui/feedback'
import {api} from '../lib/api'

const names={disable:'停用主题',restore:'重新启用',uninstall:'完整卸载'}
const confirmation={disable:'停用主题',restore:'重新启用',uninstall:'卸载酷锐A1'}
const display=(row,key)=>row.key==='clientarea_theme_mobile_switch'?(row[key]==='0'?'关闭':'开启'):row[key]==='cra1'?'酷锐A1':row[key]==='default'?'官方默认模板':row[key]||'使用电脑端自适应页面'

export default function ThemeLifecycle({onBusyChange=()=>{},onRemoved=()=>{},removed=null}){
 const [status,setStatus]=useState(null),[plan,setPlan]=useState(null),[text,setText]=useState(''),[ack,setAck]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
 const alive=useRef(true),running=useRef(false),confirmInput=useRef(null)
 useEffect(()=>{alive.current=true;if(!removed)run(load);return()=>{alive.current=false}},[])
 useEffect(()=>{if(!busy)return;const warn=event=>{event.preventDefault();event.returnValue=''};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[busy])
 async function request(action,body){const result=await api('api.release.lifecycle.'+action,body);if(result.status!==200)throw new Error(result.msg||'主题操作未完成，请重新检查');return result.data}
 async function run(fn){if(running.current)return;running.current=true;setBusy(true);onBusyChange(true);setError('');try{await fn()}catch(error){if(alive.current)setError(error.message)}finally{running.current=false;if(alive.current){setBusy(false);onBusyChange(false)}}}
 async function load(){const next=await request('get');if(alive.current)setStatus(next)}
 async function prepare(mode){setPlan(null);setText('');setAck(false);setNotice('');await run(async()=>{const next=await request('plan',{mode});if(alive.current){setPlan(next);requestAnimationFrame(()=>confirmInput.current?.focus())}})}
 async function apply(event){event.preventDefault();if(!plan?.can_apply||text!==confirmation[plan.mode]||(plan.mode==='uninstall'&&!ack))return;await run(async()=>{
  const result=await request('apply',{mode:plan.mode,token:plan.token,confirmation:text})
  if(!alive.current)return
  if(result.mode==='uninstall'){onRemoved(result);return}
  setPlan(null);setText('');setAck(false);setNotice(result.message);await load()
 })}
 if(removed)return <Card><CardHeader><CardTitle>主题已卸载</CardTitle></CardHeader><CardContent className="min-w-0 space-y-4"><p className="text-sm leading-6">{removed.message}</p>{removed.warning&&<Alert tone="warning">{removed.warning}</Alert>}<div className="rounded-lg border bg-muted/30 p-4 text-sm"><p className="font-medium">私有备份已保留</p><code className="mt-2 block break-all text-xs">{removed.backup}</code><p className="mt-2 leading-6">备份包含原配置、素材、账号和审计，仅服务器管理员可读取。请下载到安全位置妥善保存；确认无需恢复后，再由服务器管理员清理。</p><p className="mt-3 break-all leading-6">{removed.recovery}</p></div><div className="flex flex-wrap gap-2"><a className={buttonVariants()} href="/">返回网站首页</a><a className={buttonVariants({variant:'outline'})} href="/home.htm">进入会员中心</a></div></CardContent></Card>
 return <div className="min-w-0 space-y-4">
  {error&&<Alert tone="error">{error}</Alert>}{notice&&<Alert>{notice}</Alert>}
  <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><p role="status">{busy?'正在处理，请稍候…':!status?'状态尚未读取，请重试':status?.disabled?'当前状态：已停用，主题资料已保留':status?.selected?'当前状态：系统正在使用酷锐A1':'当前状态：系统未选择酷锐A1'}</p><Button variant="outline" disabled={busy} onClick={()=>run(load)}>刷新状态</Button></div>
  <div className="grid min-w-0 gap-4 lg:grid-cols-2">
   <Card className="min-w-0"><CardHeader><CardTitle>停用并保留数据</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm leading-6 text-muted-foreground">将正在使用酷锐A1的页面切回官方模板，停止主题扩展。配置、素材和后台账号全部保留，之后可重新启用。</p>{status?.can_restore?<Button disabled={busy} onClick={()=>prepare('restore')}>检查并重新启用</Button>:<Button variant="outline" disabled={busy||!status} onClick={()=>prepare('disable')}>检查停用范围</Button>}</CardContent></Card>
   <Card className="min-w-0"><CardHeader><CardTitle>完整卸载</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm leading-6 text-muted-foreground">切回官方模板，移出主题页面、后台、配置及主题上传的图片和头像。系统业务数据及第三方插件保留。</p><Button variant="outline" disabled={busy||!status} onClick={()=>prepare('uninstall')}>检查卸载范围</Button></CardContent></Card>
  </div>
  {plan&&<Card className="min-w-0"><CardHeader><CardTitle>确认{names[plan.mode]}</CardTitle></CardHeader><CardContent className="min-w-0 space-y-4">
   <div className="space-y-2">{plan.settings.filter(row=>row.changed).map(row=><div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 rounded-lg border p-3 text-sm" key={row.key}><span className="font-medium">{row.label}</span><span className="min-w-0 break-words">{display(row,'before')} → {display(row,'after')}</span></div>)}{!plan.settings.some(row=>row.changed)&&<p className="text-sm text-muted-foreground">当前系统主题选择保持不变。</p>}</div>
   {plan.warnings.map((value,index)=><Alert key={index} tone="warning">{value}</Alert>)}{plan.blockers.map((value,index)=><Alert key={index} tone="error">{value}</Alert>)}
   {plan.mode==='uninstall'&&<><p className="text-sm leading-6">卸载前会将主题文件及私有数据移至 <code className="break-all text-xs">{plan.backup_parent}</code>，不会直接删除备份。</p><details className="rounded-lg border p-3 text-sm"><summary className="cursor-pointer font-medium">查看将移出当前站点的路径（{plan.targets.length} 项）</summary><ul className="mt-3 max-h-56 space-y-1 overflow-y-auto">{plan.targets.map(path=><li className="break-all font-mono text-xs" key={path}>{path}</li>)}</ul></details><p className="text-sm leading-6 text-muted-foreground">客户、产品、订单、付款、工单、官方模板、第三方插件和系统公共上传文件均不清理。</p></>}
   {plan.can_apply&&<form className="space-y-4" onSubmit={apply}>
    {plan.mode==='uninstall'&&<label className="flex items-start gap-2 text-sm leading-6"><input className="mt-1.5 shrink-0" type="checkbox" checked={ack} onChange={event=>setAck(event.target.checked)} disabled={busy}/><span>我已核对以上范围，知道主题上传的图片和头像将不再显示，主题后台会关闭。</span></label>}
    <label className="block text-sm">请输入“{confirmation[plan.mode]}”确认<Input ref={confirmInput} className="mt-2 max-w-sm" aria-label="操作确认文字" autoComplete="off" value={text} onChange={event=>setText(event.target.value)} disabled={busy}/></label>
    <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy||text!==confirmation[plan.mode]||(plan.mode==='uninstall'&&!ack)}>验证身份并{names[plan.mode]}</Button><Button type="button" variant="ghost" disabled={busy} onClick={()=>{setPlan(null);setText('');setAck(false)}}>取消</Button></div>
   </form>}
  </CardContent></Card>}
 </div>
}
