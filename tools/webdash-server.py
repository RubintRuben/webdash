#!/usr/bin/env python3
"""Public read proxy: bounded disk cache, shared downloads and streaming IO."""
from concurrent.futures import Future
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import BoundedSemaphore, Lock
import hashlib, os, re, shutil, sys, tempfile, time
import urllib.error, urllib.parse, urllib.request

ROOT = Path(__file__).resolve().parent.parent
PRODUCTION = os.environ.get('RENDER') == 'true' or '--production' in sys.argv
ORIGINS = set(os.environ.get('WEBDASH_ORIGINS', 'https://web-dashers.github.io').split(','))
SLOTS = BoundedSemaphore(6)
MAX_FILE = 48 * 1024 * 1024
GD_API_BASE = os.environ.get('WEBDASH_GD_API_BASE', 'https://www.boomlings.com/database').rstrip('/')
gd_origin = urllib.parse.urlsplit(GD_API_BASE)
if gd_origin.scheme != 'https' or not gd_origin.hostname or gd_origin.username or gd_origin.password or gd_origin.query or gd_origin.fragment:
    raise ValueError('WEBDASH_GD_API_BASE must be an HTTPS URL for an authorized compatible API')

class GDNetworkDenied(OSError):
    pass

def audio_url_allowed(url):
    try:
        p = urllib.parse.urlsplit(url)
        host = (p.hostname or '').lower()
        return (p.scheme == 'https' and not p.username and not p.password and
                p.port in (None, 443) and (host in ('geometrydashfiles.b-cdn.net',
                'geometrydashcontent.b-cdn.net') or host.endswith('.ngfiles.com')))
    except ValueError:
        return False

class AudioRedirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not audio_url_allowed(newurl):
            raise ValueError('Audio redirect target is not allowed')
        return super().redirect_request(req, fp, code, msg, headers, newurl)

class DownloadCache:
    def __init__(self, limit=384 * 1024 * 1024):
        self.root = Path(tempfile.mkdtemp(prefix='webdash-cache-'))
        self.limit, self.lock = limit, Lock()
        self.entries, self.pending = {}, {}
        self.gd_blocked_until = 0

    def fetch(self, key, request, ttl, audio=False, gd_api=False):
        with self.lock:
            row = self.entries.get(key)
            if row and row['expires'] > time.monotonic() and row['path'].is_file():
                row['used'] = time.monotonic()
                return row, 'HIT'
            if gd_api and self.gd_blocked_until > time.monotonic():
                raise GDNetworkDenied('GD hosting network access denied (1005)')
            future = self.pending.get(key)
            owner = future is None
            if owner:
                if len(self.pending) >= 64:
                    raise TimeoutError('Download queue is full')
                future = self.pending[key] = Future()
        if not owner:
            return future.result(timeout=65), 'COALESCED'
        filename = self.root / hashlib.sha256(key.encode()).hexdigest()
        temporary = filename.with_suffix('.part')
        try:
            if not SLOTS.acquire(timeout=35):
                raise TimeoutError('Download queue is busy')
            try:
                opener = urllib.request.build_opener(AudioRedirects()) if audio else urllib.request.build_opener()
                try:
                    upstream = opener.open(request, timeout=20)
                except urllib.error.HTTPError as error:
                    if gd_api and error.code == 403:
                        detail = error.read(4096)
                        error.close()
                        if re.search(rb'\berror(?:\s+code)?\s*:?\s*1005\b', detail, re.I):
                            with self.lock:
                                self.gd_blocked_until = time.monotonic() + 300
                            raise GDNetworkDenied('GD hosting network access denied (1005)') from error
                    raise
                with upstream, temporary.open('wb') as out:
                    size = 0
                    while chunk := upstream.read(64 * 1024):
                        size += len(chunk)
                        if size > MAX_FILE:
                            raise ValueError('Download exceeds 48 MiB')
                        out.write(chunk)
                    kind = upstream.headers.get('Content-Type', 'audio/mpeg' if audio else 'text/plain; charset=utf-8')
                    if audio and any(t in kind.lower() for t in ('text/html', 'application/json')):
                        raise ValueError('Audio upstream returned an error document')
            finally:
                SLOTS.release()
            if not audio:
                with temporary.open('rb') as check:
                    if check.read(128).lstrip().startswith((b'<', b'error code:')):
                        raise ValueError('GD upstream returned an error document')
            if size == 0 or (not audio and size <= 3 and temporary.read_bytes().strip() in (b'-1', b'-2')):
                ttl = 2
            temporary.replace(filename)
            row = dict(path=filename, size=size, content_type=kind, expires=time.monotonic()+ttl, used=time.monotonic())
            with self.lock:
                self.entries[key] = row
                total = sum(e['size'] for e in self.entries.values())
                for oldkey, entry in sorted(self.entries.items(), key=lambda item: item[1]['used']):
                    if total <= self.limit:
                        break
                    if oldkey != key:
                        self.entries.pop(oldkey)
                        try:
                            entry['path'].unlink(missing_ok=True)
                        except OSError:
                            pass
                        total -= entry['size']
            future.set_result(row)
            return row, 'MISS'
        except Exception as error:
            temporary.unlink(missing_ok=True)
            future.set_exception(error)
            raise
        finally:
            with self.lock:
                self.pending.pop(key, None)

    def close(self):
        shutil.rmtree(self.root, ignore_errors=True)

CACHE = DownloadCache()

