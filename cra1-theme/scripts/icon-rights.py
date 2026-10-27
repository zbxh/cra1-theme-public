#!/usr/bin/env python3
"""Audit exact icon drawing provenance against locally downloaded, integrity-pinned upstream data.

This produces evidence outside the site. It never downloads data, changes icons, or approves
unmatched assets. Upstream license files and attribution must also accompany distribution.
"""
import argparse, base64, decimal, hashlib, json, pathlib, re, tarfile, xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parents[2]

def sha(data):
    return hashlib.sha256(data).hexdigest()

def shape(element):
    # Container size, viewport, attribute order and drawing order may be modified.
    # Every drawing element, attribute and coordinate must still match the upstream body.
    return (element.tag.split('}')[-1], tuple(sorted(element.attrib.items())),
            tuple(sorted((shape(child) for child in element), key=repr)))

def body_key(svg):
    if '<!DOCTYPE' in svg.upper() or '<!ENTITY' in svg.upper():
        raise ValueError('SVG entities are not supported')
    root = ET.fromstring(svg)
    if root.tag.split('}')[-1] != 'svg':
        raise ValueError('Expected an SVG')
    return tuple(sorted((shape(child) for child in root), key=repr))

def coordinate_key(svg):
    """Match coordinates without guessing geometrical equivalence or ignoring extra shapes.

    Paths may be serialized together or separately at absolute M commands. Paint,
    container metadata and path whitespace can differ in a derivative. Transforms,
    clipping and other geometry-affecting attributes remain part of the key.
    """
    if '<!DOCTYPE' in svg.upper() or '<!ENTITY' in svg.upper():
        raise ValueError('SVG entities are not supported')
    root = ET.fromstring(svg)
    ink = {'fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','opacity',
           'fill-opacity','stroke-opacity','color','class','aria-hidden','role','focusable'}
    number = re.compile(r'[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?')
    def tokens(value):
        parts = re.findall(r'[a-df-zA-DF-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?', value)
        # No unparsed syntax is silently discarded.
        if re.sub(r'[\s,]', '', re.sub(r'[a-df-zA-DF-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?', '', value)):
            raise ValueError('Unsupported SVG coordinate syntax')
        return tuple(str(decimal.Decimal(p).normalize()) if number.fullmatch(p) else ('Z' if p == 'z' else p) for p in parts)
    drawings = []
    def visit(node, ancestors=()):
        tag = node.tag.split('}')[-1]
        attrs = {k:v for k,v in node.attrib.items() if k not in ink}
        if tag == 'svg':
            attrs = {k:v for k,v in attrs.items() if k not in {'width','height','viewBox','xmlns','version'}}
        if tag in {'svg','g'}:
            context = ancestors + ((tuple(sorted(attrs.items())),) if attrs else ())
            for child in node:
                visit(child, context)
            return
        if tag not in {'path','rect','circle','ellipse','line','polyline','polygon'}:
            raise ValueError('Unsupported SVG drawing element')
        if tag == 'path':
            path = tokens(attrs.pop('d',''))
            sections = []
            start = 0
            for i,p in enumerate(path):
                if p == 'M' and i:
                    sections.append(path[start:i]); start = i
            sections.append(path[start:])
            for section in sections:
                drawings.append((tag, ancestors, tuple(sorted(attrs.items())), section))
        else:
            drawings.append((tag, ancestors, tuple(sorted((k,tokens(v) if k != 'transform' else (v,)) for k,v in attrs.items()))))
    visit(root)
    if not drawings:
        raise ValueError('No SVG drawings')
    return tuple(sorted(drawings, key=repr))

