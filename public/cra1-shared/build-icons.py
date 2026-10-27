#!/usr/bin/env python3
"""Build read-only, sanitised icon groups. Never mutate the imported root."""
from pathlib import Path
import json, os, re, subprocess, hashlib, xml.etree.ElementTree as ET
root=Path(os.environ.get('CRA1_THEME_SOURCE_ROOT',Path(__file__).resolve().parents[2])).resolve()
release=os.environ.get('CRA1_SHARED_RELEASE','20261012-icon-suite-v1')
base=root/'public/web/cra1/assets/icons'
out=root/'public/cra1-shared/icons/releases'/release
out.mkdir(parents=True,exist_ok=True)
allowed={'svg','g','path','rect','circle','ellipse','polygon','polyline','line','defs','linearGradient','radialGradient','stop','clipPath','mask','title'}
attrs={'viewBox','d','x','y','x1','x2','y1','y2','cx','cy','r','rx','ry','width','height','points','fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','fill-rule','clip-rule','opacity','fill-opacity','stroke-opacity','transform','id','offset','stop-color','stop-opacity','gradientUnits','gradientTransform','clip-path','mask','maskUnits','color'}
def clean(raw):
 if '<!DOCTYPE' in raw.upper() or '<!ENTITY' in raw.upper(): raise ValueError('SVG entities')
 el=ET.fromstring(raw)
 def walk(node):
  node.tag=node.tag.split('}')[-1]
  for child in list(node):
   if child.tag.split('}')[-1] not in allowed: node.remove(child)
   else: walk(child)
  for k,v in list(node.attrib.items()):
   if k not in attrs or re.search(r'(?:javascript:|https?:|data:|expression|[<>])',v,re.I): del node.attrib[k]
  node.text=None; node.tail=None
 walk(el)
 if el.tag!='svg': raise ValueError('Not SVG')
 el.set('xmlns','http://www.w3.org/2000/svg')
 if 'viewBox' not in el.attrib: el.set('viewBox','0 0 24 24')
 el.attrib.pop('width',None);el.attrib.pop('height',None)
 return ET.tostring(el,encoding='unicode',short_empty_elements=True)
def mono(svg):
 colors=set(re.findall(r'(?:fill|stroke|stop-color)="([^" ]+)"',svg));colors-={'none','currentColor','inherit','transparent'}
 return not any(x.startswith('url(') for x in colors) and len(colors)<=1
def item(id,label,svg,url='',category='builtin',source='',keywords=''):
 svg=clean(svg); colorable=category!='simple-icons' and mono(svg)
 # A single fixed SVG ink becomes currentColor in the sanitised version only.
 if colorable: svg=re.sub(r'(fill|stroke)="(?!none"|currentColor"|inherit")[^" ]+"',r'\1="currentColor"',svg)
 slug=hashlib.sha256(id.encode()).hexdigest()[:20]+'.svg'
 (out/slug).write_text(svg)
 return dict(id=id,label=label,category=category,source=source or category,url=f'/cra1-shared/icons/releases/{release}/{slug}',svg=svg,colorable=colorable,available=True,keywords=keywords)
php='require '+json.dumps(str(root/'public/web/cra1/controller/BuiltinIcons.php'))+'; $a=[];foreach(cra1_builtin_icons() as $k=>$d){$d["svg"]=cra1_builtin_icon_svg($k);$a[$k]=$d;}echo json_encode($a,JSON_UNESCAPED_UNICODE);'
built=json.loads(subprocess.check_output(['php','-r',php]))
groups={'builtin':[item(k,v['label'],v['svg'],keywords=v.get('keywords',''),source='主题自带') for k,v in built.items()]}
groups['builtin'].append(item('default:website:menu','菜单默认图形','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16v10H4zM8 4h8M8 20h8M8 11h.01M8 14h.01M12 11h5M12 14h5"/></svg>',source='当前位置默认图形'))
index=json.loads((base/'index.json').read_text())
order=['tabler','lucide','iconoir','ph','heroicons','solar','mdi','material-symbols','ri','bx','octicon','jam','fa6-solid','simple-icons']
labels={'builtin':'主题自带','tabler':'Tabler','mdi':'MDI','ph':'Phosphor','lucide':'Lucide','solar':'Solar','iconoir':'Iconoir','heroicons':'Heroicons','fa6-solid':'Font Awesome','material-symbols':'Material','ri':'Remix','bx':'BoxIcons','octicon':'Octicons','jam':'Jam','simple-icons':'品牌 Logo','member-legacy':'会员旧图标','cart-defaults':'购物车默认'}
for prefix in list(dict.fromkeys(order+list(index))):
 groups[prefix]=[]
 for name in index.get(prefix,{}).get('names',[]):
  file=base/(prefix+'-'+name+'.svg')
  if file.is_file(): groups[prefix].append(item(prefix+':'+name,name,file.read_text(),category=prefix,source=labels.get(prefix,prefix)))
