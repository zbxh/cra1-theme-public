#!/usr/bin/env python3
"""Run installer permission cases as an ordinary PHP user, never as root."""
import argparse
import json
import os
from pathlib import Path
import pwd
import shutil
import subprocess
import tempfile

parser = argparse.ArgumentParser()
parser.add_argument('--php', default='php')
args = parser.parse_args()
source = Path(__file__).resolve().parents[2]
php = shutil.which(args.php)
if not php:
    raise RuntimeError('PHP is unavailable')
account = pwd.getpwnam('www') if os.geteuid() == 0 else pwd.getpwuid(os.geteuid())
prefix = ['runuser', '-u', account.pw_name, '--'] if os.geteuid() == 0 else []
checks = []


def check(value, label):
    if not value:
        raise AssertionError(label)
    checks.append(label)


with tempfile.TemporaryDirectory(prefix='cra1-install-permissions-') as temporary:
    base = Path(temporary)
    base.chmod(0o755)
    site = base / 'site'
    backend = site / 'cra1-theme/backend'
    shutil.copytree(source / 'cra1-theme/backend', backend, ignore=shutil.ignore_patterns('releases'))
    for relative in ['lib', 'config', 'runtime/cra1_theme', 'public/cra1admin', 'public/cra1-install', 'public/upload']:
        (site / relative).mkdir(parents=True, exist_ok=True)
    for name in ['cra1_theme_security.php', 'cra1_theme_media.php']:
        shutil.copyfile(source / 'lib' / name, site / 'lib' / name)
    shared = site / 'public/cra1-shared'
    shared.mkdir(parents=True)
    for path in (source / 'public/cra1-shared').glob('*.php'):
        shutil.copyfile(path, shared / path.name)
    for name in ['index.php', 'api.php', 'installer.js', 'installer.css']:
        shutil.copyfile(source / 'public/cra1-install' / name, site / 'public/cra1-install' / name)
    (site / 'public/cra1admin/index.php').write_text('fixture administrator')
    manifest = {'release': 'fixture-permissions-v1', 'references': [], 'files': {}}
    release = site / 'cra1-theme/release.json'
    release.write_text(json.dumps(manifest))
    script = base / 'exercise.php'
    script.write_text('''<?php
require $argv[1].'/cra1-theme/backend/bootstrap.php';
$installer=new CRA1\\Theme\\Release\\Installer($argv[1]);
$options=['https'=>true,'context'=>['database'=>true,'system_version'=>'10.7.4']];
try {
 $preflight=$installer->preflight($options);
 if($argv[2]==='inspect')$result=$preflight;
 elseif($argv[2]==='render'){include $argv[1].'/public/cra1-install/index.php';exit;}
 else $result=$installer->install(['entry'=>$argv[3],'username'=>'fixture_admin','password'=>'Fixture-password-2026!','canonical'=>'https://fixture.invalid'],$preflight,'https://fixture.invalid');
 echo json_encode($result,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
}catch(Throwable $error){echo json_encode(['error'=>$error->getMessage()],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);}
''')
    for directory, _, files in os.walk(site):
        Path(directory).chmod(0o755)
        for name in files:
            (Path(directory) / name).chmod(0o644)
    script.chmod(0o644)
    # Only the data locations are owned by PHP. Uploaded programs stay read-only.
    for path in [site / 'config', site / 'runtime', site / 'runtime/cra1_theme']:
        os.chown(path, account.pw_uid, account.pw_gid)
        path.chmod(0o700)
    for path in [backend, site / 'public/cra1admin', site / 'public/cra1-install', site / 'public/upload', site / 'public']:
        path.chmod(0o555)

    def exercise(action='inspect', entry='cra1admin', flags=()):
        result = subprocess.run([*prefix, php, *flags, str(script), str(site), action, entry], capture_output=True, text=True)
        if result.returncode:
            raise RuntimeError(result.stderr + result.stdout)
        return result.stdout if action == 'render' else json.loads(result.stdout)

    try:
        result = exercise()
        check(result['installation_ready'], 'read-only uploaded programs and public root permit default-entry initialization')
        check(len(result['checks']) == 6, 'permission cases remain inside the six existing check groups')
        result = exercise('install', 'exampleadmin')
        check('public/' in result.get('error', '') and 'cra1admin' in result['error'], 'custom entry explains the required parent rename permission')
        check(not (site / 'config/cra1_theme_security.key').exists(), 'rename permission failure occurs before any identity is created')

        (site / 'config').chmod(0o500)
        result = exercise()
        check(not result['installation_ready'] and 'config' in result['checks'][3]['detail'], 'unwritable key directory reports its relative path')
        (site / 'config').chmod(0o700)
        (site / 'runtime/cra1_theme').chmod(0o500)
        result = exercise()
        check(not result['installation_ready'] and 'runtime/cra1_theme' in result['checks'][3]['detail'], 'unwritable data directory reports its relative path')
        (site / 'runtime/cra1_theme').chmod(0o700)
        distribution = site / 'runtime/cra1_theme/distribution'
        distribution.mkdir()
        distribution.chmod(0o555)
        result = exercise()
        check(not result['installation_ready'] and 'runtime/cra1_theme/distribution' in result['checks'][3]['detail'], 'an existing read-only version-pointer directory is reported before installation')
        distribution.rmdir()

        (site / 'public').chmod(0o755)
        native = site / 'public/cart/template/pc/default'
        native.mkdir(parents=True)
        (native / 'asset.js').write_text('fixture native resource')
        destination = site / 'public/cart/template/pc/cra1/assets'
        destination.mkdir(parents=True)
        destination.chmod(0o555)
        (site / 'public').chmod(0o555)
        manifest['references'] = {'public/cart/template/pc/cra1/assets': 'public/cart/template/pc/default'}
        release.write_text(json.dumps(manifest))
        result = exercise()
        check(not result['installation_ready'] and 'public/cart/template/pc/cra1/assets' in result['checks'][3]['detail'], 'a pre-existing dependency directory is checked when its missing child needs a write')
        shutil.copyfile(native / 'asset.js', destination / 'asset.js')
        check(exercise()['installation_ready'], 'complete unchanged dependency copies need no program-directory write permission')
        manifest['references'] = {}
        release.write_text(json.dumps(manifest))

        api = site / 'public/cra1-install/api.php'
        api.chmod(0o000)
        result = exercise()
        check(not result['installation_ready'] and 'api.php' in result['checks'][3]['detail'], 'unreadable installation controller is not treated as a writable-directory issue')
        api.chmod(0o644)

        html = exercise('render', flags=('-d', 'session.save_path=' + str(base / 'missing-session-directory')))
        check('安装会话无法保存' in html and 'id="check" disabled' in html, 'session storage failure is visible before the customer clicks install')
        check(str(base) not in html, 'session storage errors do not expose the absolute server path')

        result = exercise('install')
        check(result.get('installed') is True, 'default-entry installation completes with read-only controller and program directories')
        check((site / 'runtime/cra1_theme/security.sqlite').is_file(), 'the independent identity is created in the writable data directory')
        check((site / 'public').stat().st_mode & 0o777 == 0o555, 'installation does not change public directory permissions')
        check(api.stat().st_mode & 0o777 == 0o644, 'installation does not make controller files writable or executable')
        check(exercise()['mode'] == 'maintenance', 'revisit remains locked after the real permission-constrained install')
    finally:
        for directory, _, files in os.walk(site):
            Path(directory).chmod(0o755)
            for name in files:
                (Path(directory) / name).chmod(0o644)

print(json.dumps({'status': 'passed', 'checks': len(checks), 'php_user': account.pw_name, 'production_writes': 0, 'results': checks}, ensure_ascii=False))
