#!/usr/bin/env python3
"""Exercise dependency creation with the website user and normal directory owners."""
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
account = pwd.getpwnam('www') if os.geteuid() == 0 else pwd.getpwuid(os.geteuid())
prefix = ['runuser', '-u', account.pw_name, '--'] if os.geteuid() == 0 else []
checks = []


def check(value, label):
    if not value:
        raise AssertionError(label)
    checks.append(label)


with tempfile.TemporaryDirectory(prefix='cra1-reference-permissions-') as temporary:
    base = Path(temporary)
    base.chmod(0o755)
    site = base / 'site'
    shutil.copytree(source / 'cra1-theme/backend', site / 'cra1-theme/backend',
                    ignore=shutil.ignore_patterns('releases'))
    for relative in ['runtime/cra1_theme', 'public/cart/template/mobile',
                     'public/cart/template/pc/cra1', 'public/cart/template/pc/default/js']:
        (site / relative).mkdir(parents=True, exist_ok=True)
    native = site / 'public/cart/template/pc/default/js/native.js'
    native.write_text('native fixture')
    destination = 'public/cart/template/mobile/cra1/api/native.js'
    references = {destination: native.relative_to(site).as_posix()}
    request = base / 'references.json'
    request.write_text(json.dumps(references))
    script = base / 'exercise.php'
    script.write_text('''<?php
require $argv[1].'/cra1-theme/backend/bootstrap.php';
$refs=json_decode(file_get_contents($argv[2]),true);
try{
 $created=CRA1\\Theme\\Release\\References::apply($argv[1],$refs);
 echo json_encode(['status'=>'passed','created'=>count($created)]);
}catch(Throwable $error){
 $log=ini_get('error_log');ini_set('error_log','/dev/null');
 $response=CRA1\\Theme\\Release\\InstallerFailure::response($error,'准备页面依赖',$argv[1]);
 ini_set('error_log',$log);
 echo json_encode(['status'=>'failed','response'=>$response],JSON_UNESCAPED_UNICODE);
}
''')
    for directory, _, files in os.walk(base):
        Path(directory).chmod(0o755)
        for name in files:
            (Path(directory) / name).chmod(0o644)
    runtime = site / 'runtime/cra1_theme'
    os.chown(runtime, account.pw_uid, account.pw_gid)
    theme = site / 'public/cart/template/mobile/cra1'
    parent = theme.parent
    if os.geteuid() != 0:
        parent.chmod(0o555)

    def exercise(copies=True):
        flags = ['-d', 'disable_functions=symlink'] if copies else []
        result = subprocess.run([*prefix, php, '-d', 'display_errors=0', *flags,
                                 str(script), str(site), str(request)], capture_output=True, text=True)
        if result.returncode:
            raise RuntimeError(result.stderr + result.stdout)
        return json.loads(result.stdout)

    try:
        result = exercise()
        message = result.get('response', {}).get('msg', '')
        check(result['status'] == 'failed' and destination in message,
              'a failed dependency creation identifies its relative target')
        check('public/cart/template/mobile/cra1' in message and 'PHP 运行用户' in message,
              'the actual permission failure explains the directory to prepare')
        check(str(base) not in message, 'customer feedback contains no absolute server path')
        check(not (runtime / 'native-reference-copies.json').exists(),
              'failed creation does not publish a dependency registry')
        parent_mode = parent.stat().st_mode & 0o777
        check(parent_mode == (0o755 if os.geteuid() == 0 else 0o555),
              'native template parent permissions are never changed')

        # Simulate the owner preparing only the named theme directory in their panel.
        if os.geteuid() != 0:
            parent.chmod(0o755)
        theme.mkdir()
        os.chown(theme, account.pw_uid, account.pw_gid)
        theme.chmod(0o555)
        result = exercise()
        check(result['status'] == 'passed',
              'a website-owned read-only theme directory is repaired during the real write')
        check((theme.stat().st_mode & 0o777) == 0o755,
              'repair adds owner permissions without enabling public write')
        check((site / destination).read_text() == native.read_text(),
              'registered dependencies are prepared when symlink is disabled')
        registry = (runtime / 'native-reference-copies.json').read_bytes()
        theme.chmod(0o555)
        check(exercise()['status'] == 'passed' and (theme.stat().st_mode & 0o777) == 0o555,
              'unchanged copies remain usable without changing read-only directories')
        check((runtime / 'native-reference-copies.json').read_bytes() == registry,
              'an unchanged retry keeps the registered dependency bytes')

        inherited = site / 'public/cart/template/pc/cra1/inherited'
        inherited.mkdir()
        os.chown(inherited, account.pw_uid, account.pw_gid)
        os.chmod(inherited, 0o2555)
        request.write_text(json.dumps({'public/cart/template/pc/cra1/inherited/new.js':
                                       native.relative_to(site).as_posix()}))
        check(exercise()['status'] == 'passed', 'owner permission repair supports group-inheriting theme directories')
        check((inherited.stat().st_mode & 0o7777) == 0o2755,
              'owner permission repair preserves the directory group-inheritance bit')
        registry = (runtime / 'native-reference-copies.json').read_bytes()

        # A real write failure must undo earlier newly copied dependencies.
        theme.chmod(0o755)
        extra = site / 'public/cart/template/pc/cra1/api'
        extra.mkdir()
        os.chown(extra, account.pw_uid, account.pw_gid)
        unwriteable = theme / 'blocked'
        unwriteable.mkdir()
        unwriteable.chmod(0o555)
        request.write_text(json.dumps({
            'public/cart/template/pc/cra1/api/new.js': native.relative_to(site).as_posix(),
            'public/cart/template/mobile/cra1/blocked/missing/new.js': native.relative_to(site).as_posix(),
        }))
        if os.geteuid() == 0:
            result = exercise()
            check(result['status'] == 'failed', 'a directory owned by another user is not silently bypassed')
            check(not (extra / 'new.js').exists(), 'a later failure removes the earlier new copy')
            check((runtime / 'native-reference-copies.json').read_bytes() == registry,
                  'a later failure preserves the previous dependency registry')
            check((unwriteable.stat().st_mode & 0o777) == 0o555,
                  'a root-owned theme directory is not made world-writable')

        request.write_text(json.dumps({'public/cart/template/mobile/cra1/links/native.js':
                                       native.relative_to(site).as_posix()}))
        theme.chmod(0o555)
        result = exercise(copies=False)
        check(result['status'] == 'passed' and (theme / 'links/native.js').is_symlink(),
              'legal dependency links use the same directory preparation')
        check(native.read_text() == 'native fixture' and (native.stat().st_mode & 0o777) == 0o644,
              'the native dependency source and its permissions remain unchanged')
    finally:
        for directory, _, files in os.walk(base):
            Path(directory).chmod(0o755)
            for name in files:
                if not (Path(directory) / name).is_symlink():
                    (Path(directory) / name).chmod(0o644)

print(json.dumps({'status': 'passed', 'checks': len(checks), 'php_user': account.pw_name,
                  'production_writes': 0, 'results': checks}, ensure_ascii=False))
