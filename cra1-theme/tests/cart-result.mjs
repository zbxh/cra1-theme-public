/** Result screens must use the authenticated order result, never a callback URL claim. */
import fs from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'
const code=fs.readFileSync(new URL('../source/legacy-assets/cart/20261017-compat-v3/js/orderResult.js',import.meta.url),'utf8')
async function render(search,response){
 let instance,requests=0
 function Vue(options){instance=this;Object.assign(this,options.data());for(const[k,fn]of Object.entries(options.methods))this[k]=fn.bind(this);Object.defineProperty(this,'view',{get:()=>options.computed.view.call(this)});this.$mount=()=>this;options.created.call(this)}
 Vue.prototype={}
 const location={search},lang={pay_text1:'订单提交成功，请尽快付款！订单号',coin_text63:'支付成功',pay_text13:'已取消支付'}
 const window={lang},document={getElementsByClassName:()=>[{}]}
 vm.runInNewContext(code,{window,location,document,Vue,lang,asideMenu:{},topMenu:{},getCommon:async()=>({data:{data:{website_name:'fixture'}}}),orderDetails:async()=>{requests++;return response}})
 window.onload();await new Promise(resolve=>setTimeout(resolve,0));return{view:instance.view,order:instance.order,requests}
}
let checks=0
for(const search of ['','?status=success','?order_id=0','?order_id=abc']){const r=await render(search);assert.equal(r.view.status,'unknown');assert.equal(r.requests,0);assert.equal(r.order,null);checks++}
for(const response of [{data:{status:403}},{data:{status:200,data:{}}},{data:{status:200,data:{order:{id:2,status:'Paid'}}}}]){const r=await render('?order_id=1&status=success',response);assert.equal(r.view.status,'unknown');assert.equal(r.order,null);checks++}
for(const[status,query,expected]of [['Paid','cancel','success'],['Unpaid','success','pending'],['Unpaid','cancel','cancel'],['WaitReview','cancel','pending']]){const r=await render('?order_id=1&status='+query,{data:{status:200,data:{order:{id:1,status}}}});assert.equal(r.view.status,expected);assert.equal(r.view.title.endsWith('订单号'),false);checks++}
for(const[status,title]of [['Cancelled','订单已取消'],['Refunded','订单已退款'],['WaitUpload','等待上传付款凭证'],['WaitReview','付款审核中'],['ReviewFail','付款审核未通过'],['FutureState','请查看订单详情']]){
 const r=await render('?order_id=1&status=success',{data:{status:200,data:{order:{id:1,status}}}});assert.equal(r.view.title,title);assert.notEqual(r.view.status,'success');assert.equal(r.view.title.includes('请尽快付款'),false);checks++
}
console.log(JSON.stringify({status:'passed',checks,production_requests:0}))
