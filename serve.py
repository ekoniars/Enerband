#!/usr/bin/env python3
"""Dev server with no-cache headers and content save API for Enerband demo-site."""
import http.server
import json
import os
import sys

DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'content-db.json')

def load_db():
    if os.path.exists(DB_FILE):
        with open(DB_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def save_db(data):
    with open(DB_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_POST(self):
        if self.path == '/api/save':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length).decode('utf-8')
            payload = json.loads(body)
            key = payload.get('key', '')
            value = payload.get('value', '')
            if key:
                db = load_db()
                db[key] = value
                save_db(db)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"ok":true}')
            else:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b'{"error":"no key"}')

        elif self.path == '/api/load':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length).decode('utf-8')
            payload = json.loads(body)
            prefix = payload.get('prefix', '')
            db = load_db()
            result = {k: v for k, v in db.items() if k.startswith(prefix)}
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(result, ensure_ascii=False).encode('utf-8'))

        else:
            self.send_response(404)
            self.end_headers()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
print(f"Serving on http://localhost:{port} (no-cache + content API)")
http.server.HTTPServer(("", port), NoCacheHandler).serve_forever()