def sanitized(svg, category):
    allowed = {'svg','g','path','rect','circle','ellipse','polygon','polyline','line','defs','linearGradient','radialGradient','stop','clipPath','mask','title'}
    attrs = {'viewBox','d','x','y','x1','x2','y1','y2','cx','cy','r','rx','ry','width','height','points','fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','fill-rule','clip-rule','opacity','fill-opacity','stroke-opacity','transform','id','offset','stop-color','stop-opacity','gradientUnits','gradientTransform','clip-path','mask','maskUnits','color'}
    root = ET.fromstring(svg)
    def clean(node):
        node.tag = node.tag.split('}')[-1]
        for child in list(node):
            if child.tag.split('}')[-1] not in allowed:
                node.remove(child)
            else:
                clean(child)
        for key, value in list(node.attrib.items()):
            if key not in attrs or re.search(r'(?:javascript:|https?:|data:|expression|[<>])',value,re.I):
                del node.attrib[key]
        node.text = None
        node.tail = None
    clean(root)
    root.set('xmlns','http://www.w3.org/2000/svg')
    if 'viewBox' not in root.attrib:
        root.set('viewBox','0 0 24 24')
    root.attrib.pop('width',None)
    root.attrib.pop('height',None)
    result = ET.tostring(root,encoding='unicode',short_empty_elements=True)
    colors = set(re.findall(r'(?:fill|stroke|stop-color)="([^" ]+)"',result)) - {'none','currentColor','inherit','transparent'}
    if category != 'simple-icons' and not any(color.startswith('url(') for color in colors) and len(colors) <= 1:
        result = re.sub(r'(fill|stroke)="(?!none"|currentColor"|inherit")[^" ]+"',r'\1="currentColor"',result)
    return result.encode()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--upstream-dir',required=True,action='append',type=pathlib.Path)
    parser.add_argument('--out',required=True,type=pathlib.Path)
    args = parser.parse_args()
    out = args.out.resolve()
    if out.exists() or out == ROOT or ROOT in out.parents:
        parser.error('Use a new evidence directory outside the source site')
    out.mkdir(parents=True)
    evidence = {'format':1,'scope':'Drawing-source and redistribution-license evidence; no trademark authorization or site-asset rights inferred',
                'modifications':'SVG viewport/container resizing, drawing order, paint and attribute serialization; exact-coordinate matches also allow path whitespace, close-command case and grouping at absolute move commands. Sanitized copies remove unsafe elements/attributes and normalize monochrome color. No approximate or visual match is approved.',
                'sources':[]}
    definitions = {}
    by_shape = {}
    by_coordinates = {}
    inputs = [(directory,source) for directory in args.upstream_dir for source in json.loads((directory/'license-fetch.json').read_text())]
    seen_sources = set()
    for directory,source in sorted(inputs,key=lambda pair:(pair[1]['group'],pair[1]['version'])):
        group = source['group']
        identity = group+'@'+source['version']
        if identity in seen_sources:
            continue
        if source.get('error') or source.get('notice_search_error') or not source.get('license_files'):
            continue
        archive = (directory/(group+'-package.tgz')).read_bytes()
        metadata = json.loads((directory/(group+'-metadata.json')).read_text())
        algorithm, expected = metadata['dist']['integrity'].split('-',1)
        if base64.b64encode(hashlib.new(algorithm,archive).digest()).decode() != expected:
            raise ValueError('Package integrity mismatch: '+group)
        for license_file in source['license_files']:
            raw = (directory/license_file['name']).read_bytes()
            if sha(raw) != license_file['sha256']:
                raise ValueError('License bytes changed: '+group)
            target = out/'licenses'/license_file['name']
            target.parent.mkdir(exist_ok=True)
            if target.exists() and target.read_bytes() != raw:
                raise ValueError('Versioned license text needs distinct filename: '+group)
            target.write_bytes(raw)
        with tarfile.open(directory/(group+'-package.tgz')) as package:
            if source.get('asset_format') == 'svg-directory':
                prefix = source['svg_prefix']
                if not prefix.startswith('package/') or not prefix.endswith('/') or '..' in pathlib.PurePosixPath(prefix).parts:
                    raise ValueError('Invalid upstream SVG directory')
                icons = {'icons':{}}
                for member in package.getmembers():
                    if not member.isfile() or not member.name.startswith(prefix) or not member.name.endswith('.svg'):
                        continue
                    name = member.name[len(prefix):-4]
                    if '/' in name:
                        continue
                    svg = ET.fromstring(package.extractfile(member).read())
                    icons['icons'][name] = {'body':''.join(ET.tostring(child,encoding='unicode') for child in svg)}
            else:
                icons = json.load(package.extractfile('package/icons.json'))
        record = {key:source[key] for key in ['group','version','license','authors','license_files']}
        record.update(package=metadata['name'],package_url=metadata['dist']['tarball'],
                      package_sha256=sha(archive),npm_integrity=metadata['dist']['integrity'])
        for key in ['asset_format','svg_prefix']:
            if key in source:
                record[key] = source[key]
        for key in ['upstream_license_api','upstream_license_blob']:
            if key in source:
                record[key] = source[key]
        evidence['sources'].append(record)
        seen_sources.add(identity)
        for name, icon in icons['icons'].items():
            key = body_key('<svg>'+icon['body']+'</svg>')
            definition = (group,name,icon['body'],record)
            definitions.setdefault(group+':'+name,[]).append(definition)
            by_shape.setdefault(key,definition)
            try:
                by_coordinates.setdefault(coordinate_key('<svg>'+icon['body']+'</svg>'),definition)
            except ValueError:
                pass
        for name, alias in icons.get('aliases',{}).items():
            parent = alias.get('parent','')
            if set(alias) == {'parent'} and group+':'+parent in definitions:
                definitions.setdefault(group+':'+name,[]).extend(d for d in definitions[group+':'+parent] if d[3] == record)
    assets = {}
    matched = {}
    prefix = 'public/web/cra1/assets/icons/'
    icon_base = ROOT/'public/cra1-shared/icons/releases'
    version = json.loads((ROOT/'public/cra1-shared/icons/version.json').read_text())['version']
    for file in sorted([*(ROOT/prefix).glob('*.svg'),*(icon_base/version).glob('*.svg')]):
        raw = file.read_bytes()
        key = body_key(raw.decode())
        definition = None
        # Prefer the declared collection over accidental identical geometry in another collection.
        for group in sorted((row['group'] for row in evidence['sources']),key=len,reverse=True):
            if file.stem.startswith(group+'-'):
                for candidate in definitions.get(group+':'+file.stem[len(group)+1:],[]):
                    if body_key('<svg>'+candidate[2]+'</svg>') == key:
                        definition = candidate
                        break
                break
        if definition is None and not any(file.stem.startswith(row['group']+'-') for row in evidence['sources']):
            definition = by_shape.get(key)
        match_method = 'upstream SVG drawing tree matched'
        if definition is None:
            try:
                definition = by_coordinates.get(coordinate_key(raw.decode()))
                match_method = 'exact drawing coordinates matched; paint, path whitespace/grouping and container serialization may differ'
            except ValueError:
                pass
        if definition is None:
            continue
        group,name,body,source = definition
        row = {'sha256':sha(raw),'redistribution':'verified',
               'source':source['package']+'@'+source['version']+' / '+name,
               'license':source['license']['spdx'],
               'evidence':'cra1-theme/docs/icon-source-evidence.json#'+group+'@'+source['version']+'; '+match_method+'; source-body SHA-256 '+sha(body.encode())+'; attribution and original license in cra1-theme/licenses/icons/'}
        rel = file.relative_to(ROOT).as_posix()
        assets[rel] = row
        matched[group+':'+name] = (file,row,group)
    for group in {row['group'] for row in evidence['sources']}:
        catalog = icon_base/version/(group+'.json')
        if not catalog.is_file():
            continue
        for icon in json.loads(catalog.read_text()):
            source = matched.get(icon['id'])
            if not source:
                continue
            original,row,category = source
            path = icon['url'].lstrip('/')
            if not path.startswith('cra1-shared/icons/releases/'+version+'/') or '..' in pathlib.PurePosixPath(path).parts:
                raise ValueError('Invalid generated icon location')
            file = ROOT/'public'/path
            expected = sanitized(original.read_text(),category)
            if file.read_bytes() != expected:
                continue
            assets[file.relative_to(ROOT).as_posix()] = {**row,'sha256':sha(expected),
                'evidence':row['evidence']+'; sanitized derivative of '+original.relative_to(ROOT).as_posix()}
    evidence['verified_files'] = len(assets)
    (out/'icon-source-evidence.json').write_text(json.dumps(evidence,ensure_ascii=False,indent=2)+'\n')
    (out/'asset-rights.json').write_text(json.dumps({'format':1,'assets':assets},ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'verified_files':len(assets),'collections':len(evidence['sources']),'unmatched_assets_remain_unverified':True,'production_writes':0}))

if __name__ == '__main__':
    main()
