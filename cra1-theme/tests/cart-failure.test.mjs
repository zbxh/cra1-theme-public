import fs from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'
import {test} from 'node:test'
const code=fs.readFileSync(new URL('../source/legacy-assets/cart/20261012-cart-entry-v1/js/shoppingCar.js',import.meta.url),'utf8')
const errorCode=fs.readFileSync(new URL('../../public/cra1-shared/src/errors.js',import.meta.url),'utf8')
const settle=()=>new Promise(resolve=>setTimeout(resolve,0))
function fixture(){
 let instance,config,list;const submitted=[],warnings=[]
 const window={CRA1Shared:{Runtime:{common:()=>({website_name:'fixture'})}}}
 vm.runInNewContext(errorCode,window)
 function Vue(options){instance=this;Object.assign(this,options.data());Object.assign(this,{$forceUpdate(){},$message:{warning:v=>warnings.push(v),error:v=>warnings.push(v)}});for(const[k,fn]of Object.entries(options.methods))this[k]=fn.bind(this);for(const[k,fn]of Object.entries(options.computed))Object.defineProperty(this,k,{get:()=>fn.call(this)});this.$mount=()=>this}
 Vue.prototype={}
 const location={href:'/cart/shoppingCar.htm'}
 const env={window,Vue,location,localStorage:{getItem:()=>'{invalid'},document:{title:'',getElementsByClassName:()=>[{}]},lang:{},asideMenu:{},topMenu:{},discountCode:{},eventCode:{},sessionStorage:{},setTimeout:fn=>{submitted.push(fn);return 1},clearTimeout(){},cartList:()=>list(),configOption:()=>config()}
 vm.runInNewContext(code,env);window.onload()
 return{page:instance,location,submitted,warnings,config:fn=>{config=fn},list:fn=>{list=fn}}
}
const quote={preview:[],price:'8.00',base_price:'8.00',price_total:'8.00'}
const item=()=>({position:0,product_id:4,qty:1,config_options:{},customfield:{},quoteRequest:0,priceLoading:false,info:null})
test('cart first-load failure is a retryable outage, and a later successful list clears it',async()=>{
 const f=fixture();f.list(()=>Promise.reject(new Error('provider private')));f.page.getCartList();await settle()
 assert.equal(f.page.listLoding,false);assert.match(f.page.listError,/重新|重试/);assert.equal(f.page.checkoutBlocked,true)
 assert.equal(f.page.totalPrice,null)
 f.list(()=>Promise.resolve({data:{data:{list:[]}}}));f.page.getCartList();await settle()
 assert.equal(f.page.listError,'');assert.equal(f.page.showList.length,0)
 assert.equal(f.page.totalPrice,0)
})
test('failed quote cannot become zero currency or permit checkout; retry recovers valid free quotes too',async()=>{
 const f=fixture(),row=item();f.page.showList=[row];f.page.checkedCities=[0]
 f.config(()=>Promise.reject({data:{status:400,msg:'魔方云 /www/private.php'}}));f.page.getConfigOption(row);await settle()
 assert.equal(row.calcItemPrice,null);assert.equal(f.page.totalPrice,null);assert.equal(f.page.checkoutBlocked,true);assert.match(row.priceError,/重新加载|重试|客服/)
 f.page.goSettle();assert.equal(f.submitted.length,0);assert.equal(f.location.href,'/cart/shoppingCar.htm')
 f.config(()=>Promise.resolve({data:{data:{...quote,price:'0.00',price_total:'0.00'}}}));f.page.getConfigOption(row);await settle()
 assert.equal(row.priceError,'');assert.equal(f.page.totalPrice,0);assert.equal(f.page.checkoutBlocked,false)
})
test('missing/null prices remain unknown, never guessed as free',async()=>{
 for(const price_total of [null,undefined,'','invalid']){
  const f=fixture(),row=item();f.page.showList=[row];f.page.checkedCities=[0];f.config(()=>Promise.resolve({data:{data:{...quote,price_total}}}));f.page.getConfigOption(row);await settle()
  assert.equal(f.page.checkoutBlocked,true);assert.equal(row.calcItemPrice,null)
 }
})
test('late quote success or failure cannot overwrite a newer quote',async()=>{
 const pending=[],f=fixture(),row=item();f.page.showList=[row];f.page.checkedCities=[0]
 f.config(()=>new Promise((resolve,reject)=>pending.push({resolve,reject})))
 f.page.getConfigOption(row);f.page.getConfigOption(row);pending[1].resolve({data:{data:quote}});await settle();pending[0].reject(new Error('late'));await settle()
 assert.equal(row.priceError,'');assert.equal(row.calcItemPrice,8);assert.equal(f.page.checkoutBlocked,false)
})
test('common configuration comes from the filtered runtime, not malformed browser cache',()=>{
 const f=fixture();f.page.getCommonData();assert.equal(f.page.commonData.website_name,'fixture')
})

