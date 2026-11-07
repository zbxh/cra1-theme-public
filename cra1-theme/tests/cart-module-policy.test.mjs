import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {test} from 'node:test';
const code=fs.readFileSync(new URL('../source/legacy-assets/cart/20261012-cart-entry-v1/js/module-policy.js',import.meta.url),'utf8');
const window={location:new URL('https://fixture.invalid/cart/goodsList.htm?product_id=7')};
vm.runInNewContext(code,{window,URL});
const policy=window.CRA1CartModules;
test('only the three exact modules and their V10 reseller routes are integrated',()=>{
 for(const [id,kind] of [['mf_cloud','cloud'],['mf_dcim','dcim'],['idcsmart_common','common']]){
  assert.equal(policy.profile(id),kind);assert.equal(policy.profile('re'+id),kind);
 }
 for(const id of ['',null,undefined,'cloud_service','recloud_service','mf_cloud_disk','mf_cloud_ip','whmcs_cloud','my_mf_cloud','mf_dcim_v2','remf_finance','remf_finance_common','__proto__','constructor'])assert.equal(policy.profile(id),'');
});
test('catalogue routing matches native local, server-group and only_api contracts',()=>{
 assert.equal(policy.catalogModule({module:'mf_cloud'}),'mf_cloud');
 assert.equal(policy.catalogModule({module:null,module1:'direct_admin'}),'direct_admin');
 assert.equal(policy.catalogModule({module:'mf_cloud',res_module:'cloud_service',mode:'only_api'}),'recloud_service');
 assert.equal(policy.catalogModule({module:'direct_admin',res_module:'mf_cloud',mode:'sync'}),'direct_admin');
 assert.equal(policy.catalogModule({module:null,res_module:'mf_cloud',mode:'only_api'}),'remf_cloud');
 for(const value of [null,undefined,{}, {res_module:'mf_cloud'}])assert.equal(policy.catalogModule(value),'');
});
test('native and integrated links preserve edit context, repeated values and fragments',()=>{
 const source='https://fixture.invalid/cart/goods_embed.htm?product_id=7&id=8&fpg_id=1&spg_id=2&embed=1&embed_nonce=old&standalone=1&change=true&name=A%20B&config=%7B%22x%22%3A%22a%2Bb%22%7D&tag=a&tag=b#network';
 for(const path of ['/cart/goods.htm','/cart/goodsList.htm']){
  const url=new URL(policy.url(path,7,source),'https://fixture.invalid');
  assert.equal(url.pathname,path);assert.equal(url.searchParams.get(path.includes('goodsList')?'product_id':'id'),'7');
  for(const key of ['fpg_id','spg_id','embed','embed_nonce','standalone'])assert.equal(url.searchParams.has(key),false);
  assert.equal(url.searchParams.get('change'),'true');assert.equal(url.searchParams.get('name'),'A B');
  assert.equal(url.searchParams.get('config'),'{"x":"a+b"}');assert.deepEqual(url.searchParams.getAll('tag'),['a','b']);assert.equal(url.hash,'#network');
  assert.equal(policy.url(path,7,source).includes('name=A+B'),false);
 }
});
