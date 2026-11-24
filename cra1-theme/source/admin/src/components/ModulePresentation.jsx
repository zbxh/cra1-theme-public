import {useEffect,useState} from 'react'
import {Button} from '@ui/button'
import {Card,CardHeader,CardTitle,CardContent} from '@ui/card'
import {Alert} from '@ui/feedback'
import {Input} from '@ui/input'
import {MenuSelect as Select} from '@ui/select'
import {api} from '../lib/api'
import ModuleVerification from './ModuleVerification'

async function request(action, body) {
  const response=await api('api.release.modules.'+action,body,{reauth:false})
  if (response.status!==200) throw new Error(response.msg||'模块设置暂时不可用')
  return response.data.modules
}

const emptyMessage='未发现可设置的第三方服务器模块或代理模块。'

export default function ModulePresentation(){
  const [modules,setModules]=useState(null)
  const [drafts,setDrafts]=useState({})
  const [filter,setFilter]=useState('')
  const [busy,setBusy]=useState(true)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const [verifying,setVerifying]=useState('')

  async function read(){
    setBusy(true);setError('');setNotice('')
    try{setModules(await request('get'));setDrafts({})}
    catch(error){setError(error.message)}
    finally{setBusy(false)}
  }
  useEffect(()=>{read()},[])

  function edit(row, surface, mode){
    setNotice('')
    setDrafts(current=>{
      const previous={cart:row.cart,panel:row.panel}
      return {...current,[row.key]:{...(current[row.key]||{...previous,previous}),[surface]:mode}}
    })
  }

  async function save(event,row){
    event.preventDefault()
    if(busy||!drafts[row.key])return
    setBusy(true);setError('');setNotice('')
    try{
      setModules(await request('save',{key:row.key,...drafts[row.key]}))
      setDrafts(current=>Object.fromEntries(Object.entries(current).filter(([key])=>key!==row.key)))
      setNotice(`已保存 ${row.label} 的显示设置。刷新购物车配置页或产品控制面板即可查看。`)
    }catch(error){setError(error.message)}
    finally{setBusy(false)}
  }

  const query=filter.trim().toLowerCase()
  const rows=modules?.filter(row=>[row.name,row.label].some(value=>value.toLowerCase().includes(query)))||[]
  return <Card>
    <CardHeader><CardTitle>第三方模块兼容</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">每个模块可分别设置购物车和产品控制面板。酷锐A1外壳使用主题的顶栏、侧栏和基础控件样式。遇到显示问题，可以把对应页面切换为完整官方页面。两种方式都沿用 V10 的模块业务流程。</p>
      <div className="flex flex-wrap items-center gap-3">
        <Input className="w-full max-w-sm" aria-label="搜索已安装的模块" placeholder="搜索模块名称或标识" value={filter} onChange={event=>setFilter(event.target.value)}/>
        <Button disabled={busy} variant="outline" onClick={read}>重新读取</Button>
      </div>
      {error&&<Alert tone="danger" role="alert">{error}</Alert>}
      {notice&&<Alert role="status">{notice}</Alert>}
      {modules===null&&busy&&<p role="status" className="text-sm text-muted-foreground">正在读取模块…</p>}
      {modules!==null&&!rows.length&&<p className="text-sm text-muted-foreground">{modules.length?'没有匹配的模块。':emptyMessage}</p>}
      <ul className="space-y-3" aria-label="第三方模块">
        {rows.map(row=>{
          const choice=drafts[row.key]||row
          const changed=choice.cart!==row.cart||choice.panel!==row.panel
          return <li key={row.key} className="rounded-lg border">
            <form aria-label={row.label} className="grid gap-3 p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end" onSubmit={event=>save(event,row)}>
              <div className="min-w-0 self-center">
                <p className="break-words text-sm font-medium">{row.label}</p>
                <p className="break-all text-xs text-muted-foreground">{row.kind==='reserver'?'代理模块':'服务器模块'} · {row.name}</p>
              </div>
              {[['cart','购物车'],['panel','产品控制面板']].map(([surface,label])=><label key={surface} className="grid gap-1 text-sm">
                {label}
                <Select className="w-full" aria-label={label} disabled={busy} value={choice[surface]} onChange={event=>edit(row,surface,event.target.value)}>
                  <option value="cra1">酷锐A1外壳（默认）</option>
                  <option value="official">完整官方页面</option>
                </Select>
              </label>)}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={busy||!changed}>保存</Button>
                <Button type="button" variant="outline" aria-expanded={verifying===row.key} onClick={()=>setVerifying(current=>current===row.key?'':row.key)}>快速验证</Button>
              </div>
            </form>
            {verifying===row.key&&<ModuleVerification moduleKey={row.key} cart={row.cart} panel={row.panel} changed={changed}/>}
          </li>
        })}
      </ul>
    </CardContent>
  </Card>
}
