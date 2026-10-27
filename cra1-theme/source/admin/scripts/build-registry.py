from pathlib import Path
import json,subprocess,re,os,sys
root=Path(os.environ.get('CRA1_THEME_SOURCE_ROOT',Path(__file__).resolve().parents[4])).resolve()
src=Path(__file__).resolve().parents[1]/'src'
# A focused icon release should retain the installed page controls and copy.
# Full registry regeneration remains available for intentional template changes.
if os.environ.get('CRA1_ICON_CONTRACTS_ONLY') == '1':
 registry_path=root/'public/cra1admin/workspace_schema.json'
 registry=json.loads(registry_path.read_text())
 registry['contractDefinitions']['menuNode']['icon_style']='icon-style'
 registry['contracts']['member']['content']['home_quick_links']['items']['$list']['icon_style']='icon-style'
 goods=registry['contracts']['cart']['content']['goodslist']
 goods['heading_icon_styles']={key:'icon-style' for key in goods['heading_icons']}
 registry_path.write_text(json.dumps(registry,ensure_ascii=False,indent=2)+'\n')
 print('Registry: icon contracts updated; installed controls and copy retained')
 sys.exit(0)
php="function add_hook($name,$callback) {} $root=getenv('CRA1_THEME_SOURCE_ROOT'); require $root.'/public/web/cra1/controller/Cra1.php'; require $root.'/public/web/cra1/controller/hooks.php'; echo json_encode(['manifest'=>cra1_page_module_manifest(),'defaults'=>\\template\\cra1\\controller\\Cra1::defaults(),'shared'=>cra1_shared_module_keys()],JSON_UNESCAPED_UNICODE);"
os.environ['CRA1_THEME_SOURCE_ROOT']=str(root)
data=json.loads(subprocess.check_output([os.environ.get('CRA1_PHP','php'),'-r',php]))
mf=data['manifest'];pages={k:v for k,v in mf.items() if not v.get('aliasOf')};shared=data['shared']
schema=json.loads((src/'schema.json').read_text())
page_col={'key':'page','label':'展示页面','type':'pages'}
extra_fields={
 'page-detail':[
  {'key':'prod_service_heads_text','label':'服务与计费表头','type':'rows','cols':[page_col,{'key':'first','label':'第一列表头'},{'key':'second','label':'第二列表头'},{'key':'third','label':'第三列表头'}]},
  {'key':'prod_cta_btn1_text','label':'产品页主按钮','type':'rows','cols':[page_col,{'key':'text','label':'按钮文字'},{'key':'url','label':'按钮链接','url':True}]},
 ],
 'site-info':[{'key':'copy_header_text','label':'官网顶栏公共文案','type':'rows','cols':[{'key':'key','label':'文案标识'},{'key':'text','label':'显示文案','type':'textarea','remainder':True}]}],
 'site-footer':[{'key':'copy_footer_text','label':'页脚公共文案','type':'rows','cols':[{'key':'key','label':'文案标识'},{'key':'text','label':'显示文案','type':'textarea','remainder':True}]}],
}
for sec in schema['sections']:
 for item in sec['items']:
  present={f['key'] for f in item['fields']}
  item['fields'].extend(f for f in extra_fields.get(item['key'],[]) if f['key'] not in present)
# Exact column contracts for the two formerly inaccessible generic rows.
linkcols=[{'key':'page','label':'展示页面','type':'pages'},{'key':'name','label':'名称','required':True},{'key':'desc','label':'说明','type':'textarea'},{'key':'url','label':'链接','url':True},{'key':'icon','label':'图标','type':'icon'},{'key':'tag','label':'标签'},{'key':'value','label':'价格 / 补充内容'}]
for sec in schema['sections']:
 for it in sec['items']:
  for f in it['fields']:
   if f['key'].endswith('_rows_text') and f['key'][:-10] in shared:
    mid=f['key'][:-10]
    if shared[mid]=='text': f['cols']=[{'key':'page','label':'展示页面','type':'pages'},{'key':'name','label':'名称','required':True},{'key':'desc','label':'说明','type':'textarea'},{'key':'value','label':'作者 / 年份 / 补充说明'},{'key':'tag','label':'标签'}]
    else: f['cols']=linkcols
   elif f['key'].startswith('price_slider_') and f['key'].endswith('_text'):
    f['cols']=linkcols[1:]
    f['hint']='仅本页的规格档位：名称、规格说明、链接、图标、标签、价格。留空继承公共回退。'
   elif f['key'].startswith('copy_') and f.get('cols'):
    f['cols'][-1]['remainder']=True
   elif f.get('cols') and f['cols'][0]['key']=='page': f['cols'][0]['type']='pages'
