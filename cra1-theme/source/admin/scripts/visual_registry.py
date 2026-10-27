"""Business-facing editor metadata; keep legacy schema and ownership intact."""
import copy, re, json
from copy_labels import LABELS
from pathlib import Path

PAGE_NAMES = {'about':'关于我们','contact':'联系我们','feedback':'意见反馈','activities':'活动页面','404':'404 页面'}
MODULE_NAMES = {'page_hero':'页面顶部','home-carousel':'轮播图','home-capability':'功能介绍','home-pricing':'产品与价格','home-solutions':'解决方案展示','home-steps':'快速上手','home-nodes':'全球节点','home-news':'新闻资讯','overview':'产品介绍','advantages':'产品优势','scenarios':'使用场景','service':'服务与计费','cta':'咨询与购买','figure_band':'数据展示','switch_deck':'分类展示','duo_feature':'图文介绍','rail_scroll':'横向卡片','choice_ladder':'套餐选择','proof_wall':'客户评价','step_ribbon':'步骤展示','link_tiles':'相关产品','icon_ribbon':'功能图标','spec_matrix':'规格对照','price_slider':'配置与价格','faq_board':'常见问题','stack_board':'方案分层','compare_split':'方案对比','quote_stage':'推荐语','region_ledger':'地区与节点'}
KEY_NAMES={'title':'标题','title2':'第二部分标题','title3':'第三部分标题','desc':'说明','description':'说明','btn':'按钮文字','btn1':'主按钮文字','btn2':'副按钮文字','url':'按钮链接','url1':'主按钮链接','url2':'副按钮链接','cta':'按钮文字','cta_url':'按钮链接','node':'节点数量单位','rack':'机房数量单位','ph_search':'搜索框提示','searching':'搜索中的提示','noresult':'没有搜索结果的提示','nav_title':'导航标题','tab_basic':'基础产品分类名称','tab_security':'安全产品分类名称','tab_overview':'概览分类名称','menu_account':'账户信息名称','menu_console':'控制台名称','menu_security':'安全中心名称','menu_key':'密钥管理名称','menu_finance':'财务信息名称','logout':'退出登录文字'}
CONTACT={'title':'咨询表单标题','title2':'提交成功标题','title3':'联系方式标题','txt1':'咨询表单说明','txt2':'提交成功说明','txt3':'表单底部提示','txt4':'手机号码输入提示','txt5':'邮箱输入提示','txt6':'咨询内容输入提示','l1':'联系人字段名称','l2':'公司名称字段名称','l3':'手机号码字段名称','l4':'联系邮箱字段名称','l5':'咨询内容字段名称','b1':'提交按钮文字','b2':'再次提交按钮文字'}

