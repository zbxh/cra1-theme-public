import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {test} from 'node:test';

const root=new URL('../../',import.meta.url);
const read=path=>fs.readFileSync(new URL(path,root),'utf8');
const componentPath='public/clientarea/template/pc/cra1/components/cra1EventCode/eventCode.js';
const source=read(componentPath);
const plain=value=>JSON.parse(JSON.stringify(value));
const settle=()=>new Promise(resolve=>setTimeout(resolve,0));
function component(api){
  const env={eventPromotion:api,lang:{goods_text1:'优惠',goods_text2:'满',goods_text3:'减',goods_text6:'不使用活动',goods_text7:'不可同时使用会员折扣',topMenu_text5:'提示'}};
  vm.runInNewContext(source+'\nglobalThis.component=eventCode;',env);
  const changes=[],errors=[],alerts=[];
  const definition=env.component;
  const page={...definition.data(),product_id:4,qty:1,amount:84,billing_cycle_time:2592000,id:'',level_tip:true,
    $emit:(name,data)=>changes.push({name,...plain(data)}),$message:{error:value=>errors.push(value)},$alert:value=>alerts.push(value)};
  for(const [name,fn] of Object.entries(definition.methods))page[name]=fn.bind(page);
  for(const [name,fn] of Object.entries(definition.computed))Object.defineProperty(page,name,{get:()=>fn.call(page)});
  return{page,changes,errors,alerts,definition};
}
const activity={id:41,type:'percent',value:10,full:0,exclude_with_client_level:1};
const available=(list=[activity],placement='bottom')=>({data:{list,addon_event_promotion_does_not_participate:placement}});

