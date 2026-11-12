import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {test} from 'node:test';

const code=fs.readFileSync(new URL('../source/legacy-assets/cart/20261017-compat-v3/js/goods_embed.js',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
function fixture(module='mf_cloud'){
 const hooks=[],requests=[],messages=[],timers=[];
 const Axios={post(url,body){return new Promise((resolve,reject)=>requests.push({url,body:JSON.parse(JSON.stringify(body)),resolve,reject}));}};
 const Vue={mixin:h=>hooks.push(h)},originalPost=Axios.post;
 let product;
 const document={body:{scrollHeight:640,classList:{add(){},remove(){}}},documentElement:{scrollHeight:640},getElementById:()=>({style:{}}),querySelector:()=>({style:{}}),querySelectorAll:selector=>selector==='.m-cloud-m, .m-dcim-m, .template'?[{__vue__:product}]:[]};
 const window={location:new URL('https://example.invalid/cart/goods_embed.htm?id=501&embed=1'),addEventListener(){},parent:{postMessage:value=>messages.push(value)},Vue,Axios,CRA1Shared:{Runtime:{common:()=>({})}}};
 vm.runInNewContext(code,{window,document,location:window.location,URLSearchParams,Promise,setInterval:(fn,ms)=>{timers.push({fn,ms});return timers.length;},clearInterval(){},setTimeout,Date});
 window.__CART_EMBED__.prepare(module);
 product={qty:1,params:{duration_id:21,image_id:41},cycleList:[{id:21,name:'月付'}],totalPrice:0,calcTotalPrice:0,preview:[],loadingPrice:false,
  $options:{methods:{handlerCart(){},submitOrder(){},async changeConfig(){
   this.loadingPrice=true;try{const response=await Axios.post('/product/501/config_option',{qty:this.qty,config_options:{...this.params}});this.calcTotalPrice=response.data.data.price_total;this.totalPrice=response.data.data.price;}
   catch(_){}finally{this.loadingPrice=false;}
  }}}};
 for(const hook of hooks)hook.beforeCreate.call(product);
 Object.assign(product,product.$options.methods);window.__CART_EMBED__.nativeModule=module==='vendor_custom';window.__CART_EMBED__.markReady();
 const poll=()=>timers.find(t=>t.ms===800)?.fn();
 const resolve=(index,price)=>requests[index].resolve({data:{status:200,data:{price,price_total:price}}});
 return{product,requests,messages,poll,resolve,Axios,originalPost,hooks};
}
test('native quote failures stay unavailable; retry and a real zero quote recover',async()=>{
 const f=fixture();let promise=f.product.changeConfig();await tick();f.resolve(0,10);await promise;f.poll();assert.equal(f.messages.at(-1).payload.availability,'ready');
 f.product.qty=2;promise=f.product.changeConfig();await tick();f.requests[1].reject(new Error('network failure'));await promise;f.poll();
 assert.equal(f.messages.at(-1).payload.availability,'error');assert.equal(f.messages.at(-1).payload.price.calcText,'');
 promise=f.product.changeConfig();await tick();f.resolve(2,0);await promise;f.poll();assert.equal(f.messages.at(-1).payload.availability,'ready');assert.equal(f.messages.at(-1).payload.price.calcText,'0.00');
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
});
