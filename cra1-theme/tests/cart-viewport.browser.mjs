/** Exercise the shipped cart's real data/computed/resize methods with native Vue. */
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const root=path.resolve(new URL('../..',import.meta.url).pathname),require=createRequire(path.join(root,'cra1-theme/scripts/package.json'));
const {chromium}=require(process.env.CRA1_PLAYWRIGHT_MODULE||'playwright');
const native=process.env.CRA1_NATIVE_REFERENCE_ROOT||root;
const vue=path.join(native,'public/clientarea/template/pc/default/js/common/vue.js');
const source=path.join(root,'cra1-theme/source/legacy-assets/cart/20261017-compat-v3/js/goodsList.js');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});await page.setContent('<div class="template"></div>');
 await page.addScriptTag({path:vue});
 await page.evaluate(()=>{window.NativeVue=window.Vue;window.Vue=function(options){window.cartOptions=options;return {$mount(){}};};window.Vue.prototype={};window.lang={};for(const name of ['asideMenu','topMenu','scrollText','discountCode','eventCode'])window[name]={};});
 await page.addScriptTag({path:source});
 await page.evaluate(()=>{window.onload();window.Vue=window.NativeVue;const o=window.cartOptions;window.cartVm=new Vue({data:o.data,computed:{viewportW:o.computed.viewportW,currentColumns:o.computed.currentColumns,gridStyle:o.computed.gridStyle,limitFromGrid:o.computed.limitFromGrid},methods:{handleViewportChange:o.methods.handleViewportChange}});window.cartVm.gridConf={desktop_columns:2,tablet_columns:3,mobile_columns:1,rows_per_load:2};window.addEventListener('resize',()=>window.cartVm.handleViewportChange());});
 const checks=[];
 for(const [width,columns]of [[1440,2],[900,3],[390,1],[1440,2]]){
  await page.setViewportSize({width,height:900});await page.waitForFunction(w=>innerWidth===w,width);
  await page.evaluate(()=>{window.cartVm.handleViewportChange();return Vue.nextTick();});
  const state=await page.evaluate(()=>({columns:cartVm.currentColumns,style:cartVm.gridStyle['--cart-cols'],limit:cartVm.limitFromGrid}));
  assert.equal(state.columns,columns,'responsive columns at '+width);assert.equal(state.style,String(columns));assert.equal(state.limit,columns*2);checks.push({width,columns,limit:state.limit});
 }
 console.log(JSON.stringify({status:'passed',checks}));
}finally{await browser.close();}
