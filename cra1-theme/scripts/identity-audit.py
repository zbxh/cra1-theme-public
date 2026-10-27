#!/usr/bin/env python3
"""Check active CRA1 source contracts. Historical releases and upstream names are not rewritten."""
import argparse,hashlib,json,os,pathlib,re,sys

def audit(root):
    checks=[];failures=[]
    def check(ok,label):
        checks.append({'check':label,'passed':bool(ok)})
        if not ok:failures.append(label)
    identity=json.loads((root/'cra1-theme/docs/product-identity.json').read_text())
    expected={'product':'cra1-theme','display_name':'酷锐A1主题','brand':'CRA1','theme_id':'cra1','php_namespace':'CRA1\\Theme','controller':'template\\cra1\\controller\\Cra1','shared_global':'CRA1Shared','member_api_prefix':'/console/v1/cra1-theme/','session_cookie':'CRA1THEMEID'}
    for key,value in expected.items():check(identity.get(key)==value,'正式标识：'+key)
    terms=json.loads((root/'cra1-theme/docs/repository-license.json').read_text())
    text=(root/'cra1-theme/LICENSE.txt').read_text();sha=hashlib.sha256((root/'cra1-theme/LICENSE.txt').read_bytes()).hexdigest()
    check(terms['version']==2 and terms['file']=='cra1-theme/LICENSE.txt' and text.startswith(terms['title']+'（第 2 版'),'许可证正文与登记版本一致')
    for marker in ['全部业务营业收入','100,000 元（含本数）','连续 90 个自然日','80,000 元（含本数）','已结束的完整自然季度','不重新计算宽限期','不采集或上传营业收入','不是允许无限制商用']:
        check(marker in text,'许可约定：'+marker)
    for base in ['cra1-theme/source/admin','cra1-theme/source/member','public/cra1-shared','public/web/cra1/src']:
        p=root/base/'package.json';doc=json.loads(p.read_text());prefix='SEE LICENSE IN '
        valid=doc.get('license','').startswith(prefix)
        check(valid and (p.parent/doc['license'][len(prefix):]).resolve()==(root/'cra1-theme/LICENSE.txt').resolve(),'自有工程许可指向正文：'+base)
        lock=json.loads((p.parent/'package-lock.json').read_text());check(lock.get('packages',{}).get('',{}).get('license')==doc.get('license'),'锁文件根许可一致：'+base)
    guide=(root/'cra1-theme/docs/测试版与后续更新.md').read_text()
    check('cra1-theme/release.json' in guide and '当前已交付测试发行标识为' not in guide,'当前使用说明按发行清单识别版本，历史版本不冒充当前包')
    check(not any(word in guide for word in ['许可证','商业授权','商用发行','验收']),'客户使用说明仅包含安装和更新操作')
    pattern=re.compile(r'/(?:cloud-shared|cloudadmin|cloud-install|(?:web|(?:clientarea|cart|home)/template/(?:pc|mobile))/cloud)/|\bCloudShared\b|\bCLOUDTHEMEID\b|data-theme=[\'\"]cloud[\'\"]|data\.cloud\b|(?:Cloud\s*主题|Cloud Theme)',re.I)
    ignored={'node_modules','releases','.git','vendor','licenses','docs','previews','img','images','icons'}
    findings=[];scanned=0
    for base in ['cra1-theme/backend','cra1-theme/source','public/cra1admin','public/cra1-install','public/cra1-shared','public/web/cra1','public/clientarea/template/pc/cra1','public/cart/template/pc/cra1','public/home/template/pc/cra1']:
        for folder,dirs,files in os.walk(root/base,followlinks=False):
            dirs[:]=[d for d in dirs if d not in ignored and not (pathlib.Path(folder)/d).is_symlink()]
            for name in files:
                p=pathlib.Path(folder)/name
                if p.is_symlink() or p.suffix not in ['.php','.js','.jsx','.mjs','.css','.json','.html']:continue
                scanned+=1
                for number,line in enumerate(p.read_text(errors='replace').splitlines(),1):
                    if pattern.search(line):findings.append({'path':p.relative_to(root).as_posix(),'line':number,'matches':sorted(set(m.group() for m in pattern.finditer(line)))})
    check(not findings,'当前自有代码无旧主题标识输出')
    return {'status':'passed' if not failures else 'failed','checks':checks,'failures':failures,'scanned_files':scanned,'old_identity_findings':findings,'license_sha256':sha,'license_version':2,'production_writes':0}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--root',type=pathlib.Path,default=pathlib.Path(__file__).resolve().parents[2]);p.add_argument('--out',type=pathlib.Path);args=p.parse_args();result=audit(args.root.resolve())
    if args.out:
        if args.root.resolve()==args.out.resolve() or args.root.resolve() in args.out.resolve().parents:p.error('Write audit results outside the source site')
        if args.out.exists():p.error('Refusing to overwrite an audit record')
        args.out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(result,ensure_ascii=False,indent=2));sys.exit(0 if result['status']=='passed' else 1)
