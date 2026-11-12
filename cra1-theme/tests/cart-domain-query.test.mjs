import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {test} from 'node:test';

const source = fs.readFileSync(new URL('../source/legacy-assets/cart/20261017-compat-v3/js/goodsList.js', import.meta.url), 'utf8');
const suffixes = [{suffix:'.cn',allow_zh:1},{suffix:'.com',allow_zh:0},{suffix:'.co.uk',allow_zh:0}];
const response = data => ({data:{status:200,data}});
const settle = () => new Promise(resolve=>setTimeout(resolve,0));
function fixture(query='') {
  let page;const warnings=[],calls=[];
  function Vue(options) {
    page=this;Object.assign(this,options.data());
    for(const [name,method] of Object.entries(options.methods))this[name]=method.bind(this);
    for(const [name,method] of Object.entries(options.computed))Object.defineProperty(this,name,{get:()=>method.call(this)});
    this.$message={warning:message=>warnings.push(message)};this.$mount=()=>this;
  }
  Vue.prototype={};
  const window={location:{search:query}},document={getElementsByClassName:()=>[{}]};
  const env={window,document,Vue,URLSearchParams,asideMenu:{},topMenu:{},scrollText:{},discountCode:{},eventCode:{},lang:{template_text140:'请输入域名',template_text143:'该后缀不支持中文'},
    domainSuffix:async id=>{calls.push({api:'suffix',id});return response(suffixes)},
    domainSetting:async()=>{calls.push({api:'config'});return response({default_search_domain:'.cn',batch_search_domain:1})},
    domainSearch:async params=>{calls.push({api:'search',...params});return response([{name:params.domain+params.suffix,avail:1}])},
    domainPrice:async params=>{calls.push({api:'price',...params});return response([{buyyear:1,buyprice:'20.00'}])},
    domainBatch:async params=>{calls.push({api:'batch',...params});return response({avail:[],unavail:[],fail:[]})}};
  vm.runInNewContext(source,env);window.onload();
  page.select_first_obj.id=1;page.select_second_obj={id:2,type:'domain'};
  page.domainInput=new URLSearchParams(query).get('domain')||'';page.host_id=7;
  return {page,env,calls,warnings};
}