(src/'schema.json').write_text(json.dumps(schema,ensure_ascii=False,indent=2)+'\n')
usage={}; modulepages={};labels={}
for pk,p in pages.items():
 for module in p['modules']:
  mid=module['id']; labels.setdefault(mid,module['label']);modulepages.setdefault(mid,[]).append(pk)
  for key in module['fieldKeys']: usage.setdefault(key,[]).append((pk,mid))
# Runtime copy adapters derive their consumers from the registered module ID.
for pk,p in pages.items():
 for module in p['modules']:
  usage.setdefault('copy_'+module['id']+'_text',[]).append((pk,module['id']))
fields={};scopes={};aliases={};assignments={};legacy_entries=[]
def scope(id,label,kind,**kw):
 scopes.setdefault(id,dict(id=id,label=label,domain='website',kind=kind,fields=[],references=[],**kw));return scopes[id]
for pk,p in pages.items():
 category='首页' if pk=='home' else '产品' if p['sortKey']=='product.detail.v1' else '解决方案' if pk.startswith('solution') else '资讯与文档' if pk.startswith(('news','announce','document')) else '合作与特殊页面' if pk.startswith('partner') or pk=='404' else '企业与服务'
 p['category']=category
 scope('page:'+pk+':content',p['label']+'内容','content',pageKey=pk)
 scope('page:'+pk+':layout',p['label']+'布局','layout',pageKey=pk)
 scope('page:'+pk+':seo',p['label']+' SEO','seo',pageKey=pk)
 for mod in p['modules']: mod['visibilityKey']=next((k for k in mod['fieldKeys'] if k.startswith('show_')),None)
itempages={'home':'home','sol-overview':'solution','page-contact':'contact','page-document':'document','page-news':'news','page-announce':'announce','page-recruit':'recruit','page-feedback':'feedback','page-activity':'activities','page-doc-result':'document-result','page-classify':'news-classify','page-404':'404','page-about':'about','page-partner-cps':'partner/cps','page-partner-agent':'partner/agent'}
for sec in schema['sections']:
 for item in sec['items']:
  assigned=[]
  for rawf in item['fields']:
   assigned_before=len(assigned)
   f=dict(rawf);key=f['key']; f['keys']=[it['key']+'_'+cf['key'] for it in f.get('items',[]) for cf in f.get('fields',[])] if f.get('type')=='cards' else [key]
   uses=usage.get(key,[])
   for pk in pages:
    normalized=pk.replace('/','_').replace('-','_')
    if re.match(r'^(link_tiles|price_slider)_'+re.escape(normalized)+r'_(title|more_text|link|text)$',key): uses=[(pk,key.split('_'+normalized)[0])]
   if key.startswith('page_hero_'): uses=[(pk,'page_hero') for pk in pages]
   if not uses:
    fallback=('solution/'+item['key'][4:]) if item['key'].startswith('sol-') and item['key']!='sol-overview' else itempages.get(item['key']) or ('home' if sec['key']=='home' else None)
    if fallback: uses=[(fallback,item['key'])]
   seenpages=list(dict.fromkeys(pk for pk,_ in uses));mid=uses[0][1] if uses else item['key'];fields[key]=f
   if sec['key']=='site' and item['key'] not in ['site-pagehero']:
    id='site:seo' if item['key']=='site-seo' else item['key'];owner=scope(id,item['label'],'global-seo' if item['key']=='site-seo' else 'site');desc=dict(f,adapter='value');owner['fields'].append(desc);assigned.append(id)
   elif key.startswith('show_') and seenpages:
    if len(seenpages)>1:
     id='shared:'+mid;owner=scope(id,labels.get(mid,item['label']),'shared',moduleId=mid,affectedPageKeys=modulepages.get(mid,seenpages));owner['fields'].append(dict(f,adapter='visibility-default',moduleId=mid));assigned.append(id)
    else: assigned.append('page:'+seenpages[0]+':layout')
   elif f.get('cols') and f['cols'][0]['key']=='page':
    for pk in seenpages:
     id='page:'+pk+':content';scopes[id]['fields'].append(dict(f,adapter='page-rows',boundPage=pk,moduleId=mid));assigned.append(id)
    id='shared:'+mid;owner=scope(id,labels.get(mid,item['label']),'shared',moduleId=mid,affectedPageKeys=modulepages.get(mid,seenpages));owner['fields'].append(dict(f,adapter='shared-rows',moduleId=mid));assigned.append(id)
   elif len(seenpages)==1:
    id='page:'+seenpages[0]+':content';scopes[id]['fields'].append(dict(f,adapter='value',moduleId=mid));assigned.append(id)
   else:
    id='shared:'+mid;owner=scope(id,labels.get(mid,item['label']),'shared',moduleId=mid,affectedPageKeys=seenpages);owner['fields'].append(dict(f,adapter='value',moduleId=mid));assigned.append(id)
   assignments[key]=list(dict.fromkeys(assigned[assigned_before:]))
  destinations=list(dict.fromkeys(assigned));aliases['website/'+sec['key']+'/'+item['key']]=destinations[0] if destinations else 'pages'
  if item['key']=='home-shared-visibility': aliases['website/'+sec['key']+'/'+item['key']]='shared:figure_band'
  legacy_entries.append({'path':'website/'+sec['key']+'/'+item['key'],'label':item['label'],'group':sec['label'],'destinations':destinations or [aliases['website/'+sec['key']+'/'+item['key']]]})