# Exact existing cart glyphs, rather than similar Lucide replacements.
cart=(root/'public/cart/template/pc/cra1/js/cart-controls.js').read_text()
paths=dict(re.findall(r"^    (\w+): '([^']+)'",cart.split('const paths = {',1)[1].split('\n  };',1)[0],re.M))
kinds=dict(re.findall(r"(\w+):'([^']+)'",cart.split('const headingKinds = {',1)[1].split('};',1)[0]))
heading_labels=json.loads((root/'cra1-theme/source/admin/src/cart.headings.json').read_text())
groups['cart-defaults']=[item('default:cart:'+k,heading_labels.get(k,{}).get('label',k),'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+paths[n]+'</svg>',category='cart-defaults',source='购物车原始图形') for k,n in kinds.items()]
# Preserve the iconfont geometry used by the legacy member sidebar.
font=ET.parse(root/'public/upload/common/iconfont/iconfont.svg').getroot()
fontpaths={g.attrib.get('unicode'):g.attrib.get('d','') for g in font.iter() if g.tag.split('}')[-1]=='glyph'}
css=(root/'public/upload/common/iconfont/iconfont.css').read_text()
groups['member-legacy']=[]
for name,code in re.findall(r'\.(icon-[\w-]+):before\s*\{\s*content:\s*"\\([0-9a-fA-F]+)"',css):
 d=fontpaths.get(chr(int(code,16)))
 if d: groups['member-legacy'].append(item(name,name,'<svg viewBox="0 0 1024 1024"><g transform="translate(0 896) scale(1 -1)" fill="currentColor"><path d="'+d+'"/></g></svg>',category='member-legacy',source='会员 iconfont 原图'))
# Exact React quick-link defaults, including collisions such as wallet/shield.
quick=['wallet','package','arrow-up-right','life-buoy','users','shield','newspaper','shopping-cart','file-text','server','credit-card','lock','clock','gift','headphones']
node=os.environ.get('CRA1_NODE','node')
modules=root/'cra1-theme/source/member/node_modules'
js="const base=process.argv[1];const R=require(base+'/react');const S=require(base+'/react-dom/server');const L=require(base+'/lucide-react');console.log(JSON.stringify(Object.fromEntries("+json.dumps(quick)+".map(k=>[k,S.renderToStaticMarkup(R.createElement(L[k.split('-').map(s=>s[0].toUpperCase()+s.slice(1)).join('')]))]))));"
for name,svg in json.loads(subprocess.check_output([node,'-e',js,str(modules)])).items():
 groups['member-legacy'].append(item('legacy:quick:'+name,name,svg,category='member-legacy',source='会员快捷入口原图'))
meta=[]
for key,icons in groups.items():
 if not icons: continue
 (out/(key+'.json')).write_text(json.dumps(icons,ensure_ascii=False,separators=(',',':')))
 meta.append(dict(key=key,label=labels.get(key,key),total=len(icons),note='原色图标' if key=='simple-icons' else '本地图标'))
(out/'catalog.json').write_text(json.dumps(dict(version=release,categories=meta),ensure_ascii=False,separators=(',',':')))
# Lookup stores group/offset only; full SVGs load once per requested group.
lookup={it['id']:[key,i] for key,icons in groups.items() for i,it in enumerate(icons)}
lookup.update({it['url']:[key,i] for key,icons in groups.items() for i,it in enumerate(icons)})
(out/'lookup.json').write_text(json.dumps(lookup,separators=(',',':')))
print(json.dumps(dict(version=release,groups=len(meta),icons=sum(len(g) for g in groups.values()))))
