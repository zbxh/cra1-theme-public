#!/usr/bin/env python3
"""Real TLS probes against temporary local document roots; never touches a V10 site."""
import argparse
import functools
import http.server
import json
import pathlib
import ssl
import subprocess
import tempfile
import threading


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--php', required=True)
    args = parser.parse_args()
    source = pathlib.Path(__file__).resolve().parents[1]
    with tempfile.TemporaryDirectory(prefix='cra1-install-https-') as temporary:
        root = pathlib.Path(temporary)
        (root / 'public/cra1-install').mkdir(parents=True)
        key, certificate = root / 'fixture.key', root / 'fixture.crt'
        subprocess.run(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
                        '-keyout', str(key), '-out', str(certificate), '-days', '1',
                        '-subj', '/CN=localhost', '-addext', 'subjectAltName=IP:127.0.0.1'],
                       check=True, capture_output=True)
        state = {'expose': False, 'wrong_origin': False, 'requests': []}

        class Handler(http.server.SimpleHTTPRequestHandler):
            def log_message(self, *_args):
                pass

            def do_GET(self):
                state['requests'].append(self.path)
                if state['wrong_origin']:
                    self.send_error(404)
                    return
                if state['expose'] and self.path.startswith('/config/cra1-check-'):
                    data = (root / self.path.lstrip('/')).read_bytes()
                    self.send_response(200)
                    self.end_headers()
                    self.wfile.write(data)
                    return
                super().do_GET()

        server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(root / 'public')))
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(certificate, key)
        server.socket = context.wrap_socket(server.socket, server_side=True)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        origin = f'https://127.0.0.1:{server.server_port}'
        code = ('define("CRA1_THEME_BACKEND",$argv[1]."/backend");'
                'require CRA1_THEME_BACKEND."/bootstrap.php";'
                '$result=CRA1\\Theme\\Release\\PrivatePaths::check($argv[2],$argv[3],$argv[4]);'
                'echo json_encode($result);')

        def probe(ca_file):
            output = subprocess.run([args.php, '-r', code, str(source), str(root), origin, ca_file],
                                    capture_output=True, text=True, timeout=45, check=True)
            result = json.loads(output.stdout)
            assert not list(root.rglob('cra1-probe-*.txt'))
            assert not list(root.rglob('cra1-check-*.txt'))
            return result

        try:
            result = probe(str(certificate))
            assert result['passed'] and len(result['checks']) == 7
            state['expose'] = True
            assert not probe(str(certificate))['passed']
            state['expose'] = False
            state['wrong_origin'] = True
            before = len(state['requests'])
            assert not probe(str(certificate))['passed']
            assert len(state['requests']) == before + 1
            state['wrong_origin'] = False
            assert not probe('')['passed'], 'An untrusted certificate must not be accepted'
            print(json.dumps({'status': 'passed', 'real_https_scenarios': 4,
                              'tls_verification': True, 'production_writes': 0}))
        finally:
            server.shutdown()
            server.server_close()
            thread.join()


if __name__ == '__main__':
    main()