function catalogFixture(){
 let instance,first=()=>Promise.reject(new Error('private')),second=first,products=first
 function Vue(options){instance=this;Object.assign(this,options.data());for(const[k,fn]of Object.entries(options.methods))this[k]=fn.bind(this);for(const[k,fn]of Object.entries(options.computed))Object.defineProperty(this,k,{get:()=>fn.call(this)});this.$mount=()=>this;this.$nextTick=fn=>fn()}
 Vue.prototype={}
 const window={},env={window,Vue,navigator:{userAgent:'fixture'},lang:{},asideMenu:{},topMenu:{},scrollText:{},discountCode:{},eventCode:{},document:{getElementsByClassName:()=>[{}],documentElement:{scrollTop:0,clientHeight:500,scrollHeight:1000},body:{scrollTop:0}},localStorage:{},productGroupFirst:()=>first(),productGroupSecond:id=>second(id),productGoods:params=>products(params)}
 const source=fs.readFileSync(new URL('../source/legacy-assets/cart/20261017-compat-v3/js/goodsList.js',import.meta.url),'utf8')
 vm.runInNewContext(source,env);window.onload()
 return{page:instance,first:fn=>{first=fn},second:fn=>{second=fn},products:fn=>{products=fn}}
}
test('catalog outage exits loading without claiming no products; retry clears the failure',async()=>{
 const f=catalogFixture();await f.page.initData()
 assert.match(f.page.catalogError,/暂时无法读取商品分类/);assert.equal(f.page.goodSLoading,false);assert.equal(f.page.scrollDisabled,true)
 f.first(()=>Promise.resolve({data:{data:{list:[]}}}));await f.page.retryCatalog()
 assert.equal(f.page.catalogError,'');assert.equal(f.page.goodSLoading,false)
})
test('catalog pagination failure preserves loaded products and retries the failed page',async()=>{
 const f=catalogFixture();f.page.goodsList=[{id:3}];f.page.goodsParmas.page=2;f.page.cartConfigReady=false
 const requested=[];f.products(params=>{requested.push(params.page);return Promise.reject(new Error('private'))})
 await f.page.getProductGoodList();assert.equal(f.page.goodsList[0].id,3);assert.equal(f.page.goodSLoading,false);assert.equal(f.page.searchLoading,false);assert.match(f.page.catalogError,/暂时无法读取商品/)
 f.products(params=>{requested.push(params.page);return Promise.resolve({data:{data:{list:[]}}})});await f.page.retryCatalog()
 assert.deepEqual(requested,[2,2]);assert.equal(f.page.goodsList.length,1);assert.equal(f.page.catalogError,'')
})
test('an old category failure cannot replace a newer category result',async()=>{
 const f=catalogFixture(),pending=[];f.second(()=>new Promise((resolve,reject)=>pending.push({resolve,reject})))
 f.page.select_first_obj.id=1;const older=f.page.getProductGroup_second(1)
 f.page.select_first_obj.id=2;const newer=f.page.getProductGroup_second(2)
 pending[1].resolve({data:{data:{list:[]}}});await newer;pending[0].reject(new Error('late private'));await older
 assert.equal(f.page.catalogError,'');assert.equal(f.page.select_first_obj.id,2);assert.equal(f.page.secondLoading,false)
})
