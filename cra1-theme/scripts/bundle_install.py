#!/usr/bin/env python3
"""Combine an unchanged install archive with the current illustrated guide."""
import argparse
import hashlib
import json
import pathlib
import re
import stat
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
GUIDES = {
    'docs/installation.md': '安装教程/安装教程.md',
    'docs/installation.html': '安装教程/安装教程.html',
    'docs/installation.pdf': '安装教程/安装教程.pdf',
    'cra1-theme/docs/nginx.example.conf': '安装教程/nginx.example.conf',
}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def read_source(root, relative):
    file = root / relative
    if any(p.is_symlink() for p in [file, *file.parents] if p != root.parent):
        raise ValueError('Guide input must not follow symlinks: ' + relative)
    if not file.is_file():
        raise ValueError('Guide input is missing: ' + relative)
    return file.read_bytes()


def guide_sources(root):
    """Only reviewed guide files and images referenced by its Markdown are included."""
    root = pathlib.Path(root).resolve()
    files = {rel: read_source(root, rel) for rel in GUIDES}
    markdown = files['docs/installation.md'].decode('utf-8')
    images = re.findall(r'!\[[^\]]*\]\(([^)]+)\)', markdown)
    if not images:
        raise ValueError('The installation guide must contain screenshots')
    for image in images:
        if not re.fullmatch(r'images/[A-Za-z0-9_-]+\.(?:png|jpg|jpeg|webp)', image):
            raise ValueError('Guide images must use local reviewed filenames')
        rel = 'docs/' + image
        files[rel] = read_source(root, rel)
    if not files['docs/installation.pdf'].startswith(b'%PDF-'):
        raise ValueError('Installation PDF is invalid')
    return files


def install_metadata(archive):
    with zipfile.ZipFile(archive) as zipped:
        entries = zipped.infolist()
        if len(entries) > 20000 or sum(e.file_size for e in entries) > 500 * 1024 * 1024:
            raise ValueError('Install archive exceeds expected limits')
        names = set()
        for entry in entries:
            name = pathlib.PurePosixPath(entry.filename)
            if (name.is_absolute() or '..' in name.parts or '\\' in entry.filename
                    or stat.S_IFMT(entry.external_attr >> 16) == stat.S_IFLNK
                    or entry.filename in names):
                raise ValueError('Invalid install archive entry')
            names.add(entry.filename)
        manifest_path = 'cra1-theme/release.json'
        manifest = json.loads(zipped.read(manifest_path))
        release = manifest.get('release', '')
        if manifest.get('product') != 'cra1-theme' or not re.fullmatch(r'[a-z0-9][a-z0-9-]{3,80}', release):
            raise ValueError('Install archive has no valid CRA1 version')
        version = manifest.get('version', release)
        if 'version' in manifest and (not isinstance(version, str) or not re.fullmatch(r'v[0-9]+\.[0-9]+(?:\.[0-9]+)?', version)):
            raise ValueError('Install archive has an invalid public version')
        files = manifest.get('files', {})
        if not files or names != set(files) | {manifest_path}:
            raise ValueError('Install archive differs from its file manifest')
        for name, row in files.items():
            data = zipped.read(name)
            if sha(data) != row.get('sha256') or len(data) != row.get('bytes'):
                raise ValueError('Install archive checksum mismatch: ' + name)
        return {'release': release, 'version': version, 'release_channel': manifest.get('release_channel', 'candidate')}


def install_identity(archive):
    return install_metadata(archive)['release']


def bundle_install(install, output, source=ROOT):
    install = pathlib.Path(install).resolve()
    source = pathlib.Path(source).resolve()
    output = pathlib.Path(output).resolve()
    if output == source or source in output.parents:
        raise ValueError('Delivery output must be outside the source tree')
    metadata = install_metadata(install)
    release, version = metadata['release'], metadata['version']
    guides = guide_sources(source)
    filename = f'CRA1-theme-{version}-install-with-guide.zip'
    output.mkdir(parents=True, exist_ok=True)
    target = output / filename
    if target.exists():
        raise FileExistsError('Delivery already exists; refusing to overwrite it')
    files = {'cra1-theme-install.zip': install.read_bytes()}
    for relative, data in guides.items():
        name = GUIDES.get(relative, '安装教程/' + relative.removeprefix('docs/'))
        files[name] = data
    files['开始安装.txt'] = (
        f'酷锐A1主题安装合集\n版本：{version}' + ('（测试版）' if metadata['release_channel'] == 'test' else '') + '\n\n'
        '1. 先在电脑上解压本合集，阅读“安装教程/安装教程.pdf”或“安装教程/安装教程.html”。\n'
        '2. 实际上传网站的是 cra1-theme-install.zip，解压到 V10 网站根目录，与 config.php、vendor 和 public 同级。\n'
        '3. 按教程配置目录保护、完成自检，再使用 V10 超级管理员进入安装向导。\n\n'
        '本包用于首次安装。已安装主题请使用配套更新包，在主题后台“主题管理 → 安装与更新”操作。\n'
        '教程使用示例资料，密码已隐藏或遮盖，请填写自己的信息。\n\n'
        '安装交流 QQ 群：603107399\n加群链接：https://qm.qq.com/q/O3d7bVtcoS\n'
    ).encode('utf-8')
    # Exclusive creation protects previous deliveries, even when the version is unchanged.
    with target.open('xb') as stream:
        try:
            with zipfile.ZipFile(stream, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zipped:
                for name, data in sorted(files.items()):
                    info = zipfile.ZipInfo(name, (2026, 1, 1, 0, 0, 0))
                    info.create_system = 3
                    info.external_attr = (stat.S_IFREG | 0o644) << 16
                    info.compress_type = zipfile.ZIP_DEFLATED
                    zipped.writestr(info, data)
        except BaseException:
            target.unlink(missing_ok=True)
            raise
    return {'path': target.name, 'release': release, 'version': version, 'bytes': target.stat().st_size,
            'sha256': sha(target.read_bytes()), 'install_sha256': sha(files['cra1-theme-install.zip'])}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--install', required=True, type=pathlib.Path)
    parser.add_argument('--out', required=True, type=pathlib.Path)
    parser.add_argument('--source', default=ROOT, type=pathlib.Path)
    args = parser.parse_args()
    print(json.dumps(bundle_install(args.install, args.out, args.source), ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
