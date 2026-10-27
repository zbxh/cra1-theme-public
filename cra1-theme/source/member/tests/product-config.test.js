import test from 'node:test'
import assert from 'node:assert/strict'
import { loadCategoryHosts, hostDisplayFields, localizedMenuName, completeHostDisplayData, productNavigationCategories, productOverviewAliases, findProductCategory } from '../src/lib/product-config.js'

test('language names and explicit empty field lists retain the menu contract', () => {
  assert.equal(localizedMenuName({name:'云服务',language:{'en-us':'CRA1'}},'en-us'),'CRA1')
  assert.equal(localizedMenuName({name:'云服务',language:{'en-us':'CRA1'}},'zh-hk'),'云服务')
  assert.ok(hostDisplayFields(null).has('ip'))
  assert.equal(hostDisplayFields({select_field:[],select_field_set:true}).size,0)
  assert.deepEqual([...hostDisplayFields({select_field:['area','os']})],['area','os'])
})
test('navigation association filters products without narrowing a shared module', async () => {
  let params
  const result = await loadCategoryHosts(async (path, p) => { assert.equal(path, '/host'); params = p; return { data: { list: [{id:1}], count:1 } } },
    { tab:'using', page:2, limit:6, keywords:'abc' }, { product_id:[4,'5',4], module:['same_module'], res_module:['other'], selectedModule:'wrong' })
  assert.equal(result.count,1)
  assert.deepEqual(params,{tab:'using',page:2,limit:6,keywords:'abc',orderby:'id',sort:'desc','product_id[0]':4,'product_id[1]':5})
})
test('empty and malformed associations stay empty instead of widening to a module or all products', async () => {
  for (const product_id of [[], {}, '', null, ['bad',0,-1,true]]) {
    let called=false
    const result=await loadCategoryHosts(async()=>{called=true},{page:1,limit:6},{module:['mf_cloud'],product_id})
    assert.deepEqual(result,{list:[],count:0});assert.equal(called,false)
  }
})
test('all products keeps server pagination and category failures are not hidden', async () => {
  let params
  await loadCategoryHosts(async(path,p)=>{params=p;return{data:{list:[],count:0}}},{page:11,limit:12},null)
  assert.deepEqual(params,{page:11,limit:12,orderby:'id',sort:'desc'})
  await assert.rejects(loadCategoryHosts(async()=>{throw Error('unavailable')},{page:1,limit:6},{product_id:[4]}),/unavailable/)
})

test('optional display fields read real renewal and power data only when selected', async () => {
  const calls=[]
  const get=async path=>{calls.push(path);return path.endsWith('/status')?{data:{status:'off'}}:{data:{host:{id:1,auto_renew:1,billing_cycle_name:'月付',password:'never-copy'}}}}
  const rows=await completeHostDisplayData(get,[{id:1,module:'mf_cloud'}],{select_field:['is_auto_renew','power_status','billing_cycle']})
  assert.equal(rows[0].is_auto_renew,1);assert.equal(rows[0].power_status,'off');assert.equal(rows[0].billing_cycle_name,'月付');assert.equal(rows[0].password,undefined)
  assert.deepEqual(calls,['/host/1','/mf_cloud/1/status']);calls.length=0
  await completeHostDisplayData(get,[{id:1,module:'mf_cloud'}],{select_field:['product_name']});assert.equal(calls.length,0)
})

test('navigation order, translations, hidden branches and child links share one category owner', () => {
  const categories = productNavigationCategories([
    {id:'group',type:'custom',children:[
      {id:'first',type:'module',name:'第一组',language:{'en-us':'First'},module:['mf_cloud'],product_id:'[5,4,5]',children:[
        {id:'first-status',type:'custom'},
        {id:'nested',type:'module',name:'独立分类',product_id:[9],children:[{id:'nested-status',type:'custom'}]},
        {id:'hidden-link',hidden:1},
      ]},
      {id:'second',type:'module',name:'第二组',module:['mf_cloud'],product_id:[6]},
      {id:'hidden-parent',hidden:1,children:[{id:'hidden-category',type:'module',product_id:[7]}]},
    ]},
  ],'en-us')
  assert.deepEqual(categories.map(c=>c.key),['first','nested','second'])
  assert.equal(categories[0].name,'First');assert.deepEqual(categories[0].product_id,[5,4])
  assert.equal(findProductCategory(categories,'first-status').key,'first')
  assert.equal(findProductCategory(categories,'nested-status').key,'nested')
  assert.equal(findProductCategory(categories,'hidden-link'),null)
  assert.equal(findProductCategory(categories,'unknown'),null)
})
test('system fallback accepts child arrays and numeric menu identifiers', () => {
  const categories=productNavigationCategories([{id:55,type:'module',name:'关联商品',product_id:{0:'4',1:5},child:[{id:56,type:'custom'}]}])
  assert.equal(findProductCategory(categories,'56').key,'55')
  assert.deepEqual(categories[0].product_id,[4,5])
})

test('generic sidebar list ids select the overview without widening an unassigned category', () => {
  const nodes = [{ id: 'root', type: 'custom', children: [
    { id: 'overview', type: 'custom', url: 'productList.htm', children: [{ id: 'overview-active', type: 'custom', url: '/productList.htm?tab=using' }] },
    { id: 'unassigned', type: 'module', url: 'productList.htm', product_id: [], children: [{ id: 'category-active', type: 'custom', url: 'productList.htm?tab=using' }] },
    { id: 'hidden', hidden: 1, url: 'productList.htm', child: [{ id: 'hidden-child', url: 'productList.htm' }] },
    { id: 'other', url: 'productdetail.htm' },
    { id: 'external', url: 'https://other.invalid/productList.htm' },
  ] }]
  assert.deepEqual(productOverviewAliases(nodes), ['overview', 'overview-active'])
  assert.equal(findProductCategory(productNavigationCategories(nodes), 'unassigned').product_id.length, 0)
  assert.equal(findProductCategory(productNavigationCategories(nodes), 'category-active').key, 'unassigned')
})
