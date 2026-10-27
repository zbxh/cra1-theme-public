import IconPicker from '../ui/IconPicker'
import { useState } from 'react'
import { Input, Label, Select } from '@ui/input'
import { Alert } from '@ui/feedback'
import { Server, Cloud, Globe, Wallet, Shield, FileText, MessageSquare, Home, ShoppingBag, Settings, Users } from 'lucide-react'

const list=v=>Array.isArray(v)?v:String(v||'').split(',').map(x=>x.trim()).filter(Boolean)
export function MultiChoice({label,options,value,onChange}){
  const selected=list(value),[q,setQ]=useState(''),unknown=selected.filter(v=>!options.some(o=>String(o.value)===String(v)))
  return <div className="space-y-2"><p className="text-sm font-medium">{label}</p>{options.length>8&&<Input aria-label={`搜索${label}`} value={q} placeholder="输入名称搜索…" onChange={e=>setQ(e.target.value)}/>}<div className="choice-grid">{options.filter(o=>o.label.includes(q)).map(o=><label key={o.value} className="choice-chip"><input type="checkbox" checked={selected.map(String).includes(String(o.value))} onChange={e=>onChange(e.target.checked?[...selected,o.value]:selected.filter(v=>String(v)!==String(o.value)))}/><span>{o.label}</span></label>)}</div>{!options.length&&<p className="text-xs text-muted-foreground">暂无可选项，原有选择仍然保留。</p>}{unknown.length>0&&<p className="text-xs text-muted-foreground">另有 {unknown.length} 个历史选择，已保留，可在高级设置中查看。</p>}</div>
}
export const FILTERS=[['area','地区'],['product_name','商品名称'],['instance_name','实例名称'],['billing_cycle','计费方式'],['is_auto_renew','自动续费'],['base_info','基础信息'],['ip','IP 地址'],['os','操作系统'],['active_time','开通时间'],['due_time','到期时间'],['status','状态'],['power_status','运行状态'],['notes','备注']].map(([value,label])=>({value,label}))
const ICONS=[['icon-wodefuwu',Server,'服务器'],['icon-mofang',Cloud,'云服务'],['icon-jiexi',Globe,'网络服务'],['icon-caiwuzhongxin',Wallet,'财务'],['icon-a-20',Shield,'安全'],['icon-a-19',FileText,'文档'],['icon-gongdanzhongxin',MessageSquare,'工单'],['icon-a-1',Home,'首页'],['icon-a-21',ShoppingBag,'购物'],['icon-dingzhixitong',Settings,'设置'],['icon-shimingjiekou',Users,'账户']]
export function MenuIcon({value,onChange,iconStyle,label=''}) { const defaults={'我的资源':'icon-a-7','产品与服务':'icon-a-6','产品管理':'icon-a-6','财务中心':'icon-caiwuzhongxin','账户中心':'icon-a-13','服务与支持':'icon-rengongkefu'};return <IconPicker label="菜单图标" value={value || ''} iconStyle={iconStyle} context="member-sidebar" defaultKey={defaults[label] || 'icon-a-6'} tile={false} onChange={onChange}/> }
export function LanguageNames({value,onChange}){let names={};try{names=typeof value==='string'?JSON.parse(value||'{}'):value||{}}catch{};return <details className="advanced-details"><summary>其他语言名称</summary><div className="grid gap-3 sm:grid-cols-2">{[['zh-cn','简体中文'],['zh-hk','繁体中文'],['en-us','英文']].map(([key,label])=><div key={key}><Label>{label}</Label><Input aria-label={`${label}菜单名称`} value={names[key]||''} onChange={e=>onChange({...names,[key]:e.target.value})}/></div>)}</div></details>}
