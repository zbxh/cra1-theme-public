import {Button} from '@ui/button'
import {Card,CardHeader,CardTitle,CardContent} from '@ui/card'
import {Input} from '@ui/input'

const label=data=>data?.version?`${data.version}${data.release_channel==='test'?'（测试版）':''}`:'未登记'

export default function OnlineUpdatesPanel({current,latest,busy,includeTest,onIncludeTest,onCheck,onUpdate,canUpdate,githubPrefix,settingsReady,prefixChanged,onPrefixChange,onSaveSettings}){
 const release=latest?.latest
 return <Card><CardHeader><CardTitle>在线更新</CardTitle></CardHeader><CardContent className="space-y-4">
  <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm">当前版本：{current?label(current):'正在读取'}</p><Button variant="outline" disabled={busy||(canUpdate&&!settingsReady)} onClick={onCheck}>检查最新版本</Button></div>
  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={includeTest} disabled={busy} onChange={e=>onIncludeTest(e.target.checked)}/>包含测试版</label>
  <p className="text-sm text-muted-foreground">从主题 GitHub 发布页获取版本。确认更新后，由服务器下载安装包，自动备份并更新，保留已有配置与账号。</p>
  {canUpdate&&<div className="space-y-2">
   <label className="block text-sm" htmlFor="online-github-prefix">GitHub 加速链接前缀</label>
   <div className="flex flex-wrap items-center gap-2"><Input id="online-github-prefix" type="url" autoComplete="off" spellCheck={false} placeholder="留空直连，例如 https://加速域名/" value={githubPrefix} disabled={busy||!settingsReady} className="min-w-0 flex-1 basis-64" aria-describedby="online-github-prefix-help" onChange={e=>onPrefixChange(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&prefixChanged){e.preventDefault();onSaveSettings()}}}/><Button variant="outline" disabled={busy||!settingsReady||!prefixChanged} onClick={onSaveSettings}>保存加速设置</Button></div>
   <p id="online-github-prefix-help" className="text-xs leading-relaxed text-muted-foreground">填写后自动拼接 GitHub 原地址，清空恢复直连。点击检查最新版本时也会保存修改；若加速服务不支持版本查询，会尝试直连查询，安装包仍使用加速地址下载。</p>
  </div>}
  {latest&&<div className="space-y-3 rounded-lg border p-4" role="status">
   <p className="text-sm font-medium">{!release?'暂无可用版本':latest.update_available?`发现新版本：${label(release)}`:'当前已是最新版本'}</p>
   {release&&<><div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground"><span>可用版本：{label(release)}</span><span>安装包：{(release.bytes/1024/1024).toFixed(1)} MB</span><a className="underline underline-offset-4" href={release.release_url} target="_blank" rel="noopener noreferrer">查看发布说明</a></div>
   {release.notes&&<details><summary className="cursor-pointer text-sm">更新内容</summary><div className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words text-sm leading-relaxed">{release.notes}</div></details>}
   {latest.update_available&&canUpdate&&<Button disabled={busy} onClick={onUpdate}>一键更新至 {release.version}</Button>}</>}
  </div>}
  {!canUpdate&&<p className="text-xs text-muted-foreground">只有超级管理员可以执行更新。</p>}
 </CardContent></Card>
}