test('native flat activity success preserves selection and never changes the upstream list',async()=>{
  const response=available(),f=component(()=>Promise.resolve(response));
  await f.page.getEventList();
  assert.equal(f.page.eventId,41);assert.equal(f.page.options.length,2);
  assert.equal(response.data.list.length,1);assert.equal(response.data.status,undefined);
  assert.deepEqual(f.changes,[{name:'change',id:41,discount:0}]);assert.equal(f.alerts.length,1);
  f.page.amount=168;await f.page.getEventList();assert.equal(f.alerts.length,1,'same activity exclusion is only shown once');
});
test('native no-selection placement and an existing activity id retain official behavior',async()=>{
  const f=component(()=>Promise.resolve(available([activity,{...activity,id:42}],'top')));
  await f.page.getEventList();assert.equal(f.page.eventId,'');assert.equal(f.page.options[0].id,0);
  f.page.id=42;f.page.qty=2;await f.page.getEventList();assert.equal(f.page.eventId,42);
});
for(const [label,failure] of [
  ['unlicensed',{data:{status:400,msg:'功能未授权'}}],
  ['http503',{response:{status:503,data:{msg:'SQLSTATE /private/theme.php'}}}],
  ['network',new Error('Network Error /private/server.php')],
])test('optional '+label+' clears only activity state without a toast',async()=>{
  const f=component(()=>Promise.reject(failure));
  Object.assign(f.page,{options:[activity],eventId:41,discount:10,visibleShow:true,tooltipVisible:true});
  await f.page.getEventList();
  assert.deepEqual(plain(f.page.options),[]);assert.equal(f.page.eventId,'');assert.equal(f.page.discount,0);
  assert.equal(f.page.visibleShow,false);assert.equal(f.page.tooltipVisible,false);assert.deepEqual(f.errors,[]);
  assert.deepEqual(f.changes,[{name:'change',id:'',discount:0}]);assert.equal(f.page.qty,1);assert.equal(f.page.amount,84);
});
test('empty or malformed optional activity data cannot retain an old discount',async()=>{
  for(const response of [available([]),{data:{list:null}},{data:{}},undefined]){
    const f=component(()=>Promise.resolve(response));f.page.options=[activity];f.page.eventId=41;f.page.discount=10;
    await f.page.getEventList();assert.equal(f.page.eventId,'');assert.equal(f.page.discount,0);assert.deepEqual(f.errors,[]);
  }
});
test('missing optional API function does not break the component or the quoting consumer',async()=>{
  const f=component(undefined);await f.page.getEventList();assert.equal(f.page.eventId,'');assert.deepEqual(f.errors,[]);
});
test('late success and late rejection cannot restore or clear a newer activity',async()=>{
  for(const lateFailure of [false,true]){
    const pending=[],f=component(()=>new Promise((resolve,reject)=>pending.push({resolve,reject})));
    const first=f.page.getEventList();await settle();f.page.qty=2;const second=f.page.getEventList();await settle();
    pending[1].resolve(available([{...activity,id:42}]));await second;
    if(lateFailure)pending[0].reject(new Error('late'));else pending[0].resolve(available());
    await first;assert.equal(f.page.eventId,42);assert.equal(f.changes.length,1);assert.deepEqual(f.errors,[]);
  }
});
test('missing cycle and component destruction invalidate pending activity reads',async()=>{
  for(const mode of ['cycle','destroy']){
    let resolve;const f=component(()=>new Promise(done=>{resolve=done}));const pending=f.page.getEventList();await settle();
    if(mode==='cycle'){f.page.billing_cycle_time='';f.page.getEventList();}
    else f.definition.beforeDestroy.call(f.page);
    resolve(available());await pending;assert.equal(f.page.eventId,'');assert.equal(f.changes.length,0);
  }
});
test('unchanged activity parameters reuse their read and changed quantity retries locally',async()=>{
  let reads=0;const f=component(()=>{reads++;return Promise.resolve(available([]))});
  await f.page.getEventList();await f.page.getEventList();assert.equal(reads,1);
  f.page.qty=2;await f.page.getEventList();assert.equal(reads,2);
});
test('all explicit cart component entries use the theme-owned fork and mobile shares its bytes',()=>{
  const templates=['goods_iframe','goods_embed','index_iframe','settlement','shoppingCar','goodsList'];
  for(const name of templates){
    const text=read('public/cart/template/pc/cra1/'+name+'.php');
    assert.ok(text.includes("cra1_theme_asset_url('native', 'components/cra1EventCode/eventCode.js'"),name+' resolves its own activity component under any member theme');
    assert.ok(!text.includes('components/eventCode/eventCode.js'),name+' does not load the old component');
  }
  assert.match(read('public/clientarea/template/pc/cra1/js/module-deps.js'),/eventCode: 'components\/cra1EventCode\/eventCode.js'/);
  assert.equal(read('public/clientarea/template/mobile/cra1/components/cra1EventCode/eventCode.js'),source);
  assert.notEqual(fs.realpathSync(new URL(componentPath,root)),fs.realpathSync(new URL('public/clientarea/template/pc/default/components/eventCode/eventCode.js',root)));
  assert.match(read('public/clientarea/template/pc/default/components/eventCode/eventCode.js'),/this\.\$message\.error\(err\.data\.msg\)/,'upstream remains unchanged');
});

test('optional activity failures, missing API and malformed lists cannot fail the required product catalog',async()=>{
  for(const [api,activityCount] of [[undefined,0],[()=>{throw Error('optional API missing')},0],[()=>Promise.reject({data:{msg:'功能未授权'}}),0],[()=>Promise.resolve({data:{list:null}}),0],[()=>Promise.resolve(available()),1]]){
    let page;
    function Vue(options){
      page=this;Object.assign(this,options.data());
      for(const [name,fn] of Object.entries(options.methods))this[name]=fn.bind(this);
      this.$mount=()=>this;this.$nextTick=fn=>fn();
    }
    Vue.prototype={};
    const env={window:{},Vue,lang:{},navigator:{userAgent:'fixture'},document:{querySelector:()=>({})},asideMenu:{},topMenu:{},scrollText:{},discountCode:{},eventCode:{},
      productGoods:()=>Promise.resolve({data:{data:{list:[{id:4,name:'正常商品',description:''}]}}}),eventPromotion:api};
    vm.runInNewContext(read('cra1-theme/source/legacy-assets/cart/20261017-compat-v3/js/goodsList.js'),env);
    page.isShowFull=true;page.sanitizeHtml=()=>'';page.applyDescMeta=()=>{};page.needScroll=()=>{};
    await page.getProductGoodList();await settle();
    assert.equal(page.goodsList.length,1);assert.equal(page.goodsList[0].name,'正常商品');assert.equal(page.goodSLoading,false);assert.equal(page.catalogError,'');
    assert.equal(page.goodsList[0].activeList.length,activityCount);
  }
});
