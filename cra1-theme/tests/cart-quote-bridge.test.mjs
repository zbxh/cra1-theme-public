import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {test} from 'node:test';

const code=fs.readFileSync(new URL('../source/legacy-assets/cart/20261017-compat-v3/js/goods_embed.js',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
function fixture(module='mf_cloud', nativeMethods={}){
 const hooks=[],requests=[],messages=[],timers=new Map(),listeners={},windowListeners={},watchers=[];
 let timerId=0;
 const request=(method,url,body)=>new Promise((resolve,reject)=>requests.push({method,url,body:JSON.parse(JSON.stringify(body)),resolve,reject}));
 const Axios={post:(url,body)=>request('POST',url,body),put:(url,body)=>request('PUT',url,body)};
 const Vue={mixin:h=>hooks.push(h)},originalPost=Axios.post;
 let product;
 const root={style:{},busy:'true',setAttribute(name,value){if(name==='aria-busy')this.busy=value;}};
 const document={body:{scrollHeight:640,classList:{add(){},remove(){}}},documentElement:{scrollHeight:640},getElementById:()=>({style:{}}),querySelector:selector=>selector==='.cart-embed'?root:null,querySelectorAll:selector=>selector==='.m-cloud-m, .m-dcim-m, .template'?[{__vue__:product}]:[],addEventListener:(type,listener)=>{listeners[type]=listener}};
 const window={location:new URL('https://example.invalid/cart/goods_embed.htm?id=501&embed=1'),addEventListener:(type,listener)=>{windowListeners[type]=listener;},parent:{postMessage:value=>messages.push(value)},Vue,Axios,lang:{set_pas:'手动输入'},CRA1Shared:{Runtime:{common:()=>({})}}};
 vm.runInNewContext(code,{window,document,location:window.location,URLSearchParams,Promise,setInterval:(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId;},clearInterval:id=>timers.delete(id),setTimeout,Date,MouseEvent:class{}});
 window.__CART_EMBED__.prepare(module);
 product={qty:1,params:{duration_id:21,image_id:41},cycleList:[{id:21,name:'月付'}],totalPrice:0,calcTotalPrice:0,preview:[],loadingPrice:false,
  $watch(read,notify){watchers.push({read,notify,previous:read.call(this)});},
  $options:{methods:{handlerCart(){},submitOrder(){},async changeConfig(){
   this.loadingPrice=true;try{const response=await Axios.post('/product/501/config_option',{qty:this.qty,config_options:{...this.params}});this.calcTotalPrice=response.data.data.price_total;this.totalPrice=response.data.data.price;}
   catch(_){}finally{this.loadingPrice=false;}
  },...nativeMethods}}};
 for(const hook of hooks)hook.beforeCreate.call(product);
 Object.assign(product,product.$options.methods);
 for(const hook of hooks)hook.created?.call(product);
 window.__CART_EMBED__.nativeModule=module==='vendor_custom';window.__CART_EMBED__.markReady();
 assert.equal(root.busy,'false','mounted embed releases its loading state');
 const poll=()=>[...timers.values()].find(t=>t.ms===800)?.fn();
 const resolve=(index,price)=>requests[index].resolve({data:{status:200,data:{price,price_total:price}}});
 const submit=(type,requestId)=>windowListeners.message({origin:window.location.origin,data:{v:1,source:'cart-parent',type,productId:501,nonce:'',requestId}});
 const updateWatches=()=>watchers.forEach(watcher=>{
  const value=watcher.read.call(product);
  if(value!==watcher.previous){watcher.previous=value;watcher.notify.call(product);}
 });
 return{product,requests,messages,poll,resolve,submit,timers,updateWatches,Axios,originalPost,hooks,listeners};
}
test('native quote failures stay unavailable; retry and a real zero quote recover',async()=>{
 const f=fixture();let promise=f.product.changeConfig();await tick();f.resolve(0,10);await promise;f.poll();assert.equal(f.messages.at(-1).payload.availability,'ready');
 f.product.qty=2;promise=f.product.changeConfig();await tick();f.requests[1].reject(new Error('network failure'));await promise;f.poll();
 assert.equal(f.messages.at(-1).payload.availability,'error');assert.equal(f.messages.at(-1).payload.price.calcText,'');
 promise=f.product.changeConfig();await tick();f.resolve(2,0);await promise;f.poll();assert.equal(f.messages.at(-1).payload.availability,'ready');assert.equal(f.messages.at(-1).payload.price.calcText,'0.00');
});
test('a DCIM period failure before the first quote exposes the retry and recovers in place',async()=>{
 const f=fixture('mf_dcim',{
  async getCycleList(){
   this.isInit=true;this.loadingPrice=true;
   try{
    const response=await f.Axios.post('/product/501/mf_dcim/duration',{id:501});
    this.cycleList=response.data.data;this.params.duration_id=this.cycleList[0].id;
    this.changeConfig();
   }catch(_){}
  },
 });
 f.product.cycleList=[];
 const initial=f.product.getCycleList();
 f.requests[0].resolve({data:{status:200,data:[]}});
 await initial;
 assert.equal(f.messages.at(-1).payload.availability,'error');
 assert.equal(f.messages.at(-1).payload.durations.length,0);
 assert.equal(f.messages.at(-1).payload.price.calcText,'');
 assert.equal(f.product.loadingPrice,false);
 f.submit('rail-requote','retry');
 assert.equal(f.requests[1].url,'/product/501/mf_dcim/duration');
 f.requests[1].resolve({data:{status:200,data:[{id:21,name:'月付'}]}});
 await tick();
 assert.equal(f.requests[2].url,'/product/501/config_option');
 f.resolve(2,20);
 await f.product.__cra1Quote.running;
 assert.equal(f.messages.at(-1).payload.availability,'ready');
 assert.equal(f.messages.at(-1).payload.price.calcText,'20.00');
});
test('rapid configuration changes retain native methods but serialize and coalesce quotes',async()=>{
 const f=fixture();f.product.qty=2;const finished=f.product.changeConfig();await tick();
 f.product.qty=3;f.product.changeConfig();f.product.qty=4;f.product.changeConfig();assert.equal(f.requests.length,1);
 f.resolve(0,20);await tick();assert.equal(f.requests.length,2);assert.equal(f.requests[1].body.qty,4);f.poll();assert.equal(f.messages.at(-1).payload.availability,'loading');
 f.resolve(1,40);await finished;f.poll();assert.equal(f.messages.at(-1).payload.price.calcText,'40.00');assert.equal(f.messages.at(-1).payload.qty.cur,4);
 f.product.params.image_id=42;f.poll();assert.equal(f.messages.at(-1).payload.availability,'error');
});
test('unknown third-party modules do not acquire a quote wrapper or Vue mixin',()=>{
 const f=fixture('vendor_custom');assert.equal(f.hooks.length,0);assert.equal(f.Axios.post,f.originalPost);
 assert.equal(f.messages.at(-1).type,'rail-fallback');
 assert.deepEqual(f.listeners,{});
});
test('cloud checkout passes the current manual password through native validation',()=>{
 const validated=[];
 const {product}=fixture('mf_cloud',{
  changeInput(value){validated.push(value);this.hasLen=value.length>=6;},
  formatData(proceed){return [this.hasLen,proceed];},
 });
 product.login_way='手动输入';product.hasLen=true;product.params.password='';
 assert.deepEqual(product.formatData(true),[false,true]);
 product.params.password='Example1';
 assert.deepEqual(product.formatData(false),[true,false]);
 product.login_way='随机生成';product.params.password='';
 assert.deepEqual(product.formatData(true),[true,true]);
 assert.deepEqual(validated,['','Example1']);
});
test('provisioning fields can change during or after a quote without repricing',async()=>{
 const f=fixture();
 Object.assign(f.product.params,{password:'Example1',re_password:'Example1',name:'host-one',auto_renew:false});
 const pending=f.product.changeConfig();await tick();
 Object.assign(f.product.params,{password:'Example2',re_password:'Example2',name:'host-two',notes:'fixture',auto_renew:true,port:2122,security_group_id:5});
 f.resolve(0,15);await pending;f.poll();
 assert.equal(f.messages.at(-1).payload.availability,'ready');
 assert.equal(f.messages.at(-1).payload.price.calcText,'15.00');
 assert.equal(f.requests[0].body.config_options.password,'Example1','native request is preserved');
 assert.doesNotMatch(f.product.__cra1Quote.selection,/Example|host-one|host-two/);
 assert.equal(f.requests.length,1);
 f.product.params.app_preset_id=2;f.poll();
 assert.equal(f.messages.at(-1).payload.availability,'error','paid configuration still invalidates the earlier quote');
});
test('cloud rechecks native SSH compatibility once when a key becomes present or is removed',async()=>{
 const f=fixture();const initial=f.product.changeConfig();await tick();f.resolve(0,12);await initial;
 f.product.params.ssh_key_id=3;f.updateWatches();await tick();
 assert.equal(f.requests[1].body.config_options.ssh_key_id,3);
 f.resolve(1,12);await f.product.__cra1Quote.running;
 f.product.params.ssh_key_id=4;f.updateWatches();f.poll();
 assert.equal(f.requests.length,2);assert.equal(f.messages.at(-1).payload.availability,'ready');
 f.product.params.ssh_key_id='';f.updateWatches();await tick();
 f.resolve(2,12);await f.product.__cra1Quote.running;
 assert.equal(f.messages.at(-1).payload.availability,'ready');
});
test('native validation settles each blocked action immediately without leaving a timer',async()=>{
 const attempts=[];
 const f=fixture('mf_cloud',{
  changeInput(value){this.hasLen=value.length>=6;},
  formatData(){if(this.hasLen)return true;this.showPas=true;},
  handlerCart(){if(this.formatData()===true)attempts.push('add');},
  submitOrder(){if(this.formatData()===true)attempts.push('buy');},
  changeCart(){if(this.formatData()===true)attempts.push('save');},
 });
 const pending=f.product.changeConfig();await tick();f.resolve(0,10);await pending;
 f.product.params.password='';f.product.login_way='手动输入';f.product.hasLen=true;
 for(const type of ['rail-add','rail-buy','rail-save']){
  f.submit(type,type);
  const reply=f.messages.at(-1);
  assert.equal(reply.type,type==='rail-add'?'rail-added':'rail-action-result');
  assert.equal(reply.requestId,type);assert.equal(reply.reason,'rejected');
  assert.equal([...f.timers.values()].some(timer=>timer.ms===60),false);
 }
 assert.equal(f.product.showPas,true);assert.deepEqual(attempts,[]);
 f.product.params.password='Example1';f.submit('rail-add','retry');
 assert.deepEqual(attempts,['add']);
});
test('a quote that changed before an action is acknowledged with the current price state',async()=>{
 let submitted=false;
 const f=fixture('mf_cloud',{handlerCart(){submitted=true;}});
 const pending=f.product.changeConfig();await tick();f.resolve(0,10);await pending;
 f.product.params.image_id=42;f.submit('rail-add','stale');
 assert.equal(submitted,false);
 assert.equal(f.messages.at(-2).payload.availability,'error');
 assert.equal(f.messages.at(-1).requestId,'stale');assert.equal(f.messages.at(-1).reason,'quote');
});
test('cart edit failure clears a native loading flag and leaves the same item retryable',async()=>{
 const f=fixture('mf_cloud',{
  changeCart(){this.dataLoading=true;return f.Axios.put('/cart/0',{product_id:501,position:0}).catch(()=>{});},
 });
 const pending=f.product.changeConfig();await tick();f.resolve(0,10);await pending;
 f.submit('rail-save','first');assert.equal(f.product.dataLoading,true);
 f.requests[1].reject({data:{status:400,msg:'cart fixture'}});await tick();
 assert.equal(f.product.dataLoading,false);
 assert.equal(f.messages.at(-2).payload.availability,'ready');
 assert.equal(f.messages.at(-1).reason,'rejected');
 f.submit('rail-save','retry');
 assert.equal(f.requests[2].method,'PUT');assert.equal(f.requests[2].url,'/cart/0');
});
test('only real edits in the configurator report pending changes',()=>{
 const f=fixture(),target={closest:selector=>selector==='.config-box .content'?{}:null};
 f.listeners.input({type:'input',isTrusted:false,target});
 assert.equal(f.messages.some(message=>message.type==='config-dirty'),false);
 f.listeners.input({type:'input',isTrusted:true,target});
 assert.equal(f.messages.at(-1).type,'config-dirty');
 assert.equal(f.messages.at(-1).dirty,true);
});
