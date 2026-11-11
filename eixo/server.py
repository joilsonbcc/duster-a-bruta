#!/usr/bin/env python3
"""Servidor do Eixo: entrega o app e guarda os dados num arquivo, para todos os
aparelhos da rede verem a mesma coisa. Só precisa de Python 3 (sem instalar nada).

    python3 server.py                 # porta 8080, dados em ./dados
    python3 server.py --port 9000 --dados /var/lib/eixo
"""
import argparse
import hmac
import json
import os
import secrets
import socket
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

APP_DIR = os.path.dirname(os.path.abspath(__file__))
PRIVATE = {'dados', 'server.py', 'instalar-servidor.sh', 'README.md'}
MAX_BODY = 20 * 1024 * 1024
lock = threading.Lock()


class Store:
    def __init__(self, folder):
        os.makedirs(folder, exist_ok=True)
        self.path = os.path.join(folder, 'eixo-dados.json')
        key_path = os.path.join(folder, 'chave.txt')
        if not os.path.exists(key_path):
            with open(key_path, 'w') as f:
                f.write(secrets.token_hex(4))
            os.chmod(key_path, 0o600)
        with open(key_path) as f:
            self.key = f.read().strip()
        self.data = {'rev': 0, 'state': None}
        if os.path.exists(self.path):
            with open(self.path, encoding='utf-8') as f:
                self.data = json.load(f)

    def write(self, state):
        self.data = {'rev': self.data['rev'] + 1, 'state': state}
        tmp = self.path + '.tmp'
        with open(tmp, 'w', encoding='utf-8') as f:
            json.dump(self.data, f, ensure_ascii=False)
        os.replace(tmp, self.path)  # troca atômica: nunca deixa o arquivo pela metade
        return self.data['rev']


class Handler(SimpleHTTPRequestHandler):
    store = None

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=APP_DIR, **kw)

    def log_message(self, *a):
        pass

    def send_json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def authorized(self):
        return hmac.compare_digest(self.headers.get('X-Eixo-Key', ''), self.store.key)

    def is_api(self):
        return self.path.split('?')[0].rstrip('/').endswith('/api/state')

    def do_GET(self):
        if self.is_api():
            if not self.authorized():
                return self.send_json(401, {'erro': 'chave'})
            with lock:
                return self.send_json(200, self.store.data)
        first = self.path.split('?')[0].strip('/').split('/')[0]
        if first in PRIVATE or first.startswith('.'):
            return self.send_error(404)
        super().do_GET()

    def do_PUT(self):
        if not self.is_api():
            return self.send_error(404)
        if not self.authorized():
            return self.send_json(401, {'erro': 'chave'})
        size = int(self.headers.get('Content-Length') or 0)
        if not 0 < size <= MAX_BODY:
            return self.send_json(413, {'erro': 'tamanho'})
        try:
            body = json.loads(self.rfile.read(size))
            state, base = body['state'], int(body['rev'])
            if not isinstance(state, dict) or not isinstance(state.get('items'), list):
                raise ValueError
        except (ValueError, KeyError, TypeError):
            return self.send_json(400, {'erro': 'formato'})
        with lock:
            if base != self.store.data['rev']:  # outro aparelho salvou antes
                return self.send_json(409, self.store.data)
            return self.send_json(200, {'rev': self.store.write(state)})

    def end_headers(self):
        if not self.is_api():
            self.send_header('Cache-Control', 'no-cache')
        super().end_headers()


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))
        return s.getsockname()[0]
    except OSError:
        return 'IP-DO-SERVIDOR'
    finally:
        s.close()


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description='Servidor do Eixo')
    ap.add_argument('--port', type=int, default=8080)
    ap.add_argument('--dados', default=os.path.join(APP_DIR, 'dados'), help='pasta onde os dados ficam guardados')
    args = ap.parse_args()
    Handler.store = Store(args.dados)
    print(f'Eixo no ar:  http://{lan_ip()}:{args.port}/', flush=True)
    print(f'Chave de acesso: {Handler.store.key}   (dados em {args.dados})', flush=True)
    ThreadingHTTPServer(('0.0.0.0', args.port), Handler).serve_forever()
