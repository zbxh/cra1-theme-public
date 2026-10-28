#!/usr/bin/env python3
"""Exercise delivery packaging using synthetic files only."""
import importlib.util
import json
import pathlib
import tempfile
import unittest
import zipfile

module = pathlib.Path(__file__).resolve().parents[1] / 'scripts/bundle_install.py'
spec = importlib.util.spec_from_file_location('bundle_install', module)
bundler = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bundler)


class DeliveryTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='cra1-bundle-test-')
        self.addCleanup(self.temp.cleanup)
        self.root = pathlib.Path(self.temp.name)
        self.source = self.root / 'source'
        self.source.mkdir()
        self.rendered = self.root / 'rendered'
        self.rendered.mkdir()
        (self.rendered / 'installation.html').write_text('<html>Offline guide</html>')
        (self.rendered / 'installation.pdf').write_bytes(b'%PDF-1.4 example')
        for relative, data in {
            'docs/installation.md': b'![example](images/step.png)',
            'docs/images/step.png': b'example screenshot',
            'docs/private.json': b'must not enter the delivery',
            'cra1-theme/docs/nginx.example.conf': b'# Example directory protection',
            'cra1-theme/release.json': b'{"release":"old-working-copy"}',
        }.items():
            file = self.source / relative
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_bytes(data)
        self.install = self.root / 'arbitrary-install-name.zip'
        self.payload = b'example theme payload'
        self.manifest = {'product': 'cra1-theme', 'release': 'existing-version-1',
                         'files': {'public/web/cra1/index.html': {'sha256': bundler.sha(self.payload), 'bytes': len(self.payload)}}}
        self.write_install()

    def bundle(self, output):
        return bundler.bundle_install(self.install, output, self.source, self.rendered)

    def write_install(self, payload=None, extra=None):
        with zipfile.ZipFile(self.install, 'w') as archive:
            archive.writestr('cra1-theme/release.json', json.dumps(self.manifest))
            archive.writestr('public/web/cra1/index.html', self.payload if payload is None else payload)
            for name, data in (extra or {}).items():
                archive.writestr(name, data)

    def test_version_comes_from_package_and_contents_are_unchanged(self):
        original = self.install.read_bytes()
        result = self.bundle(self.root / 'output')
        self.assertEqual(result['path'], 'CRA1-theme-existing-version-1.zip')
        with zipfile.ZipFile(self.root / 'output' / result['path']) as archive:
            self.assertEqual(archive.read('cra1-theme-install.zip'), original)
            self.assertEqual(archive.read('安装教程/安装教程.md'), (self.source / 'docs/installation.md').read_bytes())
            self.assertEqual(archive.read('安装教程/images/step.png'), b'example screenshot')
            self.assertIn('603107399', archive.read('开始安装.txt').decode())
            self.assertIn('https://qm.qq.com/q/O3d7bVtcoS', archive.read('开始安装.txt').decode())
            self.assertIn('同一个 cra1-theme-install.zip', archive.read('开始安装.txt').decode())
            self.assertNotIn('安装教程/nginx.example.conf', archive.namelist())
            self.assertNotIn('目录保护', archive.read('开始安装.txt').decode())
            self.assertIn('https://你的域名/cra1-install/', archive.read('开始安装.txt').decode())
            self.assertEqual(len(archive.namelist()), 6)
        self.assertEqual(self.install.read_bytes(), original)

    def test_repeatable_and_existing_delivery_not_overwritten(self):
        first = self.bundle(self.root / 'first')
        second = self.bundle(self.root / 'second')
        self.assertEqual(first['sha256'], second['sha256'])
        with self.assertRaises(FileExistsError):
            self.bundle(self.root / 'first')

    def test_assigned_version_labels_delivery_without_changing_resource_id(self):
        self.manifest.update(version='v17.1', release_channel='test')
        self.write_install()
        result = self.bundle(self.root / 'named')
        self.assertEqual(result['path'], 'CRA1-theme-v17.1.zip')
        self.assertEqual(result['release'], 'existing-version-1')
        self.assertEqual(result['version'], 'v17.1')
        with zipfile.ZipFile(self.root / 'named' / result['path']) as archive:
            self.assertIn('版本：v17.1（测试版）', archive.read('开始安装.txt').decode())
            self.assertEqual(archive.read('cra1-theme-install.zip'), self.install.read_bytes())

    def test_public_version_cannot_supply_an_output_path(self):
        for value in ['../../private', 'v17.1/other', 'v17.1\n', '', 17.1]:
            with self.subTest(value=value):
                self.manifest['version'] = value
                self.write_install()
                with self.assertRaises(ValueError):
                    self.bundle(self.root / 'unsafe')
        self.assertFalse((self.root / 'unsafe').exists())

    def test_tampered_or_unlisted_installer_files_are_rejected(self):
        self.write_install(payload=b'tampered')
        with self.assertRaises(ValueError):
            self.bundle(self.root / 'output')
        self.write_install(extra={'unexpected-private.txt': b'private'})
        with self.assertRaises(ValueError):
            self.bundle(self.root / 'output')
        self.assertFalse((self.root / 'output').exists())

    def test_missing_guide_stops_before_delivery(self):
        (self.rendered / 'installation.pdf').unlink()
        with self.assertRaises(ValueError):
            self.bundle(self.root / 'output')
        self.assertFalse(list((self.root / 'output').glob('*.zip')))

    def test_guide_traversal_and_symlink_are_rejected(self):
        (self.source / 'docs/installation.md').write_text('![image](../../private.png)')
        with self.assertRaises(ValueError):
            bundler.guide_sources(self.source)
        (self.source / 'docs/installation.md').write_text('![image](images/step.png)')
        image = self.source / 'docs/images/step.png'
        image.unlink()
        image.symlink_to(self.source / 'docs/private.json')
        with self.assertRaises(ValueError):
            bundler.guide_sources(self.source)

    def test_install_path_traversal_and_invalid_identity_are_rejected(self):
        self.write_install(extra={'../private.txt': b'private'})
        with self.assertRaises(ValueError):
            bundler.install_identity(self.install)
        self.manifest['release'] = '../../site'
        self.write_install()
        with self.assertRaises(ValueError):
            bundler.install_identity(self.install)


if __name__ == '__main__':
    unittest.main()
