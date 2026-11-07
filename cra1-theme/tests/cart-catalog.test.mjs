import fs from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'
import {test} from 'node:test'
const code=fs.readFileSync(new URL('../source/legacy-assets/cart/20261017-compat-v3/js/goodsList.js',import.meta.url),'utf8')
const policy=fs.readFileSync(new URL('../source/legacy-assets/cart/20261012-cart-entry-v1/js/module-policy.js',import.meta.url),'utf8')
const response=data=>({data:{status:200,data}})
const later=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}}
const tick=()=>new Promise(r=>setTimeout(r,0))
function fixture(){
 let page,options
 const reads=[],handlers={first:()=>response({list:[]}),detail:()=>response({product:null}),second:()=>response({list:[]}),products:()=>response({list:[]}),config:()=>response({module:'vendor_custom',content:'<div>native module</div>'})}
 let location=new URL('https://fixture.invalid/cart/goodsList.htm?product_id=7&fpg_id=1&spg_id=2&config=kept')
 const navigate=[]
 location.assign=url=>navigate.push({mode:'assign',url});location.replace=url=>navigate.push({mode:'replace',url})
 const window={innerWidth:390,get location(){return location},history:{replaceState(s,t,url){location=new URL(url,location)},pushState(s,t,url){location=new URL(url,location)}}}
 vm.runInNewContext(policy,{window,URL})
 function Vue(o){options=o;page=this;Object.assign(this,o.data());this.$data=this;this.$refs={};this.$nextTick=fn=>fn?fn():Promise.resolve();for(const[k,f]of Object.entries(o.methods))this[k]=f.bind(this);for(const[k,f]of Object.entries(o.computed))Object.defineProperty(this,k,{get:()=>f.call(this)});this.$mount=()=>this}
 Vue.prototype={}
 const read=(type,...args)=>{reads.push({type,args});return Promise.resolve(handlers[type](...args))}
 vm.runInNewContext(code,{Vue,window,navigator:{userAgent:'fixture'},document:{getElementsByClassName:()=>[{}]},lang:{},asideMenu:{},topMenu:{},scrollText:{},discountCode:{},eventCode:{},sessionStorage:{removeItem(){}},URL,URLSearchParams,AbortController,clearTimeout,clearInterval,
 productGroupFirst:()=>read('first'),apiProductDetail:p=>read('detail',p),productGroupSecond:id=>read('second',id),productGoods:p=>read('products',p),getOrederConfig:p=>read('config',p)})
 window.onload();page.sanitizeHtml=v=>v||'';page.needScroll=()=>{};page.cartConfigReady=false
 return {page,options,reads,handlers,window,navigate}
}
test('deep-link reads overlap and respect validated product category ownership',async()=>{
 const f=fixture(),a=later(),b=later(),c=later();f.page.fpg_id=1;f.page.spg_id=2;f.page.urlProductId=7
 f.handlers.first=()=>a.promise;f.handlers.detail=()=>b.promise;f.handlers.second=()=>c.promise
 const p=f.page.initData();assert.deepEqual(f.reads.map(x=>x.type),['first','detail','second'])
 a.resolve(response({list:[{id:1}]}));b.resolve(response({product:{id:7,product_group_id:2,product_group_id_first:1}}));await tick()
 assert.equal(f.reads.filter(x=>x.type==='products').length,0)
 c.resolve(response({list:[{id:2,type:'normal'}]}));await p
 assert.equal(f.reads.filter(x=>x.type==='second').length,1)
 assert.equal(f.reads.find(x=>x.type==='products').args[0].id,2)
 assert.equal(f.window.location.searchParams.get('product_id'),'7')
})
test('group normalisation preserves the selected product and entry configuration',()=>{
 const f=fixture();f.page.selectedProductId=7;f.page.selectedProduct={id:7}
 f.options.watch['select_first_obj.id'].call(f.page,1);f.options.watch['select_second_obj.id'].call(f.page,2)
 assert.equal(f.page.selectedProductId,7);assert.equal(f.window.location.searchParams.get('product_id'),'7');assert.equal(f.window.location.searchParams.get('config'),'kept')
})
test('stale initial reads cannot replace a newly selected category',async()=>{
 const f=fixture(),a=later();f.handlers.first=()=>a.promise
 const p=f.page.initData();f.page.secondGroupRequestId++;f.page.select_first_obj.id=99
 a.resolve(response({list:[{id:1}]}));await p
 assert.equal(f.page.select_first_obj.id,99);assert.equal(f.page.first_group_list.length,0);assert.equal(f.reads.some(x=>x.type==='products'),false)
})
test('a stale category hint is checked instead of trusted over product ownership',async()=>{
 const f=fixture();f.page.fpg_id=1;f.page.spg_id=2;f.page.urlProductId=7
 f.handlers.first=()=>response({list:[{id:1},{id:3}]});f.handlers.detail=()=>response({product:{id:7,product_group_id:4,product_group_id_first:3}})
 f.handlers.second=id=>response({list:[{id:id===1?2:4,type:'normal'}]})
 await f.page.initData();assert.equal(f.page.select_first_obj.id,3);assert.equal(f.page.select_second_obj.id,4);assert.equal(f.reads.find(x=>x.type==='products').args[0].id,4)
})
test('failed deep-link details remain retryable rather than choosing another product',async()=>{
 const f=fixture();f.page.urlProductId=7;f.handlers.detail=()=>Promise.reject(new Error('private backend'))
 await f.page.initData();assert.match(f.page.catalogError,/重试/);assert.equal(f.page.urlProductId,7);assert.equal(f.page.selectedProductId,0);assert.equal(f.reads.some(x=>x.type==='products'),false)
})
test('catalog zero placeholders differ from explicit free products and zero discounts',()=>{
 const f=fixture()
 for(const module of [{module:'mf_cloud'},{module:null,res_module:'cloud_service'}])assert.equal(f.page.catalogPriceKnown({...module,price:'0.00',pay_type:'recurring_prepayment'}),false)
 assert.equal(f.page.catalogPriceKnown({res_module:'cloud_service',pay_type:'free',price:'0.00'}),true)
 assert.equal(f.page.catalogPriceKnown({res_module:'cloud_service',price:'41.00'}),true)
 assert.equal(f.page.catalogPriceKnown({module:'mf_cloud',price:'41.00',price_discounted:0}),true)
 assert.equal(f.page.catalogPriceAmount({price:'41.00',price_discounted:0}),0)
 for(const price of ['',null,undefined,'bad',-1])assert.equal(f.page.catalogPriceKnown({price}),false)
})
test('only integrated products create a configuration frame regardless of viewport',()=>{
 const f=fixture();f.page.selectedProductId=7;f.page.selectedProduct={id:7,module:'mf_cloud'};f.page.configState='loading';f.page.embedNonce='test-frame'
 f.page.$data.__viewportW=390
 assert.equal(f.page.isMobileCart,true);assert.match(f.page.embedSrc,/goods_embed\.htm/);assert.match(f.page.embedSrc,/embed_nonce=test-frame/)
 assert.equal(f.options.methods.loadMobileConfig,undefined)
 f.page.$data.__viewportW=900;assert.equal(f.page.isMobileCart,true)
 f.page.$data.__viewportW=1440;assert.equal(f.page.isMobileCart,false)
 f.page.selectedProduct={id:7,mode:'only_api',res_module:'cloud_service'};assert.equal(f.page.embedSrc,'')
})
test('third-party selection uses the native page without creating a calculator or frame',()=>{
 const f=fixture();f.page.entryProductId=7
 f.page.doSelectProduct({id:7,module1:'direct_admin'})
 assert.equal(f.navigate.length,1);assert.equal(f.navigate[0].mode,'assign');assert.match(f.navigate[0].url,/\/cart\/goods\.htm\?/)
 assert.equal(f.page.selectedProductId,0);assert.equal(f.page.configState,'idle')
})
test('a third-party deep link replaces the intermediate list and retains edit context',()=>{
 const f=fixture();f.page.entryProductId=7
 f.page.doSelectProduct({id:7,mode:'only_api',res_module:'cloud_service'},'replace')
 assert.equal(f.navigate[0].mode,'replace');const target=new URL(f.navigate[0].url,f.window.location)
 assert.equal(target.searchParams.get('id'),'7');assert.equal(target.searchParams.get('config'),'kept')
})
test('an ordinary category listing does not auto-open its first third-party card',async()=>{
 const f=fixture();f.page.cartConfigReady=true;f.page.urlProductId=0;f.page.select_second_obj={id:2,type:'normal'}
 await f.page.applyDefaultSelection([{id:7,module:'direct_admin',stock_control:0}])
 assert.equal(f.navigate.length,0);assert.equal(f.page.selectedProductId,0);assert.equal(f.page.configState,'idle')
})
test('missing catalogue metadata is resolved using the actual config response',async()=>{
 const f=fixture();f.page.entryProductId=7
 await f.page.doSelectProduct({id:7},'replace')
 assert.equal(f.reads[0].args[0].flag,false);assert.equal(f.navigate.length,1);assert.match(f.navigate[0].url,/goods\.htm/)
})
test('an unnamed native response is not resolved recursively',async()=>{
 const f=fixture();f.page.entryProductId=7;f.handlers.config=()=>response({module:'',content:'<div>hook module</div>'})
 await f.page.doSelectProduct({id:7},'replace');assert.equal(f.reads.length,1);assert.equal(f.navigate.length,1)
})
test('a stale module lookup cannot replace the product selected afterward',async()=>{
 const f=fixture(),a=later();f.page.entryProductId=7;f.handlers.config=()=>a.promise
 const first=f.page.doSelectProduct({id:7},'replace')
 f.page.doSelectProduct({id:7,module:'direct_admin'})
 a.resolve(response({module:'mf_cloud',content:'<div>stale</div>'}));await first
 assert.equal(f.navigate.length,1);assert.equal(f.page.selectedProductId,0)
})
test('a failed module lookup stays on the list and is retryable',async()=>{
 const f=fixture();f.handlers.config=()=>Promise.reject(new Error('private provider failure'))
 await f.page.doSelectProduct({id:7});assert.equal(f.navigate.length,0);assert.match(f.page.catalogError,/重试/)
})
test('changing categories invalidates an unfinished module lookup',async()=>{
 const f=fixture(),a=later();f.handlers.config=()=>a.promise
 const task=f.page.doSelectProduct({id:7});f.page.resetProductSelection()
 a.resolve(response({module:'vendor_custom',content:'<div>old category</div>'}));await task
 assert.equal(f.navigate.length,0);assert.equal(f.page.selectedProductId,0)
})
