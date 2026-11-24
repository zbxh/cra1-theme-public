import {useState,useEffect,useRef,lazy,Suspense} from 'react'
import {Button} from '@ui/button'
import {Card,CardHeader,CardTitle,CardContent} from '@ui/card'
import {Input} from '@ui/input'
import {MenuSelect as Select} from '@ui/select'
import {Alert} from '@ui/feedback'
import {api,bootInfo} from '../lib/api'
import ConfigurationTransfer from '../components/ConfigurationTransfer'
import OnlineUpdatesPanel from '../components/OnlineUpdatesPanel'
import {releaseChecks,releaseStatus} from '../lib/release-status'

const ThemeLifecycle=lazy(()=>import('../components/ThemeLifecycle'))
const ModulePresentation=lazy(()=>import('../components/ModulePresentation'))
const versionLabel=data=>data?`${data.version||data.release||'未登记'}${data.release_channel==='test'?'（测试版）':''}`:'正在读取'
const labels={pass:'通过',warning:'提示',blocked:'需处理',unverified:'待核对'}
const readLabels={'check':'文件检查','history':'备份与回退记录','online.settings.get':'GitHub 连接设置'}
export default function ThemeManagement(){
 const [tab,setTab]=useState('version'),[check,setCheck]=useState(null),[history,setHistory]=useState(null),[candidate,setCandidate]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[filter,setFilter]=useState(''),[showPass,setShowPass]=useState(false)
 const [releaseError,setReleaseError]=useState(null)
 const [phase,setPhase]=useState(''),[uploadPercent,setUploadPercent]=useState(null),[localInfo,setLocalInfo]=useState(null),[localId,setLocalId]=useState('')
 const [diagnostics,setDiagnostics]=useState('')
 const [removed,setRemoved]=useState(null)
 const [online,setOnline]=useState(null),[includeTest,setIncludeTest]=useState(null)
 const [onlineSettings,setOnlineSettings]=useState(null),[githubPrefixDraft,setGithubPrefixDraft]=useState(null)
 const [reads,setReads]=useState({})
 const readSequence=useRef({})
 const diagnosticsBox=useRef(null)
 const operation=useRef(false)
 const alive=useRef(true),superAdmin=bootInfo.role==='super_admin'
 const [pageIndex,setPageIndex]=useState(0)
 useEffect(()=>{alive.current=true;load();return()=>{alive.current=false}},[])
 useEffect(()=>setPageIndex(0),[tab,filter,showPass])
 async function call(action,body,options={}){const r=await api('api.release.'+action,body,{...options,reauth:false});if(r.status!==200)throw new Error(r.msg||'操作未完成');return r.data}
 async function read(action){
  const sequence=(readSequence.current[action]||0)+1
  readSequence.current[action]=sequence
  const latest=()=>alive.current&&readSequence.current[action]===sequence
  const update=status=>{if(latest())setReads(previous=>({...previous,[action]:status}))}
  update({pending:true})
  try{
   const data=await call(action)
   if(latest())({check:setCheck,history:setHistory,'online.settings.get':setOnlineSettings}[action])(data)
   update({pending:false})
  }catch(err){update({pending:false,error:err.message||'请重试'})}
 }
 function load(){
  if(operation.current)return
  read('check')
  read('history')
  if(superAdmin)read('online.settings.get')
 }
 async function act(fn){
  if(busy||operation.current)return
  operation.current=true;setBusy(true);setError('');setNotice('');setReleaseError(null)
  try{await fn()}catch(e){if(alive.current){if(e.release)setReleaseError(e.release);else setError(e.message)}}
  finally{operation.current=false;if(alive.current){setBusy(false);setPhase('');setUploadPercent(null)}}
 }
 async function tracked(action,body,initial,options={}){
  const operationId=Array.from(crypto.getRandomValues(new Uint8Array(16)),byte=>byte.toString(16).padStart(2,'0')).join('')
  const controller=new AbortController()
  let phase=initial,finished=false,timer
  const update=value=>{phase=value;if(alive.current&&!finished)setPhase(value)}
  update(initial)
  async function poll(){
   try{
    const reply=await api('api.release.progress.get',{operation:operationId},{signal:controller.signal,reauth:false})
    if(reply.status===200&&reply.data?.phase)update(reply.data.phase)
   }catch{}
   if(!finished&&alive.current)timer=setTimeout(poll,750)
  }
  if(body instanceof FormData)body.set('operation',operationId)
  else body={...body,operation:operationId}
  timer=setTimeout(poll,600)
  try{
   const response=await api('api.release.'+action,body,{
    reauth:false,
    ...(options.upload&&{onUploadProgress:percent=>{
     if(alive.current)setUploadPercent(percent)
     if(percent===100&&phase===initial)update('接收上传的安装包')
    }})
   })
   if(response.status!==200){
    const error=new Error(response.msg||'操作未完成')
    error.release=response.error?.state?response.error:{phase:response.error?.phase||phase,reason:response.error?.reason||error.message,state:'unknown',status_text:'尚未确认当前生效版本。',next:'请查看“备份与回退”确认状态后再操作。',reference:response.error?.reference}
    throw error
   }
   return response.data
  }catch(error){
   if(!error.release){
    const early=['upload','local.import','online.download'].includes(action)
    const limited=error.status===413
    error.release={phase:limited?initial:phase,reason:error.message,state:early?'unchanged':'unknown',status_text:early?'当前操作尚未开始切换主题。':'尚未确认原主题是否仍在生效。',next:early?'处理原因后重试。':'查看“备份与回退”确认当前版本或恢复状态后再操作。'}
   }
   throw error
  }finally{finished=true;clearTimeout(timer);controller.abort()}
 }
 async function upload(file){
  setCandidate(null)
  if(file.size>80*1024*1024){
   setReleaseError({phase:'上传安装包',reason:'安装包超过 80MB。',state:'unchanged',status_text:'本次操作未切换生效版本。',next:'请重新选择主题安装包。'})
   return
  }
  const data=new FormData();data.set('file',file)
  setUploadPercent(0);setCandidate(await tracked('upload',data,'上传安装包',{upload:true}))
 }
 function showBackups(){
  setTab('backups');read('history')
 }
 async function copyDiagnostics(){
  const data=await call('diagnostics')
  if(!alive.current)return
  setDiagnostics(data.text)
  try{await navigator.clipboard.writeText(data.text);if(alive.current)setNotice('排查信息已复制，可粘贴到问题反馈中。')}
  catch{if(alive.current){setNotice('信息已生成，请在下方文本框中手动复制。');requestAnimationFrame(()=>{if(alive.current){diagnosticsBox.current?.focus();diagnosticsBox.current?.select()}})}}
 }
 async function localList(){setPhase('正在读取服务器安装包列表…');const data=await call('local.list');setLocalInfo(data);setLocalId('')}
 const githubPrefix=githubPrefixDraft??onlineSettings?.github_prefix??''
 const prefixChanged=superAdmin&&onlineSettings!==null&&githubPrefix.trim()!==onlineSettings.github_prefix
 const currentRelease=history?.current?.release?history.current:check
 const includesTest=includeTest??(currentRelease?.release_channel==='test')
 async function saveOnlineSettings(){
  setPhase('正在保存 GitHub 加速设置…')
  const data=await call('online.settings.save',{github_prefix:githubPrefix})
  if(!alive.current)return
  setOnlineSettings(data);setGithubPrefixDraft(null);setOnline(null)
  setNotice(data.github_prefix?'GitHub 加速设置已保存。':'已恢复 GitHub 直连。')
 }
 async function checkUpdates(){
  if(prefixChanged){await saveOnlineSettings();if(!alive.current)return}
  setOnline(null);setPhase('正在从 GitHub 查询最新版本…')
  const data=await call('online.check',{include_test:includesTest})
  if(alive.current)setOnline(data)
 }
 async function applyCandidate(next){
  try{await tracked('apply',{candidate:next.candidate,expectedDigest:next.sha256},'检查安装包')}
  catch(error){setCandidate(null);setOnline(null);throw error}
  if(!alive.current)return
  setNotice('更新完成，请刷新页面加载对应资源。');setCandidate(null);setOnline(null)
  read('history')
  read('check')
 }
 async function onlineUpdate(){
  const version=online?.latest?.version
  if(!online?.update_available||!version||!superAdmin)return
  if(!window.confirm(`更新至 ${version}？配置与账号保留，旧版本将自动备份。`))return
  await act(async()=>{
   setCandidate(null)
   const next=await tracked('online.download',{version},'下载安装包')
   if(!alive.current)return
   setCandidate(next)
   if(!next.can_apply){setNotice('安装包已下载，请处理下方提示后再更新。');return}
   await applyCandidate(next)
  })
 }
 const tabs=[['version','版本与兼容'],['files','文件明细'],['update','安装与更新'],['backups','备份与回退'],['configuration','配置导入与导出'],...(superAdmin?[['modules','模块兼容'],['lifecycle','停用与卸载']]:[])]
 const currentRead={version:'check',files:'check',backups:'history',update:'online.settings.get'}[tab]
 const readState=reads[currentRead]
 const checks=releaseChecks(check)
 const interrupted=history?.interrupted||checks.some(row=>row.id==='interrupted')
 const needsReview=checks.some(row=>row.id!=='interrupted'&&row.status!=='pass')
 const rows=tab==='files'?checks.filter(row=>(showPass||row.status!=='pass')&&(!filter||[row.label,row.path,row.detail,row.status].join(' ').toLowerCase().includes(filter.toLowerCase()))):[]
 const pageCount=Math.max(1,Math.ceil(rows.length/50)),currentPage=Math.min(pageIndex,pageCount-1),visibleRows=rows.slice(currentPage*50,currentPage*50+50)
 const table=<div><div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead><tr className="border-b"><th className="p-3">状态</th><th className="p-3">文件与作用</th><th className="p-3">说明与可能影响</th></tr></thead><tbody>{visibleRows.map((row,i)=><tr className="border-b align-top" key={row.id||row.path||i}><td className="p-3 whitespace-nowrap">{labels[row.status]||row.status}</td><td className="p-3"><p>{row.label||row.purpose}</p><p className="break-all text-xs text-muted-foreground">{row.path}</p><p className="text-xs text-muted-foreground">{row.owner}</p></td><td className="p-3 break-words"><p>{row.detail}</p><p className="text-muted-foreground">{row.impact}</p></td></tr>)}</tbody></table>{!rows.length&&<p className="p-4 text-muted-foreground">没有符合筛选的项目。</p>}</div><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground" role="status">第 {currentPage+1} / {pageCount} 页，共 {rows.length} 项</p>{pageCount>1&&<div className="flex gap-2"><Button variant="outline" disabled={currentPage===0} onClick={()=>setPageIndex(currentPage-1)}>上一页</Button><Button variant="outline" disabled={currentPage+1>=pageCount} onClick={()=>setPageIndex(currentPage+1)}>下一页</Button></div>}</div></div>
 if(removed)return <Suspense fallback={<p>正在显示卸载结果…</p>}><ThemeLifecycle removed={removed}/></Suspense>
 return <div className="space-y-5"><div className="flex flex-wrap items-start justify-between gap-3"><h1 className="text-2xl font-semibold">主题管理</h1><Button variant="outline" disabled={busy||Object.values(reads).some(item=>item.pending)} onClick={load}>重新检查</Button></div>
 <div role="tablist" aria-label="主题管理" className="flex flex-wrap gap-2">{tabs.map(([id,label])=><Button key={id} role="tab" disabled={busy} aria-selected={tab===id} variant={tab===id?'default':'outline'} onClick={()=>setTab(id)}>{label}</Button>)}</div>
 {error&&<Alert tone="error">{error}</Alert>}
 {releaseError&&<Alert tone="error"><div className="space-y-2 break-words">
  <p className="font-medium">{releaseError.phase}失败</p><p>{releaseError.reason}</p><p>{releaseError.status_text} {releaseError.next}</p>
  {releaseError.reference&&<p className="text-xs">参考编号：{releaseError.reference}</p>}
  {['unknown','recovery_required'].includes(releaseError.state)&&<Button variant="outline" size="sm" disabled={busy} onClick={showBackups}>查看备份与回退</Button>}
 </div></Alert>}
 {notice&&<Alert>{notice}</Alert>}{busy&&!['configuration','lifecycle'].includes(tab)&&<div role="status" className="space-y-2"><p>{phase||'正在处理，请稍候…'}{phase==='上传安装包'&&uploadPercent!==null?` · ${uploadPercent}%`:''}</p>{uploadPercent!==null&&uploadPercent<100&&<progress aria-label="安装包上传进度" className="h-2 w-full max-w-md" max="100" value={uploadPercent}/>}</div>}
 {readState?.pending&&<p role="status" className="text-sm text-muted-foreground">{readLabels[currentRead]}正在读取…</p>}
 {readState?.error&&<Alert tone="error"><div className="flex flex-wrap items-center gap-3"><p>{readLabels[currentRead]}读取失败：{readState.error}</p><Button variant="outline" size="sm" disabled={busy} onClick={()=>read(currentRead)}>重新读取</Button></div></Alert>}
 {tab==='version'&&<Card>
  <CardHeader><CardTitle>当前版本与运行状态</CardTitle></CardHeader>
  <CardContent className="space-y-4">
   {check&&<>
    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
     <p>主题版本：{versionLabel(check)}</p>
     <p>V10：{check.context?.system_version||'未确认'}</p>
     {check.context?.php_version&&<p>PHP：{check.context.php_version}</p>}
    </div>
    <Alert tone={interrupted||needsReview?'warning':'info'}>{interrupted?'有一次更新尚未完成，请先恢复。':releaseStatus(checks)}</Alert>
   </>}
   <div className="flex flex-wrap gap-2">
    {interrupted&&<Button variant="outline" disabled={busy} onClick={()=>setTab('backups')}>查看备份与回退</Button>}
    {needsReview&&<Button variant="outline" disabled={busy} onClick={()=>{setFilter('');setShowPass(false);setTab('files')}}>查看需要核对的项目</Button>}
    <Button variant="outline" disabled={busy} onClick={()=>act(copyDiagnostics)}>复制排查信息</Button>
   </div>
   {diagnostics&&<details open><summary className="cursor-pointer text-sm">查看排查信息</summary><textarea ref={diagnosticsBox} aria-label="排查信息" readOnly value={diagnostics} className="mt-2 min-h-56 w-full rounded-lg border bg-background p-3 font-mono text-xs"/></details>}
  </CardContent>
 </Card>}
 {tab==='files'&&<Card><CardHeader><CardTitle>文件与依赖明细</CardTitle></CardHeader><CardContent><Input aria-label="搜索文件与作用" placeholder="搜索路径、作用、说明…" value={filter} onChange={e=>setFilter(e.target.value)}/><label className="my-3 flex gap-2 text-sm"><input type="checkbox" checked={showPass} onChange={e=>setShowPass(e.target.checked)}/>显示已通过项目</label>{check&&table}</CardContent></Card>}
 {tab==='update'&&<><OnlineUpdatesPanel current={currentRelease} latest={online} busy={busy} includeTest={includesTest} onIncludeTest={value=>{setIncludeTest(value);setOnline(null)}} onCheck={()=>act(checkUpdates)} onUpdate={onlineUpdate} canUpdate={superAdmin} githubPrefix={githubPrefix} settingsReady={onlineSettings!==null&&!reads['online.settings.get']?.pending} prefixChanged={prefixChanged} onPrefixChange={value=>{setGithubPrefixDraft(value);setOnline(null)}} onSaveSettings={()=>act(saveOnlineSettings)}/><Card><CardHeader><CardTitle>手动安装与更新</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm">也可以直接上传下载的主题安装包 ZIP，检查后确认覆盖更新。配置、账号、密钥和媒体保留，无需再次输入密码。</p>{superAdmin?<><label className="block text-sm">上传主题安装包 ZIP（推荐，最多 80MB）<Input className="mt-2" type="file" accept=".zip,application/zip" disabled={busy} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)act(()=>upload(file))}}/></label>
 <p className="text-xs text-muted-foreground">请选择主题安装包本身，无需解压；包含图文教程的合集和 GitHub Source code 源码包不能在此更新。</p>
 <details className="rounded-lg border p-3" onToggle={e=>{if(e.currentTarget.open&&!localInfo)act(localList)}}><summary className="cursor-pointer text-sm font-medium">备用方式：服务器本地导入</summary><div className="mt-3 min-w-0 space-y-3"><p className="text-sm text-muted-foreground">浏览器上传较慢或受到上传大小限制时，可通过网站面板或 SFTP 将主题安装包 ZIP 放到网站根目录下的：</p><code className="block break-all text-xs">runtime/cra1_theme/distribution/imports/</code><p className="text-xs text-muted-foreground">安装包上传完成后刷新列表，选择文件并导入检查。无需解压，导入后仍需确认覆盖更新；原 ZIP 保留。</p><Button variant="outline" disabled={busy} onClick={()=>act(localList)}>刷新本地安装包</Button><label className="block min-w-0 text-sm">本地主题安装包<Select className="mt-2 w-full" aria-label="本地主题安装包" disabled={busy||!localInfo?.files?.length} value={localId} onChange={e=>{setLocalId(e.target.value);setCandidate(null)}}><option value="">请选择安装包</option>{(localInfo?.files||[]).map(file=><option key={file.id} value={file.id}>{file.name}（{(file.bytes/1024/1024).toFixed(1)} MB）</option>)}</Select></label>{localInfo&&!localInfo.files.length&&<p className="text-xs text-muted-foreground">目录中暂无可读取的安装包，仅列出不超过 80MB 的 ZIP 文件。</p>}<Button variant="outline" disabled={busy||!localId} onClick={()=>act(async()=>{setCandidate(null);setCandidate(await tracked('local.import',{file:localId},'读取本地安装包'))})}>导入并检查</Button></div></details></>:<Alert tone="warning">只有超级管理员可以上传、导入和应用更新。</Alert>}
 {candidate&&<section aria-label="安装包检查结果" className="space-y-3 rounded-lg border p-4">
  <p className="text-sm font-medium">待更新版本：{versionLabel(candidate)}</p>
  {candidate.can_apply ? <Alert>安装包检查通过，可以更新。现有配置和账号会保留。</Alert> : <Alert tone="warning">
   <p>安装包检查未通过，本次操作未切换生效版本。请先处理以下问题，再重新检查。</p>
   <ul className="mt-2 list-disc space-y-1 break-words pl-5">{[...new Set(candidate.blockers?.length?candidate.blockers:['请重新上传完整安装包并检查。'])].map(message=><li key={message}>{message}</li>)}</ul>
  </Alert>}
  {candidate.can_apply&&candidate.warnings?.length>0&&<details className="text-sm">
   <summary className="cursor-pointer">更新后检查建议</summary>
   <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">{[...new Set(candidate.warnings)].map(message=><li key={message}>{message}</li>)}</ul>
  </details>}
  {superAdmin&&<Button data-cui-button-glow="primary" disabled={busy||!candidate.can_apply} onClick={()=>{if(window.confirm('使用当前安装包覆盖更新主题？配置与账号保留，旧版本将备份。'))act(()=>applyCandidate(candidate))}}>确认覆盖更新</Button>}
 </section>}
 </CardContent></Card></>}
 {tab==='backups'&&<Card><CardHeader><CardTitle>备份与回退</CardTitle></CardHeader><CardContent className="space-y-4">{history?.interrupted&&<Alert tone="warning">有中断更新记录。{superAdmin&&<Button disabled={busy} onClick={()=>act(async()=>{await tracked('recover',{},'恢复中断更新');setNotice('主题文件已恢复。');read('history');read('check')})}>恢复中断更新</Button>}</Alert>}{history&&<p>当前版本：{history.current?.release?versionLabel(history.current):'历史部署，尚无发行记录'}</p>}{history?.history?.map(row=><div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"><div><p>{versionLabel(row)}</p><p className="text-xs text-muted-foreground">{new Date(row.created_at*1000).toLocaleString()} · {row.state==='complete'?'已完成':'准备记录'}</p></div>{superAdmin&&row.id===history.current?.history&&<Button variant="outline" disabled={busy} onClick={()=>{if(window.confirm('恢复上一版主题界面与引用？已保存的主题内容保持不变。'))act(async()=>{await tracked('rollback',{history:row.id},'回退主题');setNotice('已回退，请刷新页面。');setOnline(null);setCandidate(null);read('history');read('check')})}}>回退此更新</Button>}</div>)}{history&&!history.history?.length&&<p className="text-muted-foreground">尚无通过安装程序执行的更新记录。</p>}</CardContent></Card>}

 {tab==='configuration'&&<ConfigurationTransfer/>}
 {superAdmin&&tab==='modules'&&<Suspense fallback={<p role="status">正在加载模块兼容…</p>}><ModulePresentation/></Suspense>}
 {superAdmin&&tab==='lifecycle'&&<Suspense fallback={<p role="status">正在加载停用与卸载…</p>}><ThemeLifecycle onBusyChange={setBusy} onRemoved={setRemoved}/></Suspense>}
 </div>
}