test('entry auto-query uses native API, category and host scope, then consumes the entry once',async()=>{
  const f=fixture('?domain=fixture&suffix=.cn');await f.page.getSuffix();await settle();
  assert.deepEqual(f.calls.filter(c=>c.api==='search'),[{api:'search',domain:'fixture',suffix:'.cn',host_id:7}]);
  assert.equal(f.page.domainConfigState,'ready');assert.equal(f.page.isSearching,false);
  assert.equal(f.page.domainList[0].showPrice,'20.00');assert.equal(f.page.domainList[0].priceLoading,false);
  await f.page.getSuffix();assert.equal(f.calls.filter(c=>c.api==='search').length,1);
});
test('full domains parse an enabled suffix, including case and multi-label suffixes',async()=>{
  for(const [domain,suffix,name] of [['Fixture.COM','.com','Fixture'],['fixture.co.uk','.co.uk','fixture'],['手机.cn','.cn','手机']]){
    const f=fixture('?domain='+encodeURIComponent(domain)+'&suffix='+suffix);await f.page.getSuffix();
    const request=f.calls.find(c=>c.api==='search');assert.equal(request.domain,name);assert.equal(request.suffix,suffix);
    assert.equal(f.page.domainInput,name);assert.equal(f.page.selectSuffix,suffix);
  }
});
test('an empty or unrecognised explicit suffix never becomes an invented default or a query',async()=>{
  for(const suffix of ['', '.invalid']) {
    const f=fixture('?domain=fixture&suffix='+suffix);await f.page.getSuffix();
    assert.equal(f.calls.some(c=>c.api==='search'),false);assert.equal(f.page.selectSuffix,'');
    assert.equal(f.page.isSearching,false);assert.match(f.warnings.join(''),/可用.*后缀/);
    f.page.handelSelectSuffix('.cn');await f.page.handelDomainSearch();
    assert.equal(f.calls.filter(c=>c.api==='search').length,1);
  }
});
test('an unknown complete suffix is not silently replaced, and suffix-like unrelated parameters do not query',async()=>{
  const f=fixture('?domain=fixture.invalid&suffix=.cn');await f.page.getSuffix();
  assert.equal(f.calls.some(c=>c.api==='search'),false);assert.equal(f.page.domainInput,'fixture.invalid');
  const irrelevant=fixture('?suffix_note=anything');await irrelevant.page.getSuffix();
  assert.equal(irrelevant.calls.some(c=>c.api==='search'),false);assert.equal(irrelevant.warnings.length,0);
});
test('without an explicit suffix the real configured suffix or actual first entry is used',async()=>{
  const f=fixture('?domain=fixture');f.env.domainSetting=async()=>response({default_search_domain:'.unavailable'});
  await f.page.getSuffix();assert.equal(f.calls.find(c=>c.api==='search').suffix,'.cn');
});
test('an empty suffix list stops before settings and querying and remains retryable',async()=>{
  const f=fixture('?domain=fixture&suffix=.cn');f.env.domainSuffix=async()=>response([]);
  await f.page.getSuffix();assert.equal(f.page.domainConfigState,'empty');assert.equal(f.page.isSearching,false);
  assert.equal(f.calls.some(c=>c.api==='config'||c.api==='search'),false);
  f.env.domainSuffix=async()=>response(suffixes);await f.page.handelDomainSearch();
  assert.equal(f.calls.filter(c=>c.api==='search').length,1);assert.equal(f.page.domainConfigState,'ready');
});
test('suffix and settings failures never search; clicking query reloads and retries once',async()=>{
  for(const failing of ['domainSuffix','domainSetting']){
    const f=fixture('?domain=fixture&suffix=.cn'),normal=f.env[failing];
    f.env[failing]=async()=>{throw Error('/private/provider/token')};
    await f.page.getSuffix();assert.equal(f.page.domainConfigState,'error');assert.equal(f.page.isSearching,false);
    assert.equal(f.calls.some(c=>c.api==='search'),false);assert.equal(f.page.suffixList.length,0);
    assert.doesNotMatch(f.warnings.join(''),/private|provider|token/);
    f.env[failing]=normal;await f.page.handelDomainSearch();
    assert.equal(f.calls.filter(c=>c.api==='search').length,1);assert.equal(f.page.isSearching,false);
  }
});
test('both rejected and resolved unsuccessful queries settle loading and can be retried',async()=>{
  for(const fail of [async()=>{throw Error('private')},async()=>({data:{status:400,msg:'private'}})]){
    const f=fixture();await f.page.getSuffix();f.page.domainInput='fixture';
    const normal=f.env.domainSearch;f.env.domainSearch=fail;await f.page.handelDomainSearch();
    assert.equal(f.page.isSearching,false);assert.match(f.warnings.join(''),/重试/);assert.doesNotMatch(f.warnings.join(''),/private/);
    f.env.domainSearch=normal;await f.page.handelDomainSearch();assert.equal(f.page.domainList[0].name,'fixture.cn');
  }
});
test('switching categories cancels stale suffix, settings, search and price responses',async()=>{
  for(const stage of ['domainSuffix','domainSetting','domainSearch','domainPrice']) {
    const f=fixture('?domain=fixture&suffix=.cn');let resolve;
    f.env[stage]=()=>new Promise(done=>{resolve=done});
    const pending=f.page.getSuffix();await settle();assert.equal(typeof resolve,'function');
    f.page.resetDomainState(true);f.page.select_second_obj={id:9,type:'normal'};
    resolve(response(stage==='domainSuffix'?suffixes:stage==='domainSetting'?{default_search_domain:'.cn'}:stage==='domainSearch'?[{name:'late.cn',avail:1}]:[{buyprice:'1.00'}]));
    await pending;await settle();
    assert.equal(f.page.domainList.length,0);assert.equal(f.page.suffixList.length,0);assert.equal(f.page.isSearching,false);
    assert.equal(f.warnings.length,0);assert.equal(f.page.domainEntryPending,false);
    if(stage==='domainSuffix'||stage==='domainSetting')assert.equal(f.calls.some(c=>c.api==='search'),false);
  }
});
test('a new initialisation supersedes an older read without duplicate auto queries',async()=>{
  const f=fixture('?domain=fixture&suffix=.cn'),reads=[];
  f.env.domainSuffix=()=>new Promise(resolve=>reads.push(resolve));
  const old=f.page.getSuffix(),current=f.page.getSuffix();reads[1](response(suffixes));await current;
  reads[0](response([{suffix:'.invalid'}]));await old;
  assert.equal(f.calls.filter(c=>c.api==='search').length,1);assert.equal(f.page.selectSuffix,'.cn');
});
test('price failures do not leave spinners, pretend free prices, or leak service errors',async()=>{
  const f=fixture('?domain=fixture&suffix=.cn');f.env.domainPrice=async()=>{throw Error('private')};
  await f.page.getSuffix();await settle();assert.equal(f.page.domainList[0].showPrice,'—');assert.equal(f.page.domainList[0].priceLoading,false);
  assert.match(f.warnings.join(''),/重新查询/);assert.doesNotMatch(f.warnings.join(''),/private/);
});
test('batch uses the unchanged native read contract, settles failure, and ignores previous category data',async()=>{
  const f=fixture();await f.page.getSuffix();f.page.textarea2='fixture.cn\nfixture.com';
  await f.page.batchSearchDomain();assert.deepEqual(f.calls.find(c=>c.api==='batch'),{api:'batch',domains:'fixture.cn,fixture.com'});
  f.env.domainBatch=async()=>({data:{status:500,msg:'private'}});await f.page.batchSearchDomain();
  assert.equal(f.page.batchLoading,false);assert.match(f.warnings.join(''),/重试/);
  let resolve;f.env.domainBatch=()=>new Promise(done=>{resolve=done});const pending=f.page.batchSearchDomain();
  f.page.resetDomainState(true);f.page.select_second_obj={id:9,type:'normal'};
  resolve(response({avail:[{name:'late.cn'}],unavail:[],fail:[]}));await pending;
  assert.equal(f.page.availList.length,0);assert.equal(f.page.batchLoading,false);
});
