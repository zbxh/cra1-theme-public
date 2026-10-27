/** Templates come from the authenticated native module renderer. Keep declared dependencies and order. */
export async function mountModuleScripts(host, { signal, enabled = () => true } = {}) {
  const scripts=Array.from(host.querySelectorAll('script'))
  for(const old of scripts){
    if(signal?.aborted || !host.isConnected)return
    const src=old.getAttribute('src') || '',type=(old.getAttribute('type') || '').toLowerCase()
    if(!enabled(src)){old.remove();continue}
    if(type && !['text/javascript','application/javascript','module'].includes(type))continue
    if(src){const parsed=new URL(src,document.baseURI);if(!['http:','https:'].includes(parsed.protocol))throw new Error('模块资源地址无效，请联系管理员检查模块配置')}
    const next=document.createElement('script')
    Array.from(old.attributes).forEach(a=>next.setAttribute(a.name,a.value))
    next.async=false;next.text=old.text
    await new Promise((resolve,reject)=>{
      const finish=error=>{signal?.removeEventListener('abort',abort);next.onload=next.onerror=null;error?reject(error):resolve()}
      const abort=()=>{next.remove();finish()}
      signal?.addEventListener('abort',abort,{once:true})
      next.onload=()=>finish()
      next.onerror=()=>finish(new Error('模块所需资源未能加载，请重试；如仍失败，请联系管理员'))
      old.parentNode.replaceChild(next,old)
      if(!src && type!=='module')finish()
    })
  }
}