# Shared references link to a canonical editor; no second form is generated.
for id,s in list(scopes.items()):
 if s['kind']=='shared':
  for pk in s.get('affectedPageKeys',[]):
   if 'page:'+pk+':content' in scopes: scopes['page:'+pk+':content']['references'].append(id)
for s in scopes.values():
 s['keys']=list(dict.fromkeys(k for f in s['fields'] for k in f['keys']))
member={'home':['home_quick_links','home_todo','home_news','home_security','home_banner'],'products':['product_list'],'server':['host_orders'],'ticket':['ticket_assist'],'login':['auth_login'],'regist':['auth_regist']}
mlabels={'home':'会员首页','products':'产品列表','server':'服务器面板','ticket':'工单提交助手','login':'登录页','regist':'注册页'}
for id,keys in member.items(): scopes['member:'+id]={'id':'member:'+id,'label':mlabels[id],'domain':'member','kind':'member-content','keys':keys,'fields':[]}
for id,label in [('appearance','外观设置'),('sidebar','菜单管理')]: scopes['member:'+id]={'id':'member:'+id,'label':label,'domain':'member','kind':'member-'+id,'keys':[id],'fields':[]}
for id,label in [('goodslist','商品列表'),('shoppingcar','购物车'),('settlement','结算'),('orderresult','订单结果')]: scopes['cart:'+id]={'id':'cart:'+id,'label':label,'domain':'cart','kind':'cart-content','keys':[id],'fields':[]}
default_php="$root=getenv('CRA1_THEME_SOURCE_ROOT');define('CRA1_THEME_BACKEND',$root.'/cra1-theme/backend');require $root.'/public/cra1admin/member_store.php'; require $root.'/public/cra1admin/cart_store.php'; echo json_encode(['member'=>MemberCenterStore::defaults(),'cart'=>CartThemeStore::defaults()]);"
domain_defaults=json.loads(subprocess.check_output([os.environ.get('CRA1_PHP','php'),'-r',default_php]))
def contract(value):
 if isinstance(value,dict): return {k:contract(v) for k,v in value.items()}
 if isinstance(value,list): return {'$list':contract(value[0]) if value else 'scalar'}
 return 'scalar'
