/** Exercise the real cart loader without contacting V10 or a product provider. */
import fs from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'
const source=fs.readFileSync(new URL('../source/legacy-assets/cart/20261012-cart-entry-v1/js/goods.js',import.meta.url),'utf8')
const checks=[]
async function run({params={},address='',cache='{"cart_change_product":1}',config={data:{status:200,data:{content:'<div>fixture configuration</div>'}}},product={data:{status:404}},framed=false}={}){
 const requests=[],errors=[],messages=[],loading={style:{}},root={style:{}},content={innerHTML:''};let instance
 const window={location:new URL(address||'https://fixture.invalid/cart/goods_embed.htm'),addEventListener(){},dispatchEvent(){},__CART_EMBED__:{fail:s=>errors.push(s),markReady:()=>messages.push('ready')}}
 window.history={state:{marker:'retained'},replaceState(state,title,value){assert.equal(state,this.state);window.location=new URL(value,window.location)}}
 window.CRA1ModuleDeps={async ensure(group){assert.equal(group,'config')},async mountScripts(host){assert.equal(host,content);messages.push(host.innerHTML)}}
 window.self=window;window.top=framed?{}:window
 const localStorage={getItem:()=>cache,setItem(){}}
 function Vue(options){instance=this;Object.assign(this,options.data());for(const[k,method]of Object.entries(options.methods))this[k]=method.bind(this);this.$message={error:s=>errors.push(s)};this.$nextTick=fn=>fn?fn():Promise.resolve();this.$mount=()=>{options.mounted.call(this);return this};options.created.call(this)}
 Vue.prototype={}
 const jquery=()=>({html:s=>messages.push(s)});jquery.ajaxSetup=()=>{}
 const context={window,localStorage,Vue,document:{title:'',getElementsByClassName:()=>[root],getElementById:()=>loading,querySelector:selector=>selector==='.config-box .content'?content:null},getUrlParams:()=>({...Object.fromEntries(new URLSearchParams(window.location.search)),...params}),asideMenu:{},topMenu:{},pagination:{},getOrederConfig:async p=>{requests.push(p);return config},apiProductDetail:async()=>product,productGroupSecond:async()=>({data:{data:{list:[]}}}),$:jquery,URLSearchParams,Event:class{},setInterval:()=>1,clearInterval(){}}
 vm.runInNewContext(source,context);window.onload();await new Promise(resolve=>setTimeout(resolve,0));return{requests,errors,messages,instance,location:window.location}
}
for(const params of [{},{id:'0'},{id:'NaN'}]){
 const r=await run({params});assert.equal(r.requests.length,0);assert.equal(r.errors[0],'请选择需要配置的商品。');checks.push('missing or invalid product exits loader without a request')
}
const alias=await run({params:{product_id:'4'},framed:true});assert.equal(alias.requests[0].id,'4');assert.equal(alias.requests[0].flag,false);assert.equal(alias.messages.includes('ready'),true);checks.push('product_id alias keeps embedded configuration in public mode')
for(const page of ['goods','goods_iframe','goods_embed']){
 const r=await run({address:'https://fixture.invalid/cart/'+page+'.htm?product_id=4&embed_nonce=fixture#options'});
 assert.equal(r.location.searchParams.get('id'),'4');assert.equal(r.location.searchParams.get('product_id'),'4');assert.equal(r.location.searchParams.get('embed_nonce'),'fixture');assert.equal(r.location.hash,'#options');assert.equal(r.requests[0].id,'4');checks.push(page+' alias is visible to native module scripts without losing context');
}
const explicit=await run({address:'https://fixture.invalid/cart/goods_iframe.htm?id=5&product_id=4'});assert.equal(explicit.location.searchParams.get('id'),'5');assert.equal(explicit.requests[0].id,'5');checks.push('an explicit native id is not replaced by a link alias');
const failed=await run({params:{id:'4'},config:{data:{status:403,msg:'provider private path /internal/fixture'}}});assert.equal(failed.errors[0],'商品配置暂不可用，请重试或选择其他商品。');assert.equal(failed.messages.length,0);checks.push('unavailable product has a safe error and never reads absent detail')
const missing=await run({params:{id:'4'},product:{data:{status:200,data:{}}}});assert.equal(missing.errors.length,0);assert.equal(missing.instance.content.includes('fixture'),true);checks.push('missing optional product-switcher data preserves configuration')
for(const cache of [null,'{invalid-json']){const r=await run({params:{id:'4'},cache});assert.equal(r.errors.length,0);assert.equal(r.messages.includes('ready'),true);checks.push('absent or invalid legacy cache does not stop the cart')}
const bridge=fs.readFileSync(new URL('../source/legacy-assets/cart/20261017-compat-v3/js/goods_embed.js',import.meta.url),'utf8')
function nativeLocation(search){
 const window={location:new URL('https://fixture.invalid/cart/goods_embed.htm'+search),addEventListener(){},history:{state:{fixture:true},replaceState(state,title,url){assert.deepEqual(state,{fixture:true});window.location=new URL(url,window.location)}}}
 vm.runInNewContext(bridge,{window,URLSearchParams})
 return window.location
}
const normalized=nativeLocation('?product_id=4&embed=1&embed_nonce=fixture#config')
assert.equal(normalized.searchParams.get('id'),'4');assert.equal(normalized.searchParams.get('product_id'),'4');assert.equal(normalized.searchParams.get('embed_nonce'),'fixture');assert.equal(normalized.hash,'#config');checks.push('native module receives id before loading and keeps embed nonce, alias and hash')
assert.equal(nativeLocation('?id=5&product_id=4').searchParams.get('id'),'5');checks.push('explicit native id keeps precedence over alias')
for(const value of ['0','invalid'])assert.equal(nativeLocation('?product_id='+value).searchParams.has('id'),false)
checks.push('invalid product aliases do not become native module ids')
// Exercise the actual iframe bridge when the native product has no billing
// periods, then receives them later. No server or merchant data is changed.
{
 let now=0,nextId=0;const timers=new Map(),messages=[],classes=new Set();
 const productVM={cycleList:[],params:{},qty:1,calcTotalPrice:0,totalPrice:0,preview:[],handlerCart(){},submitOrder(){}};
 const body={scrollHeight:640,classList:{add:c=>classes.add(c),remove:c=>classes.delete(c)}};
 const document={body,documentElement:{scrollHeight:640},getElementById:()=>({style:{}}),querySelectorAll:()=>[{__vue__:productVM}],querySelector:s=>['.cart-embed','.f-order'].includes(s)?{style:{}}:null};
 const window={location:new URL('https://fixture.invalid/cart/goods_embed.htm?id=4&embed=1&embed_nonce=fixture'),addEventListener(){},parent:{postMessage:m=>messages.push(m)},CRA1Shared:{Runtime:{common:()=>({currency_prefix:'¥',currency_suffix:''})}}};
 vm.runInNewContext(bridge,{window,document,location:window.location,URLSearchParams,Date:{now:()=>now},setInterval:(fn,ms)=>{timers.set(++nextId,{fn,ms});return nextId},clearInterval:id=>timers.delete(id)});
 window.__CART_EMBED__.markReady();
 [...timers.values()].find(t=>t.ms===400).fn();
 assert.equal(classes.has('rail-bridged'),false);checks.push('a native VM without periods keeps its native controls visible');
 const poll=[...timers.values()].find(t=>t.ms===800).fn;
 now=12001;poll();poll();
 assert.equal(messages.filter(m=>m.type==='rail-fallback').length,1);
 assert.equal(classes.has('rail-fallback'),true);checks.push('missing periods become one actionable fallback instead of endless loading');
 productVM.cycleList=[{id:1,name:'月付'}];productVM.params.duration_id=1;productVM.calcTotalPrice=76;
 poll();
 assert.equal(messages.at(-1).type,'rail-data');assert.equal(messages.at(-1).payload.price.calcText,'76.00');
 assert.equal(classes.has('rail-bridged'),true);assert.equal(classes.has('rail-fallback'),false);checks.push('late billing data recovers the real calculator without a page reload');
 const count=messages.length;poll();assert.equal(messages.length,count);checks.push('unchanged calculator data does not send duplicate updates');
}
console.log(JSON.stringify({status:'passed',checks:checks.length,results:checks,production_requests:0}))