def enrich(out, root):
    MODULE_NAMES.update({'capability':'功能介绍','pricing':'产品与价格','solutions':'解决方案展示','steps':'快速上手','nodes':'全球服务节点','news':'新闻资讯'})
    pages, scopes, fields = out['pages'], out['scopes'], out['fields']
    templates = {}
    for p in (root/'public/web/cra1').rglob('*.html'):
        if '/assets/' not in str(p): templates[str(p)] = p.read_text(errors='replace')
    content_defaults={'schema':1,'copy':{},'hero':{},'aliases':{
        'home':{'pricing':{'load_more':'txt1','empty_intro':'txt1'}},
        'recruit':{'core_intro':{'contact_button':'txt1'}},
        'feedback':{'core_form':{'contact_label':'txt1'}},
        'news-classify':{'core_listing':{'loading_label':'txt2'}},
        'solution':{'workload':{'card_title1':'txt1','card_desc1':'txt1','card_button1':'txt2','card_title2':'txt3','card_desc2':'txt2','card_button2':'txt4','card_title3':'txt3','card_desc3':'txt4','card_button3':'txt5'}}}}
    location_names={'load_more':'加载更多按钮文字','empty_intro':'暂无商品提示','empty_suffix':'暂无商品补充说明','contact_button':'联系招聘按钮文字','contact_label':'联系方式字段名称','loading_label':'加载中的提示'}
    semantic_names={
        ('feedback','core_form'):{'title':'表单标题','title2':'提交成功标题','txt1':'表单说明','txt2':'暂无反馈类型提示','txt3':'提交成功说明','txt4':'标题输入提示','txt5':'详细内容输入提示','txt6':'联系方式输入提示'},
        ('contact','contact_form'):{'txt4':'表单说明','txt5':'提交成功说明','txt6':'填写提示','txt7':'手机号码输入提示','txt8':'邮箱输入提示','txt9':'咨询内容输入提示','b2':'提交中的按钮文字'},
        ('news','core_listing'):{'txt1':'阅读全文按钮文字','txt8':'暂无新闻提示'},
        ('news-classify','core_listing'):{'txt1':'阅读全文按钮文字','txt2':'暂无分类新闻提示','txt3':'分页说明'},
        ('document','core_listing'):{'txt1':'搜索框提示','txt8':'暂无文档提示'},
        ('recruit','core_intro'):{'txt1':'技术与平台说明','txt2':'产品与服务说明','txt3':'销售与合作说明','txt4':'开放沟通说明','txt5':'应聘咨询说明'}}
    def visual(f, page=None):
        f = copy.deepcopy(f)
        key=f['key']; cols=f.get('cols',[])
        if key not in ['cloud_menu_text', 'cloud_menu_aside_text']: f['hint']=''
        if f['type']=='rows':
            f['addLabel']='添加条目'
        if key=='header_support_json':
            f['visual']={'widget':'support-contacts'}
        elif key=='nodes_panel_text':
            f['visual']={'widget':'nodes-units','controls':[{'key':'node','label':'节点数量单位','default':'节点','type':'text'},{'key':'rack','label':'机房数量单位','default':'机房','type':'text'}]}
        elif key.startswith('copy_'):
            mid=key[5:-5] if key.startswith('copy_') else 'nodes_panel'
            found={}
            selected_templates=templates
            if page:
                selected_templates={path:text for path,text in templates.items() if path.startswith(str(root/'public/web/cra1/sections'/page)+'/') or path in [str(root/'public/web/cra1/sections/_shared'/(mid+'.html')),str(root/'public/web/cra1'/(page+'.html'))]}
                if page=='home':selected_templates={path:text for path,text in templates.items() if path in [str(root/'public/web/cra1/sections/home'/(mid+'.html')),str(root/'public/web/cra1/index.html')]}
            for text in selected_templates.values():
                for match in re.finditer(r"cra1_content_value\(\$data.cra1, '"+re.escape(mid)+r"_copy\.(\w+)', '([^']*)'\)",text):
                    found.setdefault(match[1],match[2])
                for match in re.finditer(r'\$data\.cloud\.'+re.escape(mid)+r'_copy\.(\w+)(?:\|default=([\'"])(.*?)\2)?',text):
                    found.setdefault(match[1],match[3] or '')
                if key=='nodes_panel_text':
                    for match in re.finditer(r'\$data\.cloud\.nodes_panel\.(\w+)',text): found.setdefault(match[1],'')
                for match in re.finditer(r"\$data\.cloud\."+re.escape(mid)+r"_copy\[['\"](\w+)['\"]\]",text):
                    k=match[1]; found.setdefault(k,'')
                    fallback=re.search(r"\{if[^}]*\$data\.cloud\."+re.escape(mid)+r"_copy\[['\"]"+re.escape(k)+r"['\"]\][^}]*\}.*?\{else /\}(.*?)\{/if\}",text,re.S)
                    if fallback and '{' not in fallback[1] and '<' not in fallback[1]: found[k]=fallback[1].strip()
            defaults=out['fieldContracts'].get(key,{}).get('defaultValues',{}).get(key,'')
            defaultmap=dict(line.split('|',1) for line in str(defaults).splitlines() if '|' in line and not line.startswith('!'))
            # Add defaults only for keys actually consumed by these templates.
            # Dynamic program cards use ['t' . $pgi] / ['d' . $pgi].
            for text in selected_templates.values():
                for prefix in re.findall(r"\$data\.cloud\."+re.escape(mid)+r"_copy\[['\"](\w+)['\"]\s*\.\s*\$\w+\]",text):
                    for k,v in defaultmap.items():
                        if re.fullmatch(re.escape(prefix)+r'\d+',k): found.setdefault(k,v)
            for k in list(found):
                if found[k]=='': found[k]=defaultmap.get(k,'')
            content_defaults['copy'].setdefault(page or 'public',{})[mid]=dict(found)
            controls=[]
            for k, fallback in found.items():
                label=semantic_names.get((page,mid),{}).get(k) or LABELS.get(mid,{}).get(k) or location_names.get(k) or (CONTACT.get(k) if mid=='contact_form' else KEY_NAMES.get(k))
                card=re.match(r'^card_(title|desc|button)(\d+)$',k)
                if card: label='第 '+card[2]+' 张卡片'+{'title':'标题','desc':'说明','button':'按钮文字'}[card[1]]
                if not label:
                    m=re.match(r'^(t|d|l|tl|txt|item|btn|url|b)(\d+)$',k)
                    if m:
                        prefix,num=m.groups();label=f'第 {num} 项'+{'t':'标题','d':'说明','l':'名称','tl':'分组标题','txt':'文案','item':'内容','btn':'按钮文字','url':'链接','b':'按钮文字'}[prefix]
                    else: label='显示文案'+('：'+re.sub('<[^>]+>','',fallback or defaultmap.get(k,''))[:18] if fallback or defaultmap.get(k) else f' {len(controls)+1}')
                controls.append({'key':k,'label':label,'default':fallback,'type':'link' if k.startswith('url') or k.endswith('_url') else 'textarea' if len(fallback)>35 or k.startswith(('desc','txt','d')) else 'text'})
            f['visual']={'widget':'copy','controls':controls}
        elif key=='page_hero_anchor_text': f['visual']={'widget':'anchors'}
        elif key in ['page_hero_rows_text','prod_service_heads_text','prod_cta_btn1_text'] or re.match(r'^prod_\w+_title_text$',key):
            defaults={}; text=templates.get(str(root/'public/web/cra1'/((page or '')+'.html')),'')
            if page and key.startswith('prod_'):
                mid=key.split('_')[1]; text=templates.get(str(root/'public/web/cra1/sections'/page/(mid+'.html')),'')
                prefix='prod_'+mid
            else: prefix='page_hero'
            for c in cols:
                suffix={'title':'title','desc':'desc','btn1':'btn1_text','url1':'btn1_url','btn2':'btn2_text','url2':'btn2_url','text':'btn1_text','url':'btn1_url'}.get(c['key'],c['key'])
                m=re.search(r'\$data\.cloud\.'+re.escape(prefix+'_'+suffix)+r'\|default=([\'"])(.*?)\1',text)
                if m: defaults[c['key']]=m[2]
                if not m:
                    m=re.search(r'\{if[^}]*\$data\.cloud\.'+re.escape(prefix+'_'+suffix)+r'[^}]*\}.*?\{else /\}(.*?)\{/if\}',text,re.S)
                    if m and '<' not in m[1] and '{' not in m[1]: defaults[c['key']]=m[1].strip()
                    elif m and c['key'].startswith(('btn','url','text')):
                        link=re.search(r'<a href="([^"]+)"[^>]*>([^<]+)</a>',m[1])
                        if link: defaults[c['key']]=link[1] if c['key'].startswith('url') else link[2]
                if c['key'].startswith('url'):
                    m=re.search(r"cra1_content_value\(\$data.cra1, '"+re.escape(prefix+'_'+suffix)+r"', '([^']*)'\)",text)
                    if m: defaults[c['key']]=m[1]
            if key=='prod_service_heads_text':defaults={'first':'项目','second':'适用方式','third':'说明'}
            if key=='prod_cta_btn1_text':
                fallback=re.search(r"\{if[^}]*prod_cta_btn1[^}]*\}.*?\{else /\}<a href=\"([^\"]+)\"[^>]*>([^<]+)</a>",text,re.S)
                if fallback:defaults={'text':fallback[2],'url':fallback[1]}
            visible=[c['key'] for c in cols if c['key']!='page']
            legacy={};legacy_copy={}
            if key=='page_hero_rows_text' and page:
                visible=[]
                for c in cols:
                    suffix={'title':'title','desc':'desc','btn1':'btn1_text','url1':'btn1_url','btn2':'btn2_text','url2':'btn2_url'}.get(c['key'],c['key'])
                    if 'page_hero_'+suffix in text: visible.append(c['key'])
                if page and page.startswith('solution/'):
                    industry=page.split('/')[1]
                    for c in ['title','desc']:
                        legacy[c]='sol_ind_'+industry+'_hero_'+c
                        defaults[c]=out['fieldContracts'].get(legacy[c],{}).get('defaultValues',{}).get(legacy[c],'')
                    defaults.update(btn1='立即上云',url1='/cart/goodsList.htm',btn2='咨询方案',url2='/contact.html')
                content_defaults['hero'][page or 'public']={'defaults':defaults,'legacyKeys':legacy,'visibleColumns':visible}
            if re.match(r'^prod_\w+_title_text$',key) and page:
                visible=[c for c in visible if prefix+'_'+c in text]
                if page=='solution' and key=='prod_cta_title_text':
                    legacy={'title':'sol_cta_title'}
                    defaults['title']=out['fieldContracts']['sol_cta_title']['defaultValues']['sol_cta_title']
            if key.startswith('prod_') and key.endswith('_title_text') and prefix+'_desc' in text:
                match=re.search(r"\$data\.cloud\.(\w+)_copy\[['\"](desc(?:_\w+)?)['\"]\]",text)
                if match:
                    copy_mid,copy_key=match.groups();legacy_copy['desc']={'module':copy_mid,'key':copy_key}
                    fallback=re.search(r"\{if[^}]*"+re.escape(copy_mid)+r"_copy\[['\"]"+re.escape(copy_key)+r"['\"]\][^}]*\}.*?\{else /\}([^<{]*?)\{/if\}",text,re.S)
                    if fallback:defaults['desc']=fallback[1].strip()
            f['visual']={'widget':'single-row','defaults':defaults,'visibleColumns':visible,'legacyKeys':legacy,'legacyCopy':legacy_copy}
            if page is None:
                f['visual']['defaults']={}
                f['visual']['publicDefault']=True
        elif key=='prod_advantages_items_text' and page=='cloud':
            # This legacy empty field renders two hard-coded lists. An edit must
            # start with the displayed entries rather than an empty card list.
            text=templates.get(str(root/'public/web/cra1/sections/cloud/advantages.html'),'')
            rows=[]
            for title,items in re.findall(r'<h3[^>]*>([^<{]+)</h3><ul[^>]*>(.*?)</ul>',text,re.S):
                desc='；'.join(re.findall(r'<li>(.*?)</li>',items,re.S))
                rows.append('cloud|'+title+'|'+desc)
            f['visual']={'widget':'rows','fallbackRows':'\n'.join(rows)}
        elif key=='home_products_group':
            f['label']='默认商品分类';f['visual']={'widget':'product-group'}
        elif any(t in key for t in ['image','qrcode','picture']) and f['type'] in ['text','textarea']: f['visual']={'widget':'image'}
        elif (key.endswith(('_url','_link')) or 'url'==key) and f['type']=='text': f['visual']={'widget':'link'}
        else: f['visual']={'widget':f['type']}
        # The storage contract is wider than each layout's display contract.
        # Keep every physical column, but offer only controls the template uses.
        match=re.fullmatch(r'(\w+)_rows_text',key)
        if match:
            template=templates.get(str(root/'public/web/cra1/sections/_shared'/(match[1]+'.html')),'')
            if template:
                used=set(re.findall(r"\$\w+\[['\"](\w+)['\"]\]",template))
                if 'icon_img' in used:used.add('icon')
                # The page selector is consumed by the row resolver before
                # rendering; it remains available for shared multi-page rows.
                f['visual']['visibleColumns']=[c['key'] for c in cols if c['key']=='page' or c['key'] in used]
                if page and key=='price_slider_rows_text':f['label']='价格条目'
        for c in f.get('cols',[]):
            c.pop('placeholder',None)
            if c.get('url'): c['type']='link'
            elif c['key'] in ['image','img','picture','qrcode']: c['type']='image'
            elif key=='mega_notes_text' and c['key']=='match': c['type']='product-match';c['label']='商品'
        return f

    # Product-navigation notes belong to the header, even though the old form
    # placed them next to floating tools.
    note=next((f for f in scopes['site-float']['fields'] if f['key']=='mega_notes_text'),None)
    if note:
        scopes['site-float']['fields'].remove(note);scopes['site-float']['keys'].remove(note['key'])
        scopes['site-info']['fields'].append(note);scopes['site-info']['keys'].append(note['key'])
        out['assignments'][note['key']]=['site-info'];out['fieldContracts'][note['key']]['scopeIds']=['site-info']
        for entry in out['legacyEntries']:
            if entry['path'].endswith('/site-float') and 'site-info' not in entry['destinations']:entry['destinations'].append('site-info')
    for s in scopes.values():
        if s['domain']=='website':
            s['fields']=[visual(f) for f in s['fields']]
            for f in s['fields']:
                if f['adapter']=='shared-rows': f['boundPage']='*'
    editors={}
    for pk,p in pages.items():
        name=PAGE_NAMES.get(pk,re.sub(r'^(产品|行业方案)\s*·\s*','',p['label']))
        p['name']=name;p['editorLabel']=name+'配置'
        mods=[{'id':'page_hero','label':'页面顶部','fixed':True}]+[{'id':m['id'],'label':MODULE_NAMES.get(m['id'],m['label']),'visibilityKey':m.get('visibilityKey'),'fixed':False} for m in p['modules']]
        candidates=scopes['page:'+pk+':content']['fields'][:]
        for ref in scopes['page:'+pk+':content'].get('references',[]): candidates+=scopes[ref]['fields']
        pagefields={}
        for f in candidates:
            if f['key'].startswith('show_') or f['adapter']=='visibility-default': continue
            f=visual(f,pk);key=f['key'];mid=f.get('moduleId','page_hero')
            if mid=='home-nodes':mid='nodes';f['moduleId']=mid
            if key.startswith('sol_ind_') and key.endswith(('_hero_title','_hero_desc')): continue
            if f['visual']['widget']=='copy' and not f['visual']['controls']:continue
            if pk=='home' and key.startswith('page_hero_'):continue
            main=templates.get(str(root/'public/web/cra1'/(pk+'.html')),'')
            if key=='page_hero_anchor_text' and 'page_hero_anchors' not in main: continue
            if key=='page_hero_rows_text' and (pk=='solution' or not f['visual'].get('visibleColumns')): continue
            page_templates={path:text for path,text in templates.items() if path.startswith(str(root/'public/web/cra1/sections'/pk)+'/')}
            if key.startswith('prod_'):
                derived=key.removesuffix('_text')
                if derived.endswith(('_title','_items')):derived=derived.rsplit('_',1)[0]
                if not any(derived in text for text in page_templates.values()): continue
            if pk=='solution' and key=='sol_cta_title':continue
            if key in ['sol_page_title','sol_page_desc','sol_hero_btn_text']: mid='page_hero';f['moduleId']=mid
            if key.startswith('copy_'):
                copyid=key[5:-5]
                consumers=[path for path,text in page_templates.items() if copyid+'_copy' in text]
                if consumers:
                    mid=Path(consumers[0]).stem;f['moduleId']=mid
                elif copyid+'_copy' in main:mid='page_hero';f['moduleId']=mid
                elif any(copyid+'_copy' in text for path,text in templates.items() if '/sections/_shared/' in path):mid=copyid;f['moduleId']=mid
            normalized=pk.replace('/','_').replace('-','_')
            match=re.match(r'^(price_slider|link_tiles)_'+re.escape(normalized)+r'_(title|link|more_text|text)$',key)
            if match: continue
            if f.get('cols') and f['cols'][0]['key']=='page':
                f['adapter']='page-rows';f['boundPage']=pk
                if mid in ['price_slider','link_tiles']: f['legacyPageKey']=mid+'_'+normalized+'_text'
            if mid in ['price_slider','link_tiles'] and key==mid+'_rows_text': f['legacyPageKey']=mid+'_'+normalized+'_text'
            if mid in ['price_slider','link_tiles'] and key.startswith(mid+'_') and key[len(mid)+1:] in ['title','link','more_text']: f['legacyPageKey']=mid+'_'+normalized+'_'+key[len(mid)+1:]
            pagefields.setdefault(key,f)
        # A product description has one editor. Copy rows remain a legacy
        # fallback for the same position, not a second competing control.
        for f in list(pagefields.values()):
            for binding in f.get('visual',{}).get('legacyCopy',{}).values():
                copy_field=pagefields.get('copy_'+binding['module']+'_text')
                if copy_field:
                    copy_field['visual']['controls']=[c for c in copy_field['visual']['controls'] if c['key']!=binding['key']]
                    if not copy_field['visual']['controls']:pagefields.pop(copy_field['key'])
        # Some legacy groups are not a sortable module but still need a business section.
        known={m['id'] for m in mods}
        for f in pagefields.values():
            mid=f.get('moduleId','page_hero')
            if mid not in known:
                label='页面文字' if mid.startswith(('sol-','page-')) else MODULE_NAMES.get(mid,scopes['page:'+pk+':content']['label'].replace('内容',''))
                mods.append({'id':mid,'label':label,'fixed':True});known.add(mid)
        editors['page:'+pk]={'id':'page:'+pk,'domain':'website','label':name+'配置','pageKey':pk,'category':p['category'],'route':p['route'],'sections':{'content':'page:'+pk+':content','layout':'page:'+pk+':layout','seo':'page:'+pk+':seo'},'fields':list(pagefields.values()),'modules':mods,'kind':'page'}
    for id,label,ids in [('header','头部配置',['site-info','site-menu','site-support']),('footer','底部配置',['site-footer']),('float','悬浮工具配置',['site-float']),('seo-default','搜索引擎默认设置',['site:seo']),('custom','自定义 CSS / JS',['site-custom'])]:
        editors[id]={'id':id,'domain':'website','label':label,'kind':'public','sections':{s:s for s in ids},'fields':[]}
    for id,s in scopes.items():
        if s['kind']=='shared': editors['common:'+s['moduleId']]={'id':'common:'+s['moduleId'],'domain':'website','label':MODULE_NAMES.get(s['moduleId'],s['label'])+'通用内容','kind':'public','sections':{id:id},'fields':[],'affectedPageKeys':s['affectedPageKeys']}
    anchor_pages=[pk for pk in pages if any(f['key']=='page_hero_anchor_text' for f in editors['page:'+pk]['fields'])]
    anchors={}
    for pk in anchor_pages:
        for m in editors['page:'+pk]['modules']:
            if not m['fixed']: anchors.setdefault(m['id'],dict(m))
    if 'common:page_hero' in editors:
        editors['common:page_hero']['anchorModules']=list(anchors.values())
    listing_aliases={
        'document':{'document_search_hint':'txt1','document_empty':'txt8'},
        'news':{'news_read_more':'txt1','news_empty':'txt8'},
        'news-classify':{'news_read_more':'txt1'},
        'announce':{'announce_empty':'txt8'},
    }
    for pk, aliases in listing_aliases.items():
        content_defaults['aliases'].setdefault(pk,{}).setdefault('core_listing',{}).update(aliases)
        content_defaults['aliases'].setdefault('public',{}).setdefault('core_listing',{}).update(aliases)
    for pk in ['public','document-details','document-view']:
        content_defaults['aliases'].setdefault(pk,{}).setdefault('core_article',{}).update({'txt3':'txt5','txt4':'txt6'})
    for domain in ['member','cart']:
        id=domain+':custom';scopes[id]={'id':id,'domain':domain,'label':'自定义 CSS / JS','kind':'custom-code','keys':['custom_code'],'fields':[]}
        out['contracts'][domain]['custom_code']={'css':'scalar','js':'scalar','css_enabled':'scalar','js_enabled':'scalar'}
        for id,s in list(scopes.items()):
            if s['domain']==domain:
                local=id.split(':',1)[1];label=('首页' if domain=='member' and local=='home' else s['label'])
                label={'sidebar':'菜单配置','appearance':'外观配置','ticket':'工单提交助手配置','custom':'自定义 CSS / JS'}.get(local,label if label.endswith('配置') else label+'配置')
                editors[domain+':'+local]={'id':local,'domain':domain,'label':label,'kind':'public' if local in ['sidebar','appearance','custom'] else 'page','sections':{'main':id},'fields':[]}
    out['editors']=editors
    ownership={}
    def assign(key,editor,part,via='field'):
        ownership.setdefault(key,[]).append({'editor':editor,'part':part,'via':via})
    for eid,e in editors.items():
        if e['domain']!='website':continue
        for f in e['fields']:
            for k in f['keys']:assign(k,eid,f.get('moduleId',''),f['visual']['widget'])
            if f.get('legacyPageKey'):assign(f['legacyPageKey'],eid,f.get('moduleId',''),'compatibility')
        if e['kind']=='public':
            for sid in e['sections'].values():
                for k in scopes[sid]['keys']:assign(k,eid,sid)
        if e['kind']=='page':
            for m in e['modules']:
                if m.get('visibilityKey'):assign(m['visibilityKey'],eid,m['id'],'display-switch')
            if e['pageKey'].startswith('solution/'):
                industry=e['pageKey'].split('/')[1]
                for suffix in ['title','desc']:assign('sol_ind_'+industry+'_hero_'+suffix,eid,'page_hero','page-header')
    # Fields without a live consumer stay stored and covered by compatibility
    # ownership; they are no longer presented as working page controls.
    for key in out['fieldContracts']:
        if key not in ownership: assign(key,'compatibility','历史数据','preserved-only')
    out['editorAssignments']=ownership
    out['contentDefaults']=content_defaults
    out['schema']=3
    return out