contracts={d:{k:contract(v) for k,v in defaults.items() if k in ['appearance','sidebar','content']} for d,defaults in domain_defaults.items()}
scalar=lambda names:{k:'scalar' for k in names.split()}
menu_node=scalar('id label source_type source_nav_id url icon second_reminder show_quick_order quick_order_url is_cross_module select_field_set select_field_version hidden order')
menu_node['icon_style']='icon-style'
menu_node.update(language={'$map':'scalar'},module={'$list':'scalar'},res_module={'$list':'scalar'},product_id={'$list':'scalar'},select_field={'$list':'scalar'},children={'$list':{'$ref':'menuNode'}})
ticket_node=scalar('id name type_id template link link_label enabled')
ticket_node['children']={'$list':{'$ref':'ticketNode'}}
contracts['member']['sidebar']['nodes']={'$list':{'$ref':'menuNode'}}
mc=contracts['member']['content']
mc['home_quick_links']['items']={'$list':{**scalar('id label url icon enabled'),'icon_style':'icon-style'}}
contracts['cart']['content']['goodslist']['heading_icon_styles']={key:'icon-style' for key in domain_defaults['cart']['content']['goodslist']['heading_icons']}
mc['product_list']['overrides']={'$map':mc['product_list']['default']}
mc['home_banner']['items']={'$list':scalar('id title description link image enabled')}
mc['ticket_assist']['categories']={'$list':{'$ref':'ticketNode'}}
mc['ticket_assist']['type_placeholders']={'$list':scalar('type_id placeholder')}
contracts['cart']['content']['shoppingcar']['recommendations']['items']={'$list':scalar('id product_id title_override desc_override enabled')}
# Keep storage and consumer evidence alongside ownership, including dynamically
# constructed keys. The browser only receives compact search/navigation metadata.
consumer_files=[p for p in (root/'public/web/cra1').rglob('*') if p.suffix in ['.php','.html'] and p.name not in ['Cra1.php','PageModuleRegistry.php']]
consumer_lines={p:list(enumerate(p.read_text(errors='replace').splitlines(),1)) for p in consumer_files}
hook_path=root/'public/web/cra1/controller/hooks.php'
dynamic_functions={prefix:next((line for line,text in consumer_lines[hook_path] if 'function '+name+'(' in text),None) for prefix,name in {
 'prod_':'cra1_product_module_copy','page_hero_':'cra1_page_hero_resolve',
 'copy_':'cra1_extra_module_copy','price_slider_':'cra1_shared_page_keys',
 'link_tiles_':'cra1_shared_page_keys','show_':'cra1_shared_module_visible',
}.items()}
field_contracts={}
for key,f in fields.items():
 references=[]
 for file,lines in consumer_lines.items():
  for line,text in lines:
   if re.search(r'(?<![A-Za-z0-9_])'+re.escape(key)+r'(?![A-Za-z0-9_])',text):
    references.append({'file':str(file.relative_to(root)),'line':line,'kind':'literal'})
 for prefix,line in dynamic_functions.items():
  if key.startswith(prefix) and line:
   ref={'file':str(hook_path.relative_to(root)),'line':line,'kind':'dynamic-adapter'}
   if ref not in references:references.append(ref)
 owners=assignments[key]
 adapters=list(dict.fromkeys(field['adapter'] for owner in owners for field in scopes[owner]['fields'] if field['key']==key))
 if key.startswith('show_') and not adapters:adapters=['page-visibility']
 consumers=list(dict.fromkeys(usage.get(key,[])))
 for owner in owners:
  if scopes[owner].get('pageKey') and not any(p==scopes[owner]['pageKey'] for p,_ in consumers):
   consumers.append((scopes[owner]['pageKey'],next((field.get('moduleId','') for field in scopes[owner]['fields'] if field['key']==key),'')))
 field_contracts[key]={'type':f['type'],'storageFormat':'pipe-delimited-lines' if f.get('cols') or f['type']=='rows' else 'boolean-string' if key.startswith('show_') else 'scalar',
  'keys':f['keys'],'scopeIds':owners,'adapters':adapters,'columns':f.get('cols',[]),
  'defaultSource':{'file':'public/web/cra1/controller/Cra1.php','method':'CRA1::defaults'},
  'defaultValues':{physical:data['defaults'][physical] for physical in f['keys']},
  'consumers':[{'pageKey':p,'moduleId':m,'route':pages[p]['route']} for p,m in consumers if p in pages],
  'sourceReferences':references}
out={'schema':2,'pages':pages,'pageAliases':{k:p for k,p in mf.items() if p.get('aliasOf')},'scopes':scopes,'aliases':aliases,'legacyEntries':legacy_entries,'fields':fields,'assignments':assignments,'fieldContracts':field_contracts,'deprecated':['seo_index_404','compare_split_link','compare_split_more_text'],'visibilityLegacy':'shared_module_off_text','contracts':contracts,'contractDefinitions':{'menuNode':menu_node,'ticketNode':ticket_node}}
from visual_registry import enrich
out=enrich(out,root)
(root/'public/web/cra1/controller/content_defaults.json').write_text(json.dumps(out.pop('contentDefaults'),ensure_ascii=False,indent=2)+'\n')
(root/'public/cra1admin/workspace_schema.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
# The client only needs navigation/search metadata. Detailed controls arrive with each scope read.
client={k:v for k,v in out.items() if k not in ['fields','assignments','fieldContracts','contracts','contractDefinitions']}
client['scopes']={id:{**scope,'fields':[{'key':f['key'],'label':f['label'],'controlLabels':[c['label'] for c in f.get('visual',{}).get('controls',[])]} for f in scope['fields']]} for id,scope in scopes.items()}
client['editors']={id:{**editor,'fields':[{'key':f['key'],'label':f['label'],'moduleId':f.get('moduleId'),'controlLabels':[c['label'] for c in f.get('visual',{}).get('controls',[])]} for f in editor['fields']]} for id,editor in out['editors'].items()}
(src/'workspace.registry.json').write_text(json.dumps(client,ensure_ascii=False,indent=2)+'\n')
print('Registry:',len(pages),'pages,',len(fields),'fields,',len(scopes),'scopes; unassigned:',[k for k,v in assignments.items() if not v])

(root/'cra1-theme/backend/Storage/workspace_schema.json').write_text((root/'public/cra1admin/workspace_schema.json').read_text())