class NoCacheHandler(SimpleHTTPRequestHandler):
    gd_read_endpoints = frozenset(('getGJLevels21.php', 'downloadGJLevel22.php', 'getGJSongInfo.php'))

    def log_request(self, code='-', size='-'):
        if not PRODUCTION:
            super().log_request(code, size)

    def end_headers(self):
        if getattr(self, '_retry_after', None):
            self.send_header('Retry-After', str(self._retry_after))
        if getattr(self, '_upstream_error', None):
            self.send_header('X-WebDash-Upstream-Error', self._upstream_error)
        origin = self.headers.get('Origin', '')
        if '*' in ORIGINS or origin in ORIGINS or (not PRODUCTION and origin.startswith(('http://localhost:', 'http://127.0.0.1:'))):
            self.send_header('Access-Control-Allow-Origin', '*' if '*' in ORIGINS else origin)
            self.send_header('Vary', 'Origin')
            self.send_header('Access-Control-Expose-Headers', 'Content-Length, X-WebDash-Cache, X-WebDash-Upstream-Error, Retry-After')
        self.send_header('X-Content-Type-Options', 'nosniff')
        if not getattr(self, '_cache_control', False):
            self.send_header('Cache-Control', 'public, max-age=3600' if PRODUCTION and self.path.startswith('/assets/') else 'no-cache')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, HEAD, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Max-Age', '86400')
        self.send_header('Content-Length', '0')
        self.end_headers()

    def list_directory(self, path):
        self.send_error(404)

    def _reply_cached(self, row, cache_status):
        with row['path'].open('rb') as stream:
            self.send_response(200)
            self.send_header('Content-Type', row['content_type'])
            self.send_header('Content-Length', str(row['size']))
            self.send_header('X-WebDash-Cache', cache_status)
            self._cache_control = True
            self.send_header('Cache-Control', 'public, max-age=86400' if self.path.startswith('/gd-audio') else 'no-cache')
            self.end_headers()
            shutil.copyfileobj(stream, self.wfile, 64 * 1024)

    def _unavailable(self, service, error):
        reason = error.reason if isinstance(error, urllib.error.URLError) and not isinstance(error, urllib.error.HTTPError) else error
        self._upstream_error = type(reason).__name__
        if isinstance(error, GDNetworkDenied):
            self._upstream_error += ':1005'
            self._retry_after = 300
        if isinstance(error, urllib.error.HTTPError):
            self._upstream_error += ':' + str(error.code)
        self.log_error('%s upstream failed: %s: %s', service, type(reason).__name__, error)
        self.send_error(503, service + ' temporarily unavailable; retry shortly')

    def _public(self):
        parsed = urllib.parse.urlsplit(self.path)
        resolved = Path(self.translate_path(parsed.path)).resolve()
        public = (parsed.path in ('/', '/index.html', '/robots.txt') and resolved.is_relative_to(ROOT)) or (parsed.path.startswith('/assets/') and resolved.is_relative_to(ROOT / 'assets'))
        return public and not any(p.startswith('.') for p in Path(parsed.path).parts)

    def do_HEAD(self):
        if PRODUCTION and not self._public():
            self.send_error(404)
            return
        super().do_HEAD()

    def do_GET(self):
        self._cache_control = False
        parsed = urllib.parse.urlsplit(self.path)
        if parsed.path == '/gd-health':
            body = b'{"ready":true,"service":"webdash","version":1}'
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if parsed.path == '/gd-audio':
            url = urllib.parse.parse_qs(parsed.query).get('url', [''])[0]
            if not audio_url_allowed(url):
                self.send_error(400)
                return
            try:
                request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                row, status = CACHE.fetch('audio:'+url, request, 86400, audio=True)
                self._reply_cached(row, status)
            except (BrokenPipeError, ConnectionResetError):
                pass
            except (OSError, ValueError, TimeoutError, urllib.error.URLError) as error:
                self._unavailable('Audio', error)
            return
        if PRODUCTION and not self._public():
            self.send_error(404)
            return
        super().do_GET()

    def do_POST(self):
        self._cache_control = False
        endpoint = urllib.parse.urlsplit(self.path).path.removeprefix('/gd-api/')
        if not self.path.startswith('/gd-api/') or endpoint not in self.gd_read_endpoints:
            self.send_error(404)
            return
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if not 0 < size <= 65536:
                self.send_error(413)
                return
            self.connection.settimeout(25)
            body = self.rfile.read(size)
            if len(body) != size:
                self.send_error(400)
                return
            request = urllib.request.Request(GD_API_BASE+'/'+endpoint,
                data=body, headers={'User-Agent': '', 'Content-Type': 'application/x-www-form-urlencoded'})
            ttl = 30 if endpoint == 'getGJLevels21.php' else 3600
            row, status = CACHE.fetch(endpoint+':'+hashlib.sha256(body).hexdigest(), request, ttl, gd_api=True)
            self._reply_cached(row, status)
        except (BrokenPipeError, ConnectionResetError):
            pass
        except (OSError, ValueError, TimeoutError, urllib.error.URLError) as error:
            self._unavailable('GD server', error)

class WebDashServer(ThreadingHTTPServer):
    request_queue_size = 128
    daemon_threads = True

def main():
    port = int(next((arg for arg in sys.argv[1:] if arg.isdigit()), os.environ.get('PORT', '8765')))
    handler = partial(NoCacheHandler, directory=str(ROOT))
    server = WebDashServer(('0.0.0.0' if PRODUCTION else '127.0.0.1', port), handler)
    print(f'Web Dashers: port {port}, production={PRODUCTION}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        CACHE.close()

if __name__ == '__main__':
    main()

